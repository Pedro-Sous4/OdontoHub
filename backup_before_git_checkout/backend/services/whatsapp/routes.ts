import { Router } from 'express';
import { enqueueWhatsAppReminder } from '../../queues/jobs.js';
import { query } from '../../server/common/db.js';
import { AuthRequest } from '../../server/common/types.js';
import { connectSession, disconnectSession, getSessionSnapshot, sendTenantMessage } from './manager.js';

export const whatsappRouter = Router();

whatsappRouter.get('/conversations', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;

  const result = await query(
    `SELECT ml.patient_id,
            p.nome AS patient_name,
            p.telefone AS phone,
            MAX(ml.created_at) AS last_message_at,
            (ARRAY_AGG(ml.mensagem ORDER BY ml.created_at DESC))[1] AS last_message,
            COUNT(*)::int AS total_messages
     FROM message_logs ml
     JOIN patients p ON p.id = ml.patient_id AND p.tenant_id = ml.tenant_id
     WHERE ml.tenant_id = $1
       AND ml.canal = 'whatsapp'
       AND ml.patient_id IS NOT NULL
       AND ml.status_envio IN ('sent', 'failed')
     GROUP BY ml.patient_id, p.nome, p.telefone
     ORDER BY last_message_at DESC`,
    [tenantId]
  );

  return res.json(result.rows);
});

whatsappRouter.get('/conversations/:patientId/messages', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { patientId } = req.params;

  const result = await query(
    `SELECT id,
            tenant_id,
            patient_id,
            appointment_id,
            canal,
            mensagem,
            status_envio,
            created_at
     FROM message_logs
     WHERE tenant_id = $1
       AND canal = 'whatsapp'
       AND patient_id = $2
     ORDER BY created_at ASC`,
    [tenantId, patientId]
  );

  return res.json(result.rows);
});

whatsappRouter.get('/sessions', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const sessions = await query('SELECT id, tenant_id, phone_number, status, last_seen FROM whatsapp_sessions WHERE tenant_id = $1', [tenantId]);
  return res.json(sessions.rows);
});

whatsappRouter.post('/sessions/connect', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { phoneNumber } = req.body;

  const session = await connectSession(tenantId, phoneNumber);
  return res.status(201).json(session);
});

whatsappRouter.get('/sessions/status', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  return res.json(getSessionSnapshot(tenantId));
});

whatsappRouter.post('/sessions/disconnect', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const result = await disconnectSession(tenantId);
  return res.json(result);
});

whatsappRouter.get('/health', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const session = getSessionSnapshot(tenantId);
  return res.json({
    status: session.status,
    tenantId,
    lastSeen: session.lastSeen
  });
});

whatsappRouter.post('/send', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { phoneNumber, patientId, appointmentId, message } = req.body;

  await enqueueWhatsAppReminder({
    tenantId,
    phoneNumber,
    patientId,
    appointmentId,
    message
  });

  return res.status(202).json({ message: 'Mensagem enfileirada' });
});

whatsappRouter.post('/send-now', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { phoneNumber, patientId, appointmentId, message } = req.body;

  try {
    await sendTenantMessage(tenantId, phoneNumber, message);
    await query(
      `INSERT INTO message_logs (tenant_id, patient_id, appointment_id, canal, mensagem, status_envio)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, patientId ?? null, appointmentId ?? null, 'whatsapp', message, 'sent']
    );
    return res.json({ message: 'Mensagem enviada' });
  } catch {
    await query(
      `INSERT INTO message_logs (tenant_id, patient_id, appointment_id, canal, mensagem, status_envio)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, patientId ?? null, appointmentId ?? null, 'whatsapp', message, 'failed']
    );
    return res.status(409).json({ message: 'Sessão não conectada ou envio falhou' });
  }
});
