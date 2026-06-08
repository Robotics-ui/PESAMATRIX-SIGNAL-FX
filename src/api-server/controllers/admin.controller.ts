import { Response } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db/connection.js';
import { subscriptionSettings } from '../../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middlewares/auth.js';

function requireAdmin(req: AuthenticatedRequest, res: Response): boolean {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required.' });
    return false;
  }
  return true;
}

export async function getSubscriptionSettings(_req: AuthenticatedRequest, res: Response) {
  try {
    const rows = await db.select().from(subscriptionSettings).limit(1);
    if (!rows.length) {
      return res.json({ feePerDay: '500.00', minDays: 5, maxDays: 60, isActive: true });
    }
    return res.json(rows[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function updateSubscriptionSettings(req: AuthenticatedRequest, res: Response) {
  if (!requireAdmin(req, res)) return;

  const schema = z.object({
    feePerDay: z.number().positive('Fee must be positive'),
    minDays: z.number().int().min(1, 'Minimum 1 day'),
    maxDays: z.number().int().min(1, 'Minimum 1 day'),
    isActive: z.boolean(),
  }).refine(d => d.maxDays >= d.minDays, {
    message: 'Maximum days must be >= minimum days',
    path: ['maxDays'],
  });

  try {
    const parsed = schema.parse(req.body);
    const rows = await db.select().from(subscriptionSettings).limit(1);

    let result;
    if (!rows.length) {
      [result] = await db.insert(subscriptionSettings).values({
        feePerDay: String(parsed.feePerDay),
        minDays: parsed.minDays,
        maxDays: parsed.maxDays,
        isActive: parsed.isActive,
        updatedAt: new Date(),
      }).returning();
    } else {
      [result] = await db.update(subscriptionSettings)
        .set({
          feePerDay: String(parsed.feePerDay),
          minDays: parsed.minDays,
          maxDays: parsed.maxDays,
          isActive: parsed.isActive,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionSettings.id, rows[0].id))
        .returning();
    }

    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}
