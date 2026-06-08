import { Worker, Job } from 'bullmq';
import { db } from '../lib/db/connection';
import { tradeLinks, followerAccounts, systemAuditLogs, providers } from '../lib/db/schema';
import { redisConnection, QUEUE_NAMES } from '../lib/queue/config';
import { eq, and } from 'drizzle-orm';
import MetaApi from 'metaapi.cloud-sdk';
import logger from '../lib/utils/logger';

const metaApi = new MetaApi(process.env.METAAPI_TOKEN || '');

async function getRpc(accountId: string) {
  const account = await metaApi.metatraderAccountApi.getAccount(accountId);
  const conn = account.getRPCConnection();
  await conn.connect();
  return conn;
}

/**
 * Automated Self-Healing Slave-Monitor Reconciliation Routine Worker
 */
export const slaveMonitorWorker = new Worker(QUEUE_NAMES.SLAVE_MONITOR, async (job: Job) => {
  logger.info('Initializing automated state synchronization verification audit across active nodes...');
  
  const activeProviders = await db.select().from(providers).where(eq(providers.isActive, true));

  for (const prov of activeProviders) {
    try {
      const masterConn = await getRpc(prov.mt5AccountId);
      const masterPositions = await masterConn.getPositions();
      
      const followers = await db.select().from(followerAccounts).where(and(
        eq(followerAccounts.providerId, prov.id),
        eq(followerAccounts.isActive, true)
      ));

      for (const follower of followers) {
        const followerConn = await getRpc(follower.mt5AccountId);
        const followerPositions = await followerConn.getPositions();

        // 1. Scan for Orphaned Open Positions inside Follower Terminal Architecture
        for (const fPos of followerPositions) {
          const mappingExists = await db.select().from(tradeLinks).where(and(
            eq(tradeLinks.followerTradeId, fPos.id),
            eq(tradeLinks.status, 'open')
          ));

          const masterStillHasOpen = masterPositions.find(p => p.id === mappingExists[0]?.masterTradeId);

          if (mappingExists.length === 0 || !masterStillHasOpen) {
            logger.warn(`[Self-Healing] Orphan detected! Closing untracked/stale position: ${fPos.id} on account: ${follower.mt5AccountId}`);
            
            try {
              await followerConn.closePosition(fPos.id);
              if (mappingExists[0]) {
                await db.update(tradeLinks).set({ status: 'closed', updatedAt: new Date() }).where(eq(tradeLinks.id, mappingExists[0].id));
              }
              await db.insert(systemAuditLogs).values({
                level: 'repair',
                component: 'RECONCILIATION_ENGINE',
                message: `Successfully self-healed and force closed orphaned follower position ID ${fPos.id}`,
              });
            } catch (healError: any) {
              await db.insert(systemAuditLogs).values({
                level: 'critical',
                component: 'RECONCILIATION_ENGINE',
                message: `Failed self-healing recovery operation on position ID ${fPos.id}: ${healError.message}`,
              });
            }
          }
        }

        // 2. Validate Risk Parameter Divergence across Remaining Positions
        for (const mPos of masterPositions) {
          const matchingLink = await db.select().from(tradeLinks).where(and(
            eq(tradeLinks.masterTradeId, mPos.id),
            eq(tradeLinks.followerAccountId, follower.mt5AccountId),
            eq(tradeLinks.status, 'open')
          ));

          if (matchingLink.length > 0) {
            const currentFollowerPos = followerPositions.find(p => p.id === matchingLink[0].followerTradeId);
            
            if (currentFollowerPos) {
              const slMismatch = Math.abs((currentFollowerPos.stopLoss || 0) - (mPos.stopLoss || 0)) > 0.0001;
              const tpMismatch = Math.abs((currentFollowerPos.takeProfit || 0) - (mPos.takeProfit || 0)) > 0.0001;

              if (slMismatch || tpMismatch) {
                logger.info(`[Self-Healing] Aligning stop metrics for mapped profile track sequence match ${matchingLink[0].id}`);
                await followerConn.modifyPosition(currentFollowerPos.id, {
                  stopLoss: mPos.stopLoss,
                  takeProfit: mPos.takeProfit
                });
              }
            }
          }
        }
      }
    } catch (providerError: any) {
      logger.error(`Critical parsing breakdown scanning provider element node maps ${prov.id}: ${providerError.message}`);
    }
  }
}, { connection: redisConnection });
