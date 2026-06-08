import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../../config/env.js';

export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const defaultQueueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 }
  }
};

export const accountSyncQueue = new Queue('account-sync', defaultQueueOptions);
export const copyTradeQueue = new Queue('copy-trade', defaultQueueOptions);
export const providerEventQueue = new Queue('provider-event', defaultQueueOptions);
export const notificationQueue = new Queue('notification', defaultQueueOptions);
export const analyticsQueue = new Queue('analytics', defaultQueueOptions);
export const slaveMonitorQueue = new Queue('slave-monitor', defaultQueueOptions);
export const backupQueue = new Queue('backup', defaultQueueOptions);
