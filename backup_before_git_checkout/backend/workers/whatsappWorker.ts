import { Worker } from 'bullmq';
import { Client, LocalAuth } from 'whatsapp-web.js';
import { query } from '../server/common/db.js';
import { config } from '../server/common/config.js';

const redisConnection = { url: config.redisUrl };

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.initialize().catch(() => undefined);

setInterval(async () => {
  await query('UPDATE whatsapp_sessions SET last_seen = NOW() WHERE status = $1', ['connected']);
}, 5 * 60 * 1000);

export function createWhatsAppWorker() {
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

      const chatId = `${phoneNumber.replace(/\D/g, '')}@c.us`;
      let status = 'sent';

      try {
        await client.sendMessage(chatId, message);
      } catch {
        status = 'failed';
      }

      await query(
        `INSERT INTO message_logs (tenant_id, patient_id, appointment_id, canal, mensagem, status_envio)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, patientId, appointmentId, 'whatsapp', message, status]
      );

      return { ok: status === 'sent' };
    },
    { connection: redisConnection, concurrency: 100 }
  );
}
