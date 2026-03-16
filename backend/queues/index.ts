import { Queue } from 'bullmq';
import { config } from '../server/common/config.js';

const redisConnection = { url: config.redisUrl };

export const googleSyncQueue = new Queue('google-sync-queue', { connection: redisConnection });
export const whatsappQueue = new Queue('whatsapp-queue', { connection: redisConnection });
export const notificationQueue = new Queue('notification-queue', { connection: redisConnection });
