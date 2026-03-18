import { Worker } from 'bullmq';
import { config } from '../../server/common/config.js';
import { query } from '../../server/common/db.js';
import { sendTenantMessage } from './manager.js';

const redisConnection = { url: config.redisUrl };

export function createWhatsAppQueueWorker() {
  return new Worker(
    'whatsapp-queue',
    async (job) => {
      const { tenantId, phoneNumber, patientId, appointmentId, message } = job.data as {
        tenantId: string;
        phoneNumber: string;
        patientId: string;
        appointmentId: string;
        message: string;
      };

      let status = 'sent';
      try {
        await sendTenantMessage(tenantId, phoneNumber, message);
      } catch {
        status = 'failed';
      }

      await query(
        `INSERT INTO message_logs (tenant_id, patient_id, appointment_id, canal, mensagem, status_envio)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, patientId ?? null, appointmentId ?? null, 'whatsapp', message, status]
      );

      return { ok: status === 'sent' };
    },
    { connection: redisConnection, concurrency: 100 }
  );
}
