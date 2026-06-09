import { Response } from 'express';
import { db } from '../../lib/db/connection.js';
import {
  subscriptions,
  subscriptionPlans,
  userProviderSubscriptions,
  masterAccounts,
  mt5Accounts,
  trades,
  tradeLogs,
  followerAccounts,
} from '../../lib/db/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middlewares/auth.js';

async function getActiveSubscription(userId: string) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!rows.length) return null;
  const sub = rows[0];
  if (new Date() > sub.expiresAt) {
    await db
      .update(subscriptions)
      .set({ status: 'expired' })
      .where(eq(subscriptions.id, sub.id));
    return null;
  }
  return sub;
}

function daysRemaining(expiresAt: Date): number {
  return Math.max(
    0,
    Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
}

// GET /api/dashboard/overview
export async function getDashboardOverview(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;

    const [sub, userAccountRows, followerRows, providerSubRows] = await Promise.all([
      getActiveSubscription(userId),
      db.select().from(mt5Accounts).where(eq(mt5Accounts.userId, userId)),
      db.select().from(followerAccounts).where(eq(followerAccounts.userId, userId)),
      db
        .select({
          id: userProviderSubscriptions.id,
          masterAccountId: userProviderSubscriptions.masterAccountId,
          startedAt: userProviderSubscriptions.startedAt,
          providerName: masterAccounts.providerName,
          brokerName: masterAccounts.brokerName,
          winRate: masterAccounts.winRate,
          monthlyReturn: masterAccounts.monthlyReturn,
          riskLevel: masterAccounts.riskLevel,
        })
        .from(userProviderSubscriptions)
        .innerJoin(masterAccounts, eq(userProviderSubscriptions.masterAccountId, masterAccounts.id))
        .where(
          and(
            eq(userProviderSubscriptions.userId, userId),
            eq(userProviderSubscriptions.isActive, true)
          )
        )
        .limit(1),
    ]);

    let recentTradeCount = 0;
    let recentTrades: any[] = [];

    if (followerRows.length > 0) {
      const followerIds = followerRows.map((f) => f.id);
      const logs = await db
        .select({
          id: tradeLogs.id,
          action: tradeLogs.action,
          volume: tradeLogs.volume,
          createdAt: tradeLogs.createdAt,
          symbol: trades.symbol,
          type: trades.type,
          status: trades.status,
        })
        .from(tradeLogs)
        .innerJoin(trades, eq(tradeLogs.tradeId, trades.id))
        .where(inArray(tradeLogs.followerAccountId, followerIds))
        .orderBy(desc(tradeLogs.createdAt))
        .limit(5);

      recentTradeCount = logs.length;
      recentTrades = logs;
    }

    return res.json({
      subscription: sub
        ? {
            status: sub.status,
            tradingDays: sub.tradingDays,
            daysRemaining: daysRemaining(sub.expiresAt),
            startsAt: sub.startsAt,
            expiresAt: sub.expiresAt,
            totalAmount: sub.totalAmount,
          }
        : null,
      activeProvider: providerSubRows[0] || null,
      accountsCount: userAccountRows.length,
      recentTradeCount,
      recentTrades,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/providers
export async function getProviders(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;

    const [allProviders, activeSub] = await Promise.all([
      db
        .select()
        .from(masterAccounts)
        .where(eq(masterAccounts.status, 'active'))
        .orderBy(desc(masterAccounts.createdAt)),
      db
        .select({ masterAccountId: userProviderSubscriptions.masterAccountId })
        .from(userProviderSubscriptions)
        .where(
          and(
            eq(userProviderSubscriptions.userId, userId),
            eq(userProviderSubscriptions.isActive, true)
          )
        )
        .limit(1),
    ]);

    const subscribedId = activeSub[0]?.masterAccountId ?? null;

    const result = allProviders.map((p) => ({
      ...p,
      isSubscribed: p.id === subscribedId,
    }));

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/accounts
export async function getAccounts(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;

    const rows = await db
      .select({
        id: mt5Accounts.id,
        accountName: mt5Accounts.accountName,
        login: mt5Accounts.login,
        server: mt5Accounts.server,
        platform: mt5Accounts.platform,
        connectionStatus: mt5Accounts.connectionStatus,
        createdAt: mt5Accounts.createdAt,
      })
      .from(mt5Accounts)
      .where(eq(mt5Accounts.userId, userId))
      .orderBy(desc(mt5Accounts.createdAt));

    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/trades
export async function getTrades(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;

    const followerRows = await db
      .select()
      .from(followerAccounts)
      .where(eq(followerAccounts.userId, userId));

    if (!followerRows.length) {
      return res.json([]);
    }

    const followerIds = followerRows.map((f) => f.id);

    const rows = await db
      .select({
        logId: tradeLogs.id,
        action: tradeLogs.action,
        volume: tradeLogs.volume,
        executionLatencyMs: tradeLogs.executionLatencyMs,
        errorMessage: tradeLogs.errorMessage,
        createdAt: tradeLogs.createdAt,
        followerPositionId: tradeLogs.followerPositionId,
        tradeId: trades.id,
        symbol: trades.symbol,
        type: trades.type,
        masterVolume: trades.volume,
        openPrice: trades.openPrice,
        closePrice: trades.closePrice,
        status: trades.status,
        openedAt: trades.openedAt,
        closedAt: trades.closedAt,
      })
      .from(tradeLogs)
      .innerJoin(trades, eq(tradeLogs.tradeId, trades.id))
      .where(inArray(tradeLogs.followerAccountId, followerIds))
      .orderBy(desc(tradeLogs.createdAt))
      .limit(100);

    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/billing/subscription
export async function getBillingSubscription(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;

    const sub = await getActiveSubscription(userId);

    const history = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(10);

    const remaining = sub ? daysRemaining(sub.expiresAt) : 0;

    return res.json({
      active: sub
        ? {
            id: sub.id,
            status: sub.status,
            tradingDays: sub.tradingDays,
            totalAmount: sub.totalAmount,
            startsAt: sub.startsAt,
            expiresAt: sub.expiresAt,
            daysRemaining: remaining,
          }
        : null,
      history: history.map((s) => ({
        id: s.id,
        status: s.status,
        tradingDays: s.tradingDays,
        totalAmount: s.totalAmount,
        startsAt: s.startsAt,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/plans
export async function getPlans(_req: AuthenticatedRequest, res: Response) {
  try {
    const rows = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.durationDays);

    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
