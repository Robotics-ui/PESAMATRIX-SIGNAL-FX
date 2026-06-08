import { Response } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db/connection.js';
import { masterAccounts } from '../../lib/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middlewares/auth.js';

function requireAdmin(req: AuthenticatedRequest, res: Response): boolean {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required.' });
    return false;
  }
  return true;
}

const accountSchema = z.object({
  providerName: z.string().min(1),
  mt5Login: z.string().min(1),
  brokerName: z.string().min(1),
  serverName: z.string().min(1),
  strategyDescription: z.string().optional().nullable(),
  riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  winRate: z.number().min(0).max(100).default(0),
  totalTrades: z.number().int().min(0).default(0),
  monthlyReturn: z.number().default(0),
  maxDrawdown: z.number().min(0).max(100).default(0),
  status: z.enum(['active', 'disabled']).default('active'),
});

function toDbValues(parsed: Partial<z.infer<typeof accountSchema>>) {
  const out: Record<string, any> = { ...parsed };
  if (parsed.winRate !== undefined) out.winRate = String(parsed.winRate);
  if (parsed.monthlyReturn !== undefined) out.monthlyReturn = String(parsed.monthlyReturn);
  if (parsed.maxDrawdown !== undefined) out.maxDrawdown = String(parsed.maxDrawdown);
  return out;
}

export async function listMasterAccounts(_req: AuthenticatedRequest, res: Response) {
  try {
    const rows = await db.select().from(masterAccounts)
      .where(eq(masterAccounts.status, 'active'))
      .orderBy(desc(masterAccounts.createdAt));
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function adminListMasterAccounts(req: AuthenticatedRequest, res: Response) {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await db.select().from(masterAccounts).orderBy(desc(masterAccounts.createdAt));
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function createMasterAccount(req: AuthenticatedRequest, res: Response) {
  if (!requireAdmin(req, res)) return;
  try {
    const parsed = accountSchema.parse(req.body);
    const [account] = await db.insert(masterAccounts).values(toDbValues(parsed) as any).returning();
    return res.status(201).json(account);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function updateMasterAccount(req: AuthenticatedRequest, res: Response) {
  if (!requireAdmin(req, res)) return;
  try {
    const { id } = req.params as { id: string };
    const parsed = accountSchema.partial().parse(req.body);
    const updateData = { ...toDbValues(parsed), updatedAt: new Date() };
    const [updated] = await db.update(masterAccounts).set(updateData).where(eq(masterAccounts.id, id)).returning();
    if (!updated) return res.status(404).json({ error: 'Master account not found.' });
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function deleteMasterAccount(req: AuthenticatedRequest, res: Response) {
  if (!requireAdmin(req, res)) return;
  try {
    const { id } = req.params as { id: string };
    await db.delete(masterAccounts).where(eq(masterAccounts.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
