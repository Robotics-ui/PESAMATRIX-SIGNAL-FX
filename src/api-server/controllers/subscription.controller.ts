import { Response } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db/connection.js';
import { subscriptionSettings, subscriptions, userProviderSubscriptions, masterAccounts } from '../../lib/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middlewares/auth.js';

function addTradingDays(start: Date, days: number): Date {
  const d = new Date(start);
  let count = 0;
  while (count < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) count++;
  }
  return d;
}

async function getActiveSubscription(userId: string) {
  const rows = await db.select().from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!rows.length) return null;

  const sub = rows[0];
  if (new Date() > sub.expiresAt) {
    await db.update(subscriptions).set({ status: 'expired' }).where(eq(subscriptions.id, sub.id));
    return null;
  }
  return sub;
}

export async function getSettings(_req: AuthenticatedRequest, res: Response) {
  try {
    const rows = await db.select().from(subscriptionSettings).limit(1);
    if (!rows.length) return res.json({ feePerDay: '500.00', minDays: 5, maxDays: 60, isActive: false });
    return res.json(rows[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function purchaseSubscription(req: AuthenticatedRequest, res: Response) {
  const schema = z.object({
    tradingDays: z.number().int().positive(),
    phoneNumber: z.string().min(10),
  });

  try {
    const parsed = schema.parse(req.body);

    const settings = await db.select().from(subscriptionSettings).limit(1);
    if (!settings.length || !settings[0].isActive) {
      return res.status(400).json({ error: 'Subscriptions are not currently available.' });
    }

    const s = settings[0];
    if (parsed.tradingDays < s.minDays || parsed.tradingDays > s.maxDays) {
      return res.status(400).json({
        error: `Trading days must be between ${s.minDays} and ${s.maxDays}.`
      });
    }

    const now = new Date();
    const expiresAt = addTradingDays(now, parsed.tradingDays);
    const totalAmount = (parseFloat(s.feePerDay) * parsed.tradingDays).toFixed(2);

    await db.update(subscriptions)
      .set({ status: 'expired' })
      .where(and(eq(subscriptions.userId, req.user!.id), eq(subscriptions.status, 'active')));

    const [sub] = await db.insert(subscriptions).values({
      userId: req.user!.id,
      planId: null,
      tradingDays: parsed.tradingDays,
      totalAmount,
      startsAt: now,
      expiresAt,
      status: 'active',
    }).returning();

    return res.status(201).json({ subscription: sub, expiresAt, totalAmount });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function getMySubscription(req: AuthenticatedRequest, res: Response) {
  try {
    const sub = await getActiveSubscription(req.user!.id);

    let providerSub = null;
    if (sub) {
      const provRows = await db.select({
        id: userProviderSubscriptions.id,
        masterAccountId: userProviderSubscriptions.masterAccountId,
        startedAt: userProviderSubscriptions.startedAt,
        providerName: masterAccounts.providerName,
        brokerName: masterAccounts.brokerName,
        serverName: masterAccounts.serverName,
        riskLevel: masterAccounts.riskLevel,
        winRate: masterAccounts.winRate,
        monthlyReturn: masterAccounts.monthlyReturn,
      })
        .from(userProviderSubscriptions)
        .innerJoin(masterAccounts, eq(userProviderSubscriptions.masterAccountId, masterAccounts.id))
        .where(and(
          eq(userProviderSubscriptions.userId, req.user!.id),
          eq(userProviderSubscriptions.isActive, true)
        ))
        .limit(1);

      providerSub = provRows[0] || null;
    }

    const now = new Date();
    const daysRemaining = sub
      ? Math.max(0, Math.ceil((sub.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    return res.json({ subscription: sub, providerSubscription: providerSub, daysRemaining });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function subscribeToProvider(req: AuthenticatedRequest, res: Response) {
  const schema = z.object({ masterAccountId: z.string().uuid() });

  try {
    const { masterAccountId } = schema.parse(req.body);

    const sub = await getActiveSubscription(req.user!.id);
    if (!sub) {
      return res.status(403).json({ error: 'An active subscription is required to select a provider.' });
    }

    const maRows = await db.select().from(masterAccounts)
      .where(and(eq(masterAccounts.id, masterAccountId), eq(masterAccounts.status, 'active')))
      .limit(1);
    if (!maRows.length) return res.status(404).json({ error: 'Provider not found or inactive.' });

    await db.update(userProviderSubscriptions)
      .set({ isActive: false })
      .where(and(
        eq(userProviderSubscriptions.userId, req.user!.id),
        eq(userProviderSubscriptions.isActive, true)
      ));

    const [pSub] = await db.insert(userProviderSubscriptions).values({
      userId: req.user!.id,
      masterAccountId,
      isActive: true,
    }).returning();

    return res.status(201).json(pSub);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function unsubscribeFromProvider(req: AuthenticatedRequest, res: Response) {
  try {
    await db.update(userProviderSubscriptions)
      .set({ isActive: false })
      .where(and(
        eq(userProviderSubscriptions.userId, req.user!.id),
        eq(userProviderSubscriptions.isActive, true)
      ));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
