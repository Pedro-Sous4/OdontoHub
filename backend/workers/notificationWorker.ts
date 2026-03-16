import { Worker } from 'bullmq';
import { config } from '../server/common/config.js';
import { query } from '../server/common/db.js';
import { enqueueWhatsAppReminder } from '../queues/jobs.js';

const redisConnection = { url: config.redisUrl };

export function createNotificationWorker() {
  return new Worker(
    'notification-queue',
    async (job) => {
      const { tenantId, eventId, channel, recipient, subject, body } = job.data as {
        tenantId: string;
        eventId: string;
        channel: 'whatsapp' | 'email' | 'sms';
        recipient: string;
        subject?: string;
        body: string;
      };

      let status = 'sent';
      let errorMessage: string | null = null;

      try {
        if (channel === 'whatsapp') {
          await enqueueWhatsAppReminder({
            tenantId,
            phoneNumber: recipient,
            patientId: '',
            appointmentId: '',
            message: body
          });
        }
      } catch (error) {
        status = 'failed';
        errorMessage = error instanceof Error ? error.message : 'unknown_error';
      }

      await query('UPDATE notification_events SET status = $1 WHERE id = $2 AND tenant_id = $3', [status, eventId, tenantId]);

      await query(
        `INSERT INTO notification_deliveries (tenant_id, event_id, channel, recipient, status, error_message, delivered_at)
         VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $5 = 'sent' THEN NOW() ELSE NULL END)`,
        [tenantId, eventId, channel, recipient, status, errorMessage]
      );

      if (status === 'failed') {
        await query(
          `INSERT INTO notification_failures (tenant_id, event_id, reason, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [tenantId, eventId, errorMessage]
        );
      }

      return { ok: status === 'sent', subject };
    },
    { connection: redisConnection, concurrency: 200 }
  );
}
