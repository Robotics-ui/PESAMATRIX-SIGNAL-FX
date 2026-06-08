import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../lib/db/connection';
import { tradeLinks, systemAuditLogs, providerAnalytics } from '../../lib/db/schema';
import { copyTradeQueue, modifyTradeQueue, closeTradeQueue, slaveMonitorQueue } from '../../lib/queue/config';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Structural Admin Route Role Authentication Guard Middleware
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  // Provided context assumed parsed previously inside Session/JWT strategy context bounds
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access Denied. Resource restricted to system administrative protocols.' });
  }
  next();
};

router.use(isAdmin);

/**
 * GET /api/admin/sync/mappings
 * Fetch all tracked trade relationship records
 */
router.get('/sync/mappings', async (req: Request, res: Response) => {
  try {
    const limits = z.coerce.number().default(50).parse(req.query.limit);
    const records = await db.select().from(tradeLinks).orderBy(desc(tradeLinks.createdAt)).limit(limits);
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/sync/reports
 * Fetch active error/repair self-healing logs
 */
router.get('/sync/reports', async (req: Request, res: Response) => {
  try {
    const reports = await db.select().from(systemAuditLogs).orderBy(desc(systemAuditLogs.createdAt)).limit(100);
    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/sync/jobs/retry
 * Re-trigger specific failed job manually inside operational pipeline lines
 */
router.post('/sync/jobs/retry', async (req: Request, res: Response) => {
  const schema = z.object({
    queueType: z.enum(['copy', 'modify', 'close']),
    payload: z.any()
  });

  try {
    const { queueType, payload } = schema.parse(req.body);
    
    if (queueType === 'copy') await copyTradeQueue.add('manual-retry', payload);
    if (queueType === 'modify') await modifyTradeQueue.add('manual-retry', payload);
    if (queueType === 'close') await closeTradeQueue.add('manual-retry', payload);

    res.json({ status: 'success', message: 'Target task queued into background stream context infrastructure chains' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/admin/sync/trigger-audit
 * Manually force execution cycle across slave monitor worker loops
 */
router.post('/sync/trigger-audit', async (req: Request, res: Response) => {
  try {
    await slaveMonitorQueue.add('manual
