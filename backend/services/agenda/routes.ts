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
    'SELECT id, nome, especialidade, cor_agenda FROM dentists WHERE tenant_id = $1 ORDER BY nome',
    [tenantId]
  );
  return res.json(result.rows);
});

agendaRouter.get('/dentists/:id/schedules', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { id } = req.params;
  const result = await query(
    'SELECT dia_semana, hora_inicio, hora_fim FROM dentist_schedules WHERE tenant_id = $1 AND dentist_id = $2 ORDER BY dia_semana ASC',
    [tenantId, id]
  );
  return res.json(result.rows);
});

agendaRouter.put('/dentists/:id/schedules', requireRole(['admin', 'dentist', 'receptionist']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { id } = req.params;
  const schedules: { dia_semana: number; hora_inicio: string; hora_fim: string }[] = req.body.schedules;
  console.log(`PUT /dentists/${id}/schedules`, req.body);
  
  try {
    await query('BEGIN');
    await query('DELETE FROM dentist_schedules WHERE tenant_id = $1 AND dentist_id = $2', [tenantId, id]);
    
    for (const s of schedules) {
      await query(
        'INSERT INTO dentist_schedules (tenant_id, dentist_id, dia_semana, hora_inicio, hora_fim) VALUES ($1, $2, $3, $4, $5)',
        [tenantId, id, s.dia_semana, s.hora_inicio, s.hora_fim]
      );
    }
    await query('COMMIT');
    return res.json({ message: 'Horários atualizados com sucesso' });
  } catch (error) {
    await query('ROLLBACK');
    console.error('Erro ao atualizar horarios:', error);
    return res.status(500).json({ message: 'Erro ao atualizar horários' });
  }
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
            d.nome AS dentist_name,
            (SELECT procedure_id FROM appointment_procedures WHERE appointment_id = a.id AND tenant_id = a.tenant_id LIMIT 1) AS procedure_id
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id
     JOIN dentists d ON d.id = a.dentist_id AND d.tenant_id = a.tenant_id
     WHERE a.tenant_id = $1
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
  const { patientId, dentistId, roomId, startTime, endTime, status, procedureId, procedure_id } = req.body;
  const tenantId = req.auth!.tenantId;
  const actualProcedureId = procedureId || procedure_id;

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

  if (actualProcedureId) {
    // Fetch default duration and price for the procedure
    const procResult = await query<{ duracao_padrao: number; valor: number }>(
      'SELECT duracao_padrao, valor FROM procedures WHERE id = $1 AND tenant_id = $2',
      [actualProcedureId, tenantId]
    );
    
    const duration = procResult.rows[0]?.duracao_padrao ?? 30;
    const value = procResult.rows[0]?.valor ?? 0;

    await query(
      `INSERT INTO appointment_procedures (tenant_id, appointment_id, procedure_id, duracao, valor)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, appointmentId, actualProcedureId, duration, value]
    );
  }

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
    payload: { patientId, dentistId, startTime, endTime, procedureId: actualProcedureId }
  });

  return res.status(201).json({ id: appointmentId });
});

agendaRouter.get('/availability', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { dentistId, date, duration } = req.query as { dentistId: string; date: string; duration?: string };
  
  // 1. Descobrir o dia da semana (0 = Domingo, 6 = Sábado)
  // Como a data vem no formato YYYY-MM-DD, vamos pegar o UTC day
  const [year, month, day] = date.split('-');
  const diaSemana = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay();

  // 2. Buscar horário de trabalho deste dentista neste dia da semana
  const schedResult = await query<{ hora_inicio: string; hora_fim: string }>(
    `SELECT hora_inicio, hora_fim FROM dentist_schedules
     WHERE tenant_id = $1 AND dentist_id = $2 AND dia_semana = $3`,
    [tenantId, dentistId, diaSemana]
  );

  if (schedResult.rows.length === 0) {
    // Dentista não trabalha neste dia
    return res.json({ dentistId, date, busy: [], free_slots: [], window: null });
  }

  const { hora_inicio, hora_fim } = schedResult.rows[0];
  const dayStart = new Date(`${date}T${hora_inicio}Z`); // Convertendo de TIME do postgres
  const dayEnd = new Date(`${date}T${hora_fim}Z`);

  // 3. Buscar consultas ocupadas
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

  const busy = result.rows;
  
  // 4. Calcular os slots livres baseado na duração solicitada
  const durMinutes = duration ? parseInt(duration, 10) : 30; // Padrão 30 min
  const durMs = durMinutes * 60000;
  
  const freeSlots: { start: string; end: string }[] = [];
  let currentTime = dayStart.getTime();

  for (const block of busy) {
    const bStart = new Date(block.start_time).getTime();
    const bEnd = new Date(block.end_time).getTime();
    
    // Se há espaço antes deste bloco ocupado
    while (currentTime + durMs <= bStart) {
      freeSlots.push({ start: new Date(currentTime).toISOString(), end: new Date(currentTime + durMs).toISOString() });
      currentTime += 30 * 60000; // Incrementa em passos de 30 min
    }
    // Pula para o fim do bloco ocupado
    currentTime = Math.max(currentTime, bEnd);
  }

  // Preencher até o final do dia
  while (currentTime + durMs <= dayEnd.getTime()) {
    freeSlots.push({ start: new Date(currentTime).toISOString(), end: new Date(currentTime + durMs).toISOString() });
    currentTime += 30 * 60000;
  }

  return res.json({
    dentistId,
    date,
    duration: durMinutes,
    busy,
    free_slots: freeSlots,
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

agendaRouter.delete('/appointments/:id', requireRole(['admin', 'receptionist']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.auth!.tenantId;

    // Delete all dependencies to prevent FK constraint issues
    await query('DELETE FROM appointment_procedures WHERE appointment_id = $1 AND tenant_id = $2', [id, tenantId]);
    await query('DELETE FROM appointment_history WHERE appointment_id = $1 AND tenant_id = $2', [id, tenantId]);
    await query('DELETE FROM appointment_notes WHERE appointment_id = $1 AND tenant_id = $2', [id, tenantId]);
    await query('DELETE FROM appointment_reminders WHERE appointment_id = $1 AND tenant_id = $2', [id, tenantId]);
    await query('DELETE FROM appointment_confirmations WHERE appointment_id = $1 AND tenant_id = $2', [id, tenantId]);
    await query('DELETE FROM message_logs WHERE appointment_id = $1 AND tenant_id = $2', [id, tenantId]);
    
    // Set foreign key references to null in table records where deleting is not desired
    await query('UPDATE finance_transactions SET appointment_id = NULL WHERE appointment_id = $1 AND tenant_id = $2', [id, tenantId]);
    await query('UPDATE clinical_records SET appointment_id = NULL WHERE appointment_id = $1 AND tenant_id = $2', [id, tenantId]);
    await query('UPDATE vital_signs SET appointment_id = NULL WHERE appointment_id = $1 AND tenant_id = $2', [id, tenantId]);
    await query('UPDATE tiss_guides SET appointment_id = NULL WHERE appointment_id = $1 AND tenant_id = $2', [id, tenantId]);

    const result = await query('DELETE FROM appointments WHERE id = $1 AND tenant_id = $2', [id, tenantId]);

    await logAudit({
      tenantId,
      userId: req.auth?.userId,
      action: 'delete',
      entity: 'appointments',
      entityId: id
    });

    return res.json({ message: 'Consulta excluída com sucesso' });
  } catch (error: any) {
    console.error('ERROR deleting appointment:', error);
    return res.status(500).json({ message: error.message || 'Erro ao excluir agendamento' });
  }
});

agendaRouter.put('/appointments/:id/status', requireRole(['admin', 'receptionist', 'dentist']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: string };
  const tenantId = req.auth!.tenantId;

  const allowed = new Set([
    'pending_confirmation',
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

  const current = await query<{
    status: string;
    patient_name: string;
    telefone: string;
    dentist_name: string;
    start_time: string;
    patient_id: string;
  }>(
    `SELECT a.status, p.nome AS patient_name, p.telefone, d.nome AS dentist_name, a.start_time, a.patient_id
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id
     JOIN dentists d ON d.id = a.dentist_id AND d.tenant_id = a.tenant_id
     WHERE a.id = $1 AND a.tenant_id = $2`,
    [id, tenantId]
  );

  await query('UPDATE appointments SET status = $1 WHERE id = $2 AND tenant_id = $3', [status, id, tenantId]);

  if (current.rows[0] && current.rows[0].status === 'pending_confirmation' && (status === 'scheduled' || status === 'confirmed')) {
    await enqueueWhatsAppReminder({
      tenantId,
      phoneNumber: current.rows[0].telefone,
      patientId: current.rows[0].patient_id,
      appointmentId: id,
      message: `Olá ${current.rows[0].patient_name}, sua consulta com o(a) ${current.rows[0].dentist_name} no dia ${new Date(current.rows[0].start_time).toLocaleString('pt-BR')} foi confirmada!`
    });
  }

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
