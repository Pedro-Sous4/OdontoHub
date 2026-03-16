import { Router } from 'express';
import { query } from '../../server/common/db.js';
import { AuthRequest } from '../../server/common/types.js';
import { requireRole } from '../../server/common/middleware.js';
import { enqueueGoogleSync, enqueueWhatsAppReminder } from '../../queues/jobs.js';
import { logAudit } from '../../server/common/audit.js';

export const agendaRouter = Router();

agendaRouter.get('/dentists', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const result = await query(
    'SELECT id, tenant_id, nome, especialidade, cor_agenda FROM dentists WHERE tenant_id = $1 ORDER BY nome ASC',
    [tenantId]
  );

  return res.json(result.rows);
});

agendaRouter.get('/appointments', async (req: AuthRequest, res) => {
  const { start, end } = req.query;
  const tenantId = req.auth!.tenantId;

  const result = await query(
    `SELECT a.id,
            a.tenant_id,
            a.patient_id,
            a.dentist_id,
            a.room_id,
            a.start_time,
            a.end_time,
            a.status,
            a.google_event_id,
            a.created_at,
            p.nome AS patient_name,
            p.telefone AS phone,
            d.nome AS dentist_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id
     JOIN dentists d ON d.id = a.dentist_id AND d.tenant_id = a.tenant_id
     WHERE tenant_id = $1
       AND start_time >= $2
       AND end_time <= $3
     ORDER BY a.start_time ASC`,
    [tenantId, start, end]
  );

  return res.json(result.rows);
});

agendaRouter.get('/appointments/intelligence', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { patientId } = req.query as { patientId?: string };

  if (!patientId) {
    return res.status(400).json({ message: 'patientId é obrigatório' });
  }

  const noShowStats = await query<{ total: string; no_show: string }>(
    `SELECT COUNT(*)::text AS total,
            COALESCE(SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END), 0)::text AS no_show
     FROM appointments
     WHERE tenant_id = $1 AND patient_id = $2`,
    [tenantId, patientId]
  );

  const debtStats = await query<{ pending_count: string; pending_total: string }>(
    `SELECT COUNT(*)::text AS pending_count,
            COALESCE(SUM(valor), 0)::text AS pending_total
     FROM finance_transactions
     WHERE tenant_id = $1
       AND patient_id = $2
       AND status IN ('pending', 'overdue')`,
    [tenantId, patientId]
  );

  const total = Number(noShowStats.rows[0]?.total ?? 0);
  const noShow = Number(noShowStats.rows[0]?.no_show ?? 0);
  const pendingCount = Number(debtStats.rows[0]?.pending_count ?? 0);
  const pendingTotal = Number(debtStats.rows[0]?.pending_total ?? 0);

  const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 15;
  const debtImpact = pendingTotal > 0 ? 12 : 0;
  const chanceNoShow = Math.min(95, Math.max(5, noShowRate + debtImpact));

  let riskLevel: 'baixo' | 'medio' | 'alto' = 'baixo';
  if (chanceNoShow >= 60) {
    riskLevel = 'alto';
  } else if (chanceNoShow >= 35) {
    riskLevel = 'medio';
  }

  return res.json({
    patientId,
    chanceNoShow,
    riskLevel,
    totalAppointments: total,
    noShowCount: noShow,
    pendingDebt: pendingTotal,
    pendingDebtCount: pendingCount,
    hasOpenDebt: pendingTotal > 0
  });
});

agendaRouter.post('/appointments', requireRole(['admin', 'receptionist', 'dentist']), async (req: AuthRequest, res) => {
  const { patientId, dentistId, roomId, startTime, endTime, status } = req.body;
  const tenantId = req.auth!.tenantId;

  const conflict = await query(
    `SELECT *
     FROM appointments
     WHERE tenant_id = $1
       AND dentist_id = $2
       AND start_time < $3
       AND end_time > $4`,
    [tenantId, dentistId, endTime, startTime]
  );

  if (conflict.rows.length > 0) {
    return res.status(409).json({ message: 'Conflito de agenda detectado' });
  }

  const created = await query<{ id: string }>(
    `INSERT INTO appointments (tenant_id, patient_id, dentist_id, room_id, start_time, end_time, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [tenantId, patientId, dentistId, roomId, startTime, endTime, status ?? 'scheduled']
  );

  const appointmentId = created.rows[0].id;

  const details = await query<{
    patient_name: string;
    dentist_name: string;
    telefone: string;
  }>(
    `SELECT p.nome AS patient_name, p.telefone, d.nome AS dentist_name
     FROM patients p
     JOIN dentists d ON d.id = $1 AND d.tenant_id = $2
     WHERE p.id = $3 AND p.tenant_id = $2`,
    [dentistId, tenantId, patientId]
  );

  const item = details.rows[0];

  await enqueueGoogleSync({
    tenantId,
    appointmentId,
    patientName: item.patient_name,
    dentistName: item.dentist_name,
    startTime,
    endTime
  });

  await enqueueWhatsAppReminder({
    tenantId,
    phoneNumber: item.telefone,
    patientId,
    appointmentId,
    message: `Olá ${item.patient_name}, sua consulta está marcada para ${new Date(startTime).toLocaleString('pt-BR')}.`
  });

  await logAudit({
    tenantId,
    userId: req.auth?.userId,
    action: 'create',
    entity: 'appointments',
    entityId: appointmentId,
    payload: { patientId, dentistId, startTime, endTime }
  });

  return res.status(201).json({ id: appointmentId });
});

agendaRouter.get('/availability', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { dentistId, date } = req.query as { dentistId: string; date: string };
  const dayStart = new Date(`${date}T08:00:00.000Z`);
  const dayEnd = new Date(`${date}T18:00:00.000Z`);

  const result = await query<{ start_time: string; end_time: string }>(
    `SELECT start_time, end_time
     FROM appointments
     WHERE tenant_id = $1
       AND dentist_id = $2
       AND start_time < $3
       AND end_time > $4
     ORDER BY start_time ASC`,
    [tenantId, dentistId, dayEnd.toISOString(), dayStart.toISOString()]
  );

  return res.json({
    dentistId,
    date,
    busy: result.rows,
    window: { start: dayStart.toISOString(), end: dayEnd.toISOString() }
  });
});

agendaRouter.put('/appointments/:id/reschedule', requireRole(['admin', 'receptionist', 'dentist']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { startTime, endTime } = req.body;
  const tenantId = req.auth!.tenantId;

  const current = await query<{ dentist_id: string; patient_id: string }>(
    'SELECT dentist_id, patient_id FROM appointments WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );

  if (!current.rows[0]) {
    return res.status(404).json({ message: 'Consulta não encontrada' });
  }

  const dentistId = current.rows[0].dentist_id;

  const conflict = await query(
    `SELECT id
     FROM appointments
     WHERE tenant_id = $1
       AND dentist_id = $2
       AND id <> $3
       AND start_time < $4
       AND end_time > $5`,
    [tenantId, dentistId, id, endTime, startTime]
  );

  if (conflict.rows.length > 0) {
    return res.status(409).json({ message: 'Horário indisponível' });
  }

  await query(
    'UPDATE appointments SET start_time = $1, end_time = $2, status = $3 WHERE id = $4 AND tenant_id = $5',
    [startTime, endTime, 'rescheduled', id, tenantId]
  );

  await logAudit({
    tenantId,
    userId: req.auth?.userId,
    action: 'reschedule',
    entity: 'appointments',
    entityId: id,
    payload: { startTime, endTime }
  });

  return res.json({ message: 'Consulta reagendada' });
});

agendaRouter.put('/appointments/:id/cancel', requireRole(['admin', 'receptionist']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const tenantId = req.auth!.tenantId;

  await query('UPDATE appointments SET status = $1 WHERE id = $2 AND tenant_id = $3', ['cancelled', id, tenantId]);
  await logAudit({
    tenantId,
    userId: req.auth?.userId,
    action: 'cancel',
    entity: 'appointments',
    entityId: id
  });
  return res.json({ message: 'Consulta cancelada' });
});

agendaRouter.put('/appointments/:id/status', requireRole(['admin', 'receptionist', 'dentist']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: string };
  const tenantId = req.auth!.tenantId;

  const allowed = new Set([
    'scheduled',
    'confirmed',
    'rescheduled',
    'cancelled',
    'arrived',
    'in_service',
    'attended',
    'no_show'
  ]);

  if (!allowed.has(status)) {
    return res.status(400).json({ message: 'Status inválido' });
  }

  await query('UPDATE appointments SET status = $1 WHERE id = $2 AND tenant_id = $3', [status, id, tenantId]);

  await logAudit({
    tenantId,
    userId: req.auth?.userId,
    action: 'status_change',
    entity: 'appointments',
    entityId: id,
    payload: { status }
  });

  return res.json({ message: 'Status atualizado', status });
});
