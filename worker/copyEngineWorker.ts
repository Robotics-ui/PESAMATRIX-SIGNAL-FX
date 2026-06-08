import { Worker, Job } from 'bullmq';
import { db } from '../lib/db/connection';
import { tradeLinks, followerAccounts, systemAuditLogs, providers } from '../lib/db/schema';
import { redisConnection, QUEUE_NAMES, copyTradeQueue, modifyTradeQueue, closeTradeQueue, analyticsQueue } from '../lib/queue/config';
import { eq, and } from 'drizzle-orm';
import MetaApi, { MetatraderPosition } from 'metaapi.cloud-sdk';
import logger from '../lib/utils/logger';

const token = process.env.METAAPI_TOKEN || '';
const metaApi = new MetaApi(token);

// Broker MetaApi Instance Factory Cache
const connectionCache: Record<string, any> = {};
async function getConnectedConnection(accountId: string) {
  if (connectionCache[accountId]) return connectionCache[accountId];
  const account = await metaApi.metatraderAccountApi.getAccount(accountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized();
  connectionCache[accountId] = connection;
  return connection;
}

/**
 * Main Entry Master Eventrouter
 */
export const providerEventWorker = new Worker(QUEUE_NAMES.PROVIDER_EVENT, async (job: Job) => {
  const { type, providerId, masterAccountId, position, positionId } = job.data;
  
  // Idempotency Deduplication Safety Strategy
  const lockKey = `lock:event:${type}:${masterAccountId}:${positionId || position?.id}`;
  const isDuplicate = await redisConnection.set(lockKey, 'processing', 'NX', 'EX', 10);
  if (!isDuplicate) {
    logger.warn(`Bypassing duplicate cluster payload execution via lock logic for key: ${lockKey}`);
    return;
  }

  switch (type) {
    case 'POSITION_OPENED':
      await copyTradeQueue.add(`open-${position.id}`, job.data);
      break;
    case 'POSITION_MODIFIED':
      await modifyTradeQueue.add(`modify-${position.id}`, job.data);
      break;
    case 'POSITION_CLOSED':
      await closeTradeQueue.add(`close-${positionId}`, job.data);
      break;
  }
}, { connection: redisConnection });

/**
 * Execution Worker: Replication & Risk Distribution Processing Engine
 */
export const copyTradeWorker = new Worker(QUEUE_NAMES.COPY_TRADE, async (job: Job) => {
  const { providerId, masterAccountId, position }: { providerId: string, masterAccountId: string, position: MetatraderPosition } = job.data;
  
  // Query followers matching active subscriptions 
  const subscribers = await db.select()
    .from(followerAccounts)
    .where(and(eq(followerAccounts.providerId, providerId), eq(followerAccounts.isActive, true)));

  for (const sub of subscribers) {
    try {
      const followerConn = await getConnectedConnection(sub.mt5AccountId);
      
      // Phase 3: Mathematical Risk Processing Formula Models
      let calculatedLots = 0.01;
      const masterLots = position.volume;
      
      if (sub.riskModel === 'fixed_lot') {
        calculatedLots = parseFloat(sub.riskValue);
      } else if (sub.riskModel === 'multiplier') {
        calculatedLots = masterLots * parseFloat(sub.riskValue);
      } else if (sub.riskModel === 'balance_ratio') {
        const masterConn = await getConnectedConnection(masterAccountId);
        const masterAccountMeta = await masterConn.getAccountInformation();
        const followerAccountMeta = await followerConn.getAccountInformation();
        calculatedLots = (masterLots * (followerAccountMeta.balance / masterAccountMeta.balance)) * parseFloat(sub.riskValue);
      }

      // Min/Max Safety Bound Checks 
      calculatedLots = Math.max(0.01, Math.min(100.0, Math.round(calculatedLots * 100) / 100));

      logger.info(`Replicating Order -> Account: ${sub.mt5AccountId}, Asset: ${position.symbol}, Target Volume: ${calculatedLots}`);

      const tradeResult = await followerConn.createMarketOpenOrder(position.symbol, position.type, calculatedLots, {
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
      });

      // Save Immutable Trade Link Mapping Registry Entry
      await db.insert(tradeLinks).values({
        providerId,
        masterAccountId,
        masterTradeId: position.id,
        followerAccountId: sub.mt5AccountId,
        followerTradeId: tradeResult.positionId,
        symbol: position.symbol,
        status: 'open',
        masterVolume: masterLots.toString(),
        followerVolume: calculatedLots.toString(),
      });

    } catch (err: any) {
      await db.insert(systemAuditLogs).values({
        level: 'error',
        component: 'COPY_TRADE_ENGINE',
        message: `Execution failed on follower ${sub.mt5AccountId} for master trade ${position.id}`,
        metaData: { error: err.message, sub }
      });
      throw err; // Push to let BullMQ manage the linear exponential backoffs
    }
  }
}, { connection: redisConnection });

/**
 * Worker Processor: Dynamic Modifications Registry Syncer
 */
export const modifyTradeWorker = new Worker(QUEUE_NAMES.MODIFY_TRADE, async (job: Job) => {
  const { masterTradeId, position }: { masterTradeId: string, position: MetatraderPosition } = job.data;
  
  const links = await db.select().from(tradeLinks).where(and(eq(tradeLinks.masterTradeId, position.id), eq(tradeLinks.status, 'open')));

  for (const link of links) {
    try {
      const followerConn = await getConnectedConnection(link.followerAccountId);
      await followerConn.modifyPosition(link.followerTradeId, {
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
      });

      await db.update(tradeLinks)
        .set({ status: 'modified', updatedAt: new Date() })
        .where(eq(tradeLinks.id, link.id));
    } catch (err: any) {
      logger.error(`Modification synchronization failed for mapping link ${link.id}: ${err.message}`);
    }
  }
}, { connection: redisConnection });

/**
 * Close Worker: Multi-Execution Complete / Partial Closure Handling Engine
 */
export const closeTradeWorker = new Worker(QUEUE_NAMES.CLOSE_TRADE, async (job: Job) => {
  const { masterAccountId, positionId, position }: { masterAccountId: string, positionId: string, position?: MetatraderPosition } = job.data;

  const links = await db.select().from(tradeLinks).where(and(eq(tradeLinks.masterTradeId, positionId), eq(tradeLinks.status, 'open')));

  for (const link of links) {
    try {
      const followerConn = await getConnectedConnection(link.followerAccountId);

      if (position && parseFloat(position.volume).toFixed(2) !== parseFloat(link.masterVolume).toFixed(2)) {
        // Phase 5: Executing Fractional Proportional Reductions Loop
        const masterRemaining = position.volume;
        const closedMasterVolume = parseFloat(link.masterVolume) - masterRemaining;
        const executionRatio = closedMasterVolume / parseFloat(link.masterVolume);
        
        const followerCurrentVol = parseFloat(link.followerVolume);
        const followerCloseVolume = Math.max(0.01, Math.round((followerCurrentVol * executionRatio) * 100) / 100);

        logger.info(`Executing Partial Close -> target: ${link.followerTradeId}, portion: ${followerCloseVolume}`);
        await followerConn.closePositionPartially(link.followerTradeId, followerCloseVolume);

        await db.update(tradeLinks).set({
          masterVolume: masterRemaining.toString(),
          followerVolume: (followerCurrentVol - followerCloseVolume).toString(),
          updatedAt: new Date()
        }).where(eq(tradeLinks.id, link.id));

      } else {
        // Phase 6: Total Close Route
        logger.info(`Executing Full Position Close -> Account Target: ${link.followerAccountId}, Trade Target: ${link.followerTradeId}`);
        await followerConn.closePosition(link.followerTradeId);

        await db.update(tradeLinks)
          .set({ status: 'closed', updatedAt: new Date() })
          .where(eq(tradeLinks.id, link.id));
      }
    } catch (err: any) {
      logger.error(`Position closure routine aborted unexpectedly on mapping profile row ${link.id}: ${err.message}`);
      throw err;
    }
  }

  // Queue background metric recalculation analytics process
  await analyticsQueue.add('recalculate', { masterAccountId });
}, { connection: redisConnection });
