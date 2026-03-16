import { Worker } from 'bullmq';
import { query } from '../server/common/db.js';
import { config } from '../server/common/config.js';

const redisConnection = { url: config.redisUrl };

export function createGoogleSyncWorker() {
  return new Worker(
    'google-sync-queue',
    async (job) => {
      const { tenantId, appointmentId } = job.data as { tenantId: string; appointmentId: string };

      const googleEventId = `gcal_${appointmentId}_${Date.now()}`;

      await query('UPDATE appointments SET google_event_id = $1 WHERE id = $2 AND tenant_id = $3', [
        googleEventId,
        appointmentId,
        tenantId
      ]);

      return { ok: true, googleEventId };
    },
    { connection: redisConnection, concurrency: 50 }
  );
}
