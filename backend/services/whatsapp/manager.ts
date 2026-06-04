import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import axios from 'axios';
import qrcode from 'qrcode';
import { query } from '../../server/common/db.js';
import { uploadWhatsAppMedia } from '../../server/common/storage.js';
import { signJwt } from '../../server/common/auth.js';
import { WhatsAppSessionSnapshot, WhatsAppSessionStatus } from './types.js';

type SocketNotifier = (tenantId: string, event: string, payload: unknown) => void;

type SessionContext = {
  tenantId: string;
  phoneNumber: string;
  client: any;
  status: WhatsAppSessionStatus;
  lastSeen?: string;
  qrCode?: string;
  initialized: boolean;
};

const sessions = new Map<string, SessionContext>();
let socketNotifier: SocketNotifier = () => undefined;

function buildClient(tenantId: string) {
  return new Client({
    authStrategy: new LocalAuth({
      clientId: `tenant-${tenantId}`,
      dataPath: '.wwebjs_auth'
    }),
    puppeteer: {
      headless: true,
      executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }
  });
}

async function persistStatus(tenantId: string, phoneNumber: string, status: WhatsAppSessionStatus) {
  const existing = await query<{ id: string }>(
    'SELECT id FROM whatsapp_sessions WHERE tenant_id = $1 ORDER BY last_seen DESC NULLS LAST LIMIT 1',
    [tenantId]
  );

  if (existing.rows[0]) {
    await query(
      'UPDATE whatsapp_sessions SET phone_number = $1, status = $2, last_seen = NOW() WHERE id = $3',
      [phoneNumber, status, existing.rows[0].id]
    );
    return;
  }

  await query(
    `INSERT INTO whatsapp_sessions (tenant_id, phone_number, status, last_seen)
     VALUES ($1, $2, $3, NOW())`,
    [tenantId, phoneNumber, status]
  );
}

async function setStatus(tenantId: string, status: WhatsAppSessionStatus, qrCode?: string) {
  const session = sessions.get(tenantId);
  if (!session) {
    return;
  }

  session.status = status;
  session.lastSeen = new Date().toISOString();
  if (qrCode) {
    session.qrCode = qrCode;
  }

  await persistStatus(tenantId, session.phoneNumber, status);
  socketNotifier(tenantId, 'whatsapp-status', {
    tenantId,
    status,
    lastSeen: session.lastSeen
  });

  if (qrCode) {
    socketNotifier(tenantId, 'whatsapp-qr', {
      tenantId,
      qrCode
    });
  }
}

async function attachClientEvents(session: SessionContext) {
  session.client.on('qr', async (qr: string) => {
    const qrCode = await qrcode.toDataURL(qr);
    await setStatus(session.tenantId, 'pending_qr', qrCode);
  });

  session.client.on('authenticated', async () => {
    await setStatus(session.tenantId, 'authenticated');
  });

  session.client.on('ready', async () => {
    if (session.client.info && session.client.info.wid) {
      session.phoneNumber = session.client.info.wid.user;
    }
    await setStatus(session.tenantId, 'connected');
  });

  session.client.on('disconnected', async () => {
    await setStatus(session.tenantId, 'disconnected');
    await reconnectSession(session.tenantId);
  });

  session.client.on('message', async (msg: any) => {
    await handleIncomingMessage(session.tenantId, msg, false);
  });

  session.client.on('message_create', async (msg: any) => {
    if (msg.fromMe) {
      // Ignorar mensagens de sistema/grupos se necessário, mas msg.to já ajuda
      if (!msg.to.includes('@g.us')) {
        await handleIncomingMessage(session.tenantId, msg, true);
      }
    }
  });
}

async function handleIncomingMessage(tenantId: string, msg: any, fromMe: boolean) {
  const rawPhone = fromMe ? msg.to : msg.from;
  const phoneNumber = rawPhone.replace(/\D/g, '').replace(/^55/, '');
  
  if (!phoneNumber) return;

  const patientRes = await query<{id: string}>(
    'SELECT id FROM patients WHERE tenant_id = $1 AND (telefone LIKE $2 OR telefone LIKE $3) LIMIT 1', 
    [tenantId, `%${phoneNumber}%`, `%${phoneNumber.slice(-8)}%`]
  );
  let patientId = patientRes.rows[0]?.id || null;

  if (!patientId && !fromMe) {
    try {
      const created = await query<{ id: string }>(
        `INSERT INTO patients (tenant_id, nome, telefone) VALUES ($1, $2, $3) RETURNING id`,
        [tenantId, 'Lead WhatsApp', phoneNumber]
      );
      patientId = created.rows[0].id;
      console.log(`[WHATSAPP] Novo lead criado: ${patientId} para o telefone ${phoneNumber}`);
    } catch (err) {
      console.error('[WHATSAPP] Erro ao criar lead:', err);
    }
  }

  let mediaUrl = null;
  let mimetype = null;

  if (msg.hasMedia) {
    try {
      const media = await msg.downloadMedia();
      if (media) {
        const ext = media.mimetype.split('/')[1]?.split(';')[0] || 'bin';
        const filename = `${Date.now()}_${msg.id.id}.${ext}`;
        const uploaded = await uploadWhatsAppMedia({
          tenantId,
          filename,
          contentType: media.mimetype,
          data: Buffer.from(media.data, 'base64')
        });
        mediaUrl = uploaded.key;
        mimetype = media.mimetype;
      }
    } catch (e) {
      console.error('Failed to download/upload media', e);
    }
  }

  const statusEnvio = fromMe ? 'sent' : 'received';

  await query(
    `INSERT INTO message_logs (tenant_id, patient_id, canal, mensagem, status_envio, media_url, mimetype, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [tenantId, patientId, 'whatsapp', msg.body || '', statusEnvio, mediaUrl, mimetype]
  );

  socketNotifier(tenantId, 'whatsapp-message', {
     patientId,
     mensagem: msg.body,
     statusEnvio,
     mediaUrl,
     mimetype
  });

  // Silenciamento da IA quando o Dentista enviar mensagem
  if (fromMe && patientId) {
    try {
      const nextApt = await query<{ end_time: string }>(
        `SELECT end_time FROM appointments 
         WHERE tenant_id = $1 AND patient_id = $2 AND status IN ('scheduled', 'confirmed') AND start_time > NOW()
         ORDER BY start_time ASC LIMIT 1`,
        [tenantId, patientId]
      );
      
      let disabledUntil: Date;
      if (nextApt.rows[0]) {
        disabledUntil = new Date(nextApt.rows[0].end_time);
        console.log(`[WHATSAPP] Silenciando IA até o fim da próxima consulta do paciente: ${disabledUntil}`);
      } else {
        disabledUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas padrão
        console.log(`[WHATSAPP] Sem consultas futuras. Silenciando IA por 24 horas: ${disabledUntil}`);
      }
      
      await query(
        'UPDATE patients SET assistant_disabled_until = $1 WHERE tenant_id = $2 AND id = $3',
        [disabledUntil.toISOString(), tenantId, patientId]
      );
    } catch (err) {
      console.error('[WHATSAPP] Erro ao silenciar IA para paciente:', err);
    }
  }

  // Integração com o Assistente OpenAI
  if (!fromMe && msg.body && patientId) {
    try {
      // Verificar se a IA está silenciada para o paciente
      const patientCheck = await query<{ assistant_disabled_until: string | null }>(
        'SELECT assistant_disabled_until FROM patients WHERE tenant_id = $1 AND id = $2',
        [tenantId, patientId]
      );
      
      const disabledUntil = patientCheck.rows[0]?.assistant_disabled_until;
      if (disabledUntil && new Date() < new Date(disabledUntil)) {
        console.log(`[WHATSAPP] IA silenciada para o paciente ${patientId} até ${disabledUntil}. Ignorando.`);
        return;
      }

      console.log('[WHATSAPP] Encaminhando mensagem para a IA...');
      const token = signJwt({ tenantId, userId: 'whatsapp-bot', role: 'admin' });

      // Busca as ultimas 5 mensagens para dar contexto
      const historyRes = await query<{canal: string, mensagem: string, status_envio: string}>(
        `SELECT canal, mensagem, status_envio FROM message_logs 
         WHERE tenant_id = $1 AND patient_id = $2 AND canal = 'whatsapp' AND mensagem IS NOT NULL AND mensagem != ''
         ORDER BY created_at DESC LIMIT 5`,
        [tenantId, patientId]
      );

      const messages = historyRes.rows.reverse().map(row => ({
        role: row.status_envio === 'received' ? 'user' : 'assistant',
        content: row.mensagem
      }));

      // Adiciona a mensagem atual caso nao tenha dado tempo do DB retornar
      if (messages.length === 0 || messages[messages.length - 1].content !== msg.body) {
        messages.push({ role: 'user', content: msg.body });
      }

      console.log(`[WHATSAPP] Enviando requisição para assistente... Msg: ${msg.body}`);
      try {
        const response = await axios.post('http://assistant-service:3011/', {
          message: msg.body,
          messages
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.data && response.data.reply) {
          console.log('[WHATSAPP] Resposta da IA gerada. Enviando para o paciente...');
          await msg.reply(response.data.reply);
        }
      } catch (axErr: any) {
        console.error('[WHATSAPP] Erro na requisição ao assistant-service:', axErr?.response?.data || axErr.message);
      }
    } catch (err) {
      console.error('[WHATSAPP] Erro ao comunicar com assistant-service:', err);
    }
  }
}

async function reconnectSession(tenantId: string) {
  const session = sessions.get(tenantId);
  if (!session) {
    return;
  }

  await setStatus(tenantId, 'reconnecting');

  try {
    session.client = buildClient(tenantId);
    await attachClientEvents(session);
    await session.client.initialize();
    session.initialized = true;
  } catch (error) {
    console.error('Puppeteer reconnect error:', error);
    await setStatus(tenantId, 'failed');
  }
}

export function setWhatsAppSocketNotifier(notifier: SocketNotifier) {
  socketNotifier = notifier;
}

export async function connectSession(tenantId: string, phoneNumber: string = '') {
  const existing = sessions.get(tenantId);
  if (existing?.initialized) {
    return snapshot(existing);
  }

  const client = buildClient(tenantId);
  const session: SessionContext = {
    tenantId,
    phoneNumber,
    client,
    status: 'reconnecting',
    initialized: false
  };

  sessions.set(tenantId, session);

  await attachClientEvents(session);
  await setStatus(tenantId, 'reconnecting');

  try {
    await client.initialize();
    session.initialized = true;
  } catch (error) {
    console.error('Puppeteer init error:', error);
    await setStatus(tenantId, 'failed');
  }

  return snapshot(session);
}

export async function disconnectSession(tenantId: string) {
  const session = sessions.get(tenantId);
  if (!session) {
    return { ok: false, message: 'Sessão não encontrada' };
  }

  try {
    await session.client.logout();
  } catch {
    // ignore
  }

  await setStatus(tenantId, 'disconnected');
  sessions.delete(tenantId);
  try {
    await query('DELETE FROM whatsapp_terms_agreements WHERE tenant_id = $1', [tenantId]);
  } catch (e) {
    console.error('Error deleting terms', e);
  }

  return { ok: true };
}

export async function sendTenantMessage(tenantId: string, phone: string, message: string) {
  const session = sessions.get(tenantId);
  if (!session || !session.initialized) {
    throw new Error('Sessão WhatsApp não conectada para este tenant');
  }

  const formatted = `${phone.replace(/\D/g, '')}@c.us`;
  console.log(`[WHATSAPP DEBUG] Sending message to ${formatted}. Original phone: ${phone}. Message: ${message}`);
  
  try {
    const response = await session.client.sendMessage(formatted, message);
    console.log(`[WHATSAPP DEBUG] Message sent successfully. ID: ${response.id.id}`);
  } catch (error) {
    console.error(`[WHATSAPP DEBUG] Error sending message:`, error);
  }
  await setStatus(tenantId, 'connected');
}

import type { MessageMedia } from 'whatsapp-web.js';
export async function sendTenantMediaMessage(tenantId: string, phone: string, message: string, media: MessageMedia) {
  const session = sessions.get(tenantId);
  if (!session || !session.initialized) {
    throw new Error('Sessão WhatsApp não conectada para este tenant');
  }

  const formatted = `${phone.replace(/\D/g, '')}@c.us`;
  await session.client.sendMessage(formatted, media, { caption: message });
  await setStatus(tenantId, 'connected');
}

export async function keepAliveAllSessions() {
  const run = Array.from(sessions.values()).map(async (session) => {
    try {
      await session.client.getState();
      await setStatus(session.tenantId, 'connected');
    } catch {
      await setStatus(session.tenantId, 'reconnecting');
    }
  });

  await Promise.all(run);
}

export function getSessionSnapshot(tenantId: string): WhatsAppSessionSnapshot {
  const session = sessions.get(tenantId);
  if (!session) {
    return {
      tenantId,
      phoneNumber: '',
      status: 'disconnected'
    };
  }

  return snapshot(session);
}

function snapshot(session: SessionContext): WhatsAppSessionSnapshot {
  return {
    tenantId: session.tenantId,
    phoneNumber: session.phoneNumber,
    status: session.status,
    lastSeen: session.lastSeen,
    qrCode: session.qrCode
  };
}
