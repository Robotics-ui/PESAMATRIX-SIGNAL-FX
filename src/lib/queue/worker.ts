import { Worker, Job } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { connection } from './client.js';
import { db } from '../db/connection.js';
import { followerAccounts, mt5Accounts, subscriptions, trades, tradeLogs } from '../db/schema.js';
import { decrypt } from '../db/crypto.js';
import { metaApi } from '../../config/metaapi.js';

export const startWorker = () => {
  const copyTradeWorker = new Worker(
    'copy-trade',
    async (job: Job) => {
      const startTime = Date.now();
      const { action, providerId, masterPositionId, symbol, type, volume, openPrice, closePrice } = job.data;

      // 1. Verify Active Copy Trading Instance in Context Matrix Table
      const matchedTrades = await db.select().from(trades).where(
        and(eq(trades.providerId, providerId), eq(trades.masterPositionId, masterPositionId))
      ).limit(1);
      
      let targetTradeId: string;

      if (action === 'OPEN') {
        if (matchedTrades.length > 0) return; // Prevent duplication anomalies
        const [newTrade] = await db.insert(trades).values({
          providerId,
          masterPositionId,
          symbol,
          type,
          volume: String(volume),
          openPrice: String(openPrice),
          status: 'open',
          openedAt: new Date()
        }).returning();
        targetTradeId = newTrade.id;
      } else {
        if (matchedTrades.length === 0) return; // Closed or unhandled event mismatch
        targetTradeId = matchedTrades[0].id;
        if (action === 'CLOSE') {
          await db.update(trades).set({
            status: 'closed',
            closePrice: String(closePrice),
            closedAt: new Date()
          }).where(eq(trades.id, targetTradeId));
        }
      }

      // 2. Extract active followers subscribed to this explicit provider
      const followers = await db.select({
        followerAccountId: followerAccounts.id,
        lotMultiplier: followerAccounts.lotMultiplier,
        metaApiAccountId: mt5Accounts.metaApiAccountId,
        userId: followerAccounts.userId
      })
      .from(followerAccounts)
      .innerJoin(mt5Accounts, eq(followerAccounts.mt5AccountId, mt5Accounts.id))
      .where(and(eq(followerAccounts.providerId, providerId), eq(followerAccounts.isActive, true)));

      // 3. Process execution for every follower using execution wrappers
      for (const follower of followers) {
        // Validate subscription active frame
        const activeSub = await db.select().from(subscriptions).where(
          and(
            eq(subscriptions.userId, follower.userId),
            eq(subscriptions.status, 'active')
          )
        ).limit(1);

        if (activeSub.length === 0 || new Date() > activeSub[0].expiresAt) {
          // If expired frame execution context matches, toggle dynamic lock validation status
          if (activeSub.length > 0) {
            await db.update(subscriptions).set({ status: 'expired' }).where(eq(subscriptions.id, activeSub[0].id));
          }
          continue; 
        }

        try {
          const account = await metaApi.metatraderAccountApi.getAccount(follower.metaApiAccountId);
          const connectionInstance = account.getRPCConnection();
          await connectionInstance.connect();
          await connectionInstance.waitSynchronized();

          if (action === 'OPEN') {
            const calculatedLot = (parseFloat(follower.lotMultiplier) * volume).toFixed(2);
            // Fire RPC order straight into MetaApi cloud gateway
            const executionResult = await connectionInstance.createMarketOrder(
              symbol,
              type === 'BUY' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
              parseFloat(calculatedLot),
              0,
              0,
              {}
            );

            await db.insert(tradeLogs).values({
              tradeId: targetTradeId,
              followerAccountId: follower.followerAccountId,
              followerPositionId: executionResult.positionId,
              action: 'OPEN',
              volume: calculatedLot,
              executionLatencyMs: Date.now() - startTime
            });
          } else if (action === 'CLOSE') {
            const existingLogs = await db.select().from(tradeLogs).where(
              and(
                eq(tradeLogs.tradeId, targetTradeId),
                eq(tradeLogs.followerAccountId, follower.followerAccountId),
                eq(tradeLogs.action, 'OPEN')
              )
            ).limit(1);

            if (existingLogs.length > 0 && existingLogs[0].followerPositionId) {
              await connectionInstance.closePosition(existingLogs[0].followerPositionId, {});
              await db.insert(tradeLogs).values({
                tradeId: targetTradeId,
                followerAccountId: follower.followerAccountId,
                followerPositionId: existingLogs[0].followerPositionId,
                action: 'CLOSE',
                volume: existingLogs[0].volume,
                executionLatencyMs: Date.now() - startTime
              });
            }
          }
        } catch (err: any) {
          await db.insert(tradeLogs).values({
            tradeId: targetTradeId,
            followerAccountId: follower.followerAccountId,
            action: 'FAILED',
            volume: '0.00',
            errorMessage: err?.message || 'Unknown execution instance termination inside API cluster.',
            executionLatencyMs: Date.now() - startTime
          });
        }
      }
    },
    { connection, concurrency: 20 }
  );

  // Fallback catch-all execution layers for validation routines
  const genericWorker = new Worker('account-sync', async (job) => { console.log(`Processing job ${job.id} on account-sync`); }, { connection });
  const provWorker = new Worker('provider-event', async (job) => { console.log(`Processing job ${job.id} on provider-event`); }, { connection });
  const notifWorker = new Worker('notification', async (job) => { console.log(`Processing job ${job.id} on notification`); }, { connection });
  const analWorker = new Worker('analytics', async (job) => { console.log(`Processing job ${job.id} on analytics`); }, { connection });
  const slaveWorker = new Worker('slave-monitor', async (job) => { console.log(`Processing job ${job.id} on slave-monitor`); }, { connection });
  const backWorker = new Worker('backup', async (job) => { console.log(`Processing job ${job.id} on backup`); }, { connection });

  console.log('All BullMQ system backend workers listening gracefully...');
};
