import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import { query } from '../../server/common/db.js';
import { WhatsAppSessionSnapshot, WhatsAppSessionStatus } from './types.js';

type SocketNotifier = (tenantId: string, event: string, payload: unknown) => void;

type SessionContext = {
  tenantId: string;
  phoneNumber: string;
  client: Client;
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
      args: ['--no-sandbox', '--disable-setuid-sandbox']
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
  session.client.on('qr', async (qr) => {
    const qrCode = await qrcode.toDataURL(qr);
    await setStatus(session.tenantId, 'pending_qr', qrCode);
  });

  session.client.on('authenticated', async () => {
    await setStatus(session.tenantId, 'authenticated');
  });

  session.client.on('ready', async () => {
    await setStatus(session.tenantId, 'connected');
  });

  session.client.on('disconnected', async () => {
    await setStatus(session.tenantId, 'disconnected');
    await reconnectSession(session.tenantId);
  });
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
  } catch {
    await setStatus(tenantId, 'failed');
  }
}

export function setWhatsAppSocketNotifier(notifier: SocketNotifier) {
  socketNotifier = notifier;
}

export async function connectSession(tenantId: string, phoneNumber: string) {
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
  } catch {
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

  return { ok: true };
}

export async function sendTenantMessage(tenantId: string, phone: string, message: string) {
  const session = sessions.get(tenantId);
  if (!session || !session.initialized) {
    throw new Error('Sessão WhatsApp não conectada para este tenant');
  }

  const formatted = `${phone.replace(/\D/g, '')}@c.us`;
  await session.client.sendMessage(formatted, message);
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
