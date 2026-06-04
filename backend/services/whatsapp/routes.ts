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
       AND ml.status_envio IN ('sent', 'failed', 'received')
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
            media_url,
            mimetype,
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

whatsappRouter.get('/terms', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  try {
    const result = await query(
      'SELECT * FROM whatsapp_terms_agreements WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    if (result.rows.length > 0) {
      res.json({ signed: true, terms: result.rows });
    } else {
      res.json({ signed: false, terms: [] });
    }
  } catch (error) {
    console.error('Error fetching terms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

whatsappRouter.post('/terms', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { responsavel_nome, responsavel_cpf, data_nascimento, signature_base64 } = req.body;
  
  if (!responsavel_nome || !responsavel_cpf || !signature_base64) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const dataNasc = data_nascimento ? data_nascimento : null;
    const result = await query(
      `INSERT INTO whatsapp_terms_agreements 
       (tenant_id, responsavel_nome, responsavel_cpf, data_nascimento, signature_base64) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, responsavel_nome, responsavel_cpf, dataNasc, signature_base64]
    );
    res.json({ success: true, termId: result.rows[0].id });
  } catch (error) {
    console.error('Error saving terms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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

import { uploadWhatsAppMedia } from '../../server/common/storage.js';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import { sendTenantMediaMessage } from './manager.js';

whatsappRouter.post('/send-media', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { phoneNumber, patientId, appointmentId, message, mediaBase64, mimetype, filename } = req.body;

  const session = getSessionSnapshot(tenantId);
  if (session.status !== 'connected') {
    return res.status(409).json({ message: 'WhatsApp não está conectado' });
  }

  let mediaUrl = null;

  try {
    const media = new MessageMedia(mimetype, mediaBase64, filename);
    
    // Upload to our S3 storage
    const uploaded = await uploadWhatsAppMedia({
      tenantId,
      filename,
      contentType: mimetype,
      data: Buffer.from(mediaBase64, 'base64')
    });
    mediaUrl = uploaded.key;

    // Send via WhatsApp
    await sendTenantMediaMessage(tenantId, phoneNumber, message, media);

    // Save to DB
    await query(
      `INSERT INTO message_logs (tenant_id, patient_id, appointment_id, canal, mensagem, status_envio, media_url, mimetype)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, patientId ?? null, appointmentId ?? null, 'whatsapp', message || '', 'sent', mediaUrl, mimetype]
    );

    return res.json({ message: 'Mídia enviada' });
  } catch (error) {
    console.error(error);
    await query(
      `INSERT INTO message_logs (tenant_id, patient_id, appointment_id, canal, mensagem, status_envio, media_url, mimetype)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, patientId ?? null, appointmentId ?? null, 'whatsapp', message || '', 'failed', mediaUrl, mimetype]
    );
    return res.status(500).json({ message: 'Erro ao enviar mídia' });
  }
});

whatsappRouter.get('/patients/:patientId/assistant', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { patientId } = req.params;

  try {
    const result = await query<{ assistant_disabled_until: string | null }>(
      'SELECT assistant_disabled_until FROM patients WHERE tenant_id = $1 AND id = $2',
      [tenantId, patientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    const disabledUntil = result.rows[0].assistant_disabled_until;
    const isSilenced = disabledUntil ? new Date() < new Date(disabledUntil) : false;

    return res.json({ isSilenced, disabledUntil });
  } catch (error) {
    console.error('Error fetching assistant status:', error);
    return res.status(500).json({ message: 'Erro interno' });
  }
});

whatsappRouter.post('/patients/:patientId/assistant/toggle', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { patientId } = req.params;
  const { silence } = req.body;

  try {
    let disabledUntil = null;
    if (silence) {
      // Mute for 1 year or until manual activation
      disabledUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    }

    await query(
      'UPDATE patients SET assistant_disabled_until = $1 WHERE tenant_id = $2 AND id = $3',
      [disabledUntil, tenantId, patientId]
    );

    return res.json({ success: true, isSilenced: silence, disabledUntil });
  } catch (error) {
    console.error('Error toggling assistant status:', error);
    return res.status(500).json({ message: 'Erro interno' });
  }
});
