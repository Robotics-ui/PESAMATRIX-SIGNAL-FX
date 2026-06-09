import { Response } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db/connection.js';
import { users, subscriptions, trades, tradeLogs, mt5Accounts } from '../../lib/db/schema.js';
import { eq, desc, count } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middlewares/auth.js';

function requireAdmin(req: AuthenticatedRequest, res: Response): boolean {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required.' });
    return false;
  }
  return true;
}

// GET /api/admin/users
export async function listUsers(req: AuthenticatedRequest, res: Response) {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        phoneNumber: users.phoneNumber,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/users/:id
export async function getUser(req: AuthenticatedRequest, res: Response) {
  if (!requireAdmin(req, res)) return;
  try {
    const { id } = req.params as { id: string };
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    const { passwordHash: _, ...safe } = rows[0];
    return res.json(safe);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/users/:id
export async function updateUser(req: AuthenticatedRequest, res: Response) {
  if (!requireAdmin(req, res)) return;
  const schema = z.object({
    fullName: z.string().min(2).optional(),
    role: z.enum(['admin', 'provider', 'user']).optional(),
    isActive: z.boolean().optional(),
    phoneNumber: z.string().min(10).optional(),
  });
  try {
    const { id } = req.params as { id: string };
    const parsed = schema.parse(req.body);
    const [updated] = await db
      .update(users)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        phoneNumber: users.phoneNumber,
        role: users.role,
        isActive: users.isActive,
        updatedAt: users.updatedAt,
      });
    if (!updated) return res.status(404).json({ error: 'User not found.' });
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

// DELETE /api/admin/users/:id
export async function deleteUser(req: AuthenticatedRequest, res: Response) {
  if (!requireAdmin(req, res)) return;
  try {
    const { id } = req.params as { id: string };
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }
    await db.delete(users).where(eq(users.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/stats
export async function getAdminStats(req: AuthenticatedRequest, res: Response) {
  if (!requireAdmin(req, res)) return;
  try {
    const [
      [{ total: totalUsers }],
      [{ total: totalAccounts }],
      activeSubs,
      [{ total: totalTrades }],
    ] = await Promise.all([
      db.select({ total: count() }).from(users),
      db.select({ total: count() }).from(mt5Accounts),
      db.select({ total: count() }).from(subscriptions).where(eq(subscriptions.status, 'active')),
      db.select({ total: count() }).from(trades),
    ]);

    const activeSubscriptions = activeSubs[0]?.total ?? 0;

    return res.json({
      totalUsers,
      totalAccounts,
      activeSubscriptions,
      totalTrades,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
