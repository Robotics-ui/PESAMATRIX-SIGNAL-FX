import { Queue, Worker, QueueScheduler } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
export const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const QUEUE_NAMES = {
  PROVIDER_EVENT: 'provider-event',
  COPY_TRADE: 'copy-trade',
  MODIFY_TRADE: 'modify-trade',
  CLOSE_TRADE: 'close-trade',
  RECONCILE_STATE: 'reconcile-state',
  SLAVE_MONITOR: 'slave-monitor',
  ANALYTICS: 'analytics',
} as const;

export const defaultJobOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s, 4s, 8s, 16s, 32s
  },
  removeOnComplete: { maxCount: 1000 },
  removeOnFail: { maxCount: 5000 },
};

// Intialize Queues
export const providerEventQueue = new Queue(QUEUE_NAMES.PROVIDER_EVENT, { connection: redisConnection, defaultJobOptions });
export const copyTradeQueue = new Queue(QUEUE_NAMES.COPY_TRADE, { connection: redisConnection, defaultJobOptions });
export const modifyTradeQueue = new Queue(QUEUE_NAMES.MODIFY_TRADE, { connection: redisConnection, defaultJobOptions });
export const closeTradeQueue = new Queue(QUEUE_NAMES.CLOSE_TRADE, { connection: redisConnection, defaultJobOptions });
export const reconcileStateQueue = new Queue(QUEUE_NAMES.RECONCILE_STATE, { connection: redisConnection, defaultJobOptions });
export const slaveMonitorQueue = new Queue(QUEUE_NAMES.SLAVE_MONITOR, { connection: redisConnection, defaultJobOptions });
export const analyticsQueue = new Queue(QUEUE_NAMES.ANALYTICS, { connection: redisConnection, defaultJobOptions });
