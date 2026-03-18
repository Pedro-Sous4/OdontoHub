import { Router } from 'express';
import { query } from '../../server/common/db.js';
import { AuthRequest } from '../../server/common/types.js';
import { enqueueNotification } from '../../queues/jobs.js';

export const notificationRouter = Router();

notificationRouter.post('/enqueue', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { channel, recipient, subject, body, referenceType, referenceId, priority } = req.body;

  const event = await query<{ id: string }>(
    `INSERT INTO notification_events (tenant_id, channel, recipient, subject, body, reference_type, reference_id, priority, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [tenantId, channel, recipient, subject ?? null, body, referenceType ?? null, referenceId ?? null, priority ?? 'normal', 'queued']
  );

  await enqueueNotification({
    tenantId,
    eventId: event.rows[0].id,
    channel,
    recipient,
    subject,
    body
  });

  return res.status(202).json({ id: event.rows[0].id, status: 'queued' });
});

notificationRouter.get('/events', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const events = await query(
    `SELECT id, channel, recipient, subject, body, status, priority, created_at
     FROM notification_events
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 200`,
    [tenantId]
  );

  return res.json(events.rows);
});
