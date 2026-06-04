import { Router } from 'express';
import { query } from '../../server/common/db.js';
import { AuthRequest } from '../../server/common/types.js';
import { requireRole } from '../../server/common/middleware.js';
import { logAudit } from '../../server/common/audit.js';

export const prontuarioRouter = Router();

prontuarioRouter.get('/records/:patientId', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { patientId } = req.params;

  const records = await query(
    `SELECT id, tenant_id, patient_id, dentist_id, appointment_id, descricao, created_at
     FROM clinical_records
     WHERE tenant_id = $1 AND patient_id = $2
     ORDER BY created_at DESC`,
    [tenantId, patientId]
  );

  const evolutions = await query(
    `SELECT id, tenant_id, clinical_record_id, observacoes, created_at
     FROM clinical_evolutions
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 200`,
    [tenantId]
  );

  const toothConditions = await query(
    `SELECT tc.id, tc.tenant_id, tc.tooth_id, tc.patient_id, tc.condicao, tc.data, t.numero_dente
     FROM tooth_conditions tc
     JOIN teeth t ON tc.tooth_id = t.id
     WHERE tc.tenant_id = $1 AND tc.patient_id = $2
     ORDER BY tc.data DESC`,
    [tenantId, patientId]
  );

  return res.json({
    records: records.rows,
    evolutions: evolutions.rows,
    toothConditions: toothConditions.rows
  });
});

prontuarioRouter.post('/records', requireRole(['admin', 'dentist']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { patientId, dentistId, appointmentId, descricao } = req.body;

  const result = await query<{ id: string }>(
    `INSERT INTO clinical_records (tenant_id, patient_id, dentist_id, appointment_id, descricao)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [tenantId, patientId, dentistId, appointmentId ?? null, descricao]
  );

  await logAudit({
    tenantId,
    userId: req.auth?.userId,
    action: 'create',
    entity: 'clinical_records',
    entityId: result.rows[0].id
  });

  return res.status(201).json({ id: result.rows[0].id });
});

prontuarioRouter.post('/records/:recordId/evolutions', requireRole(['admin', 'dentist']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { recordId } = req.params;
  const { observacoes } = req.body;

  const result = await query<{ id: string }>(
    `INSERT INTO clinical_evolutions (tenant_id, clinical_record_id, observacoes)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [tenantId, recordId, observacoes]
  );

  return res.status(201).json({ id: result.rows[0].id });
});

prontuarioRouter.post('/patients/:patientId/tooth-conditions', requireRole(['admin', 'dentist']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { patientId } = req.params;
  const { toothId, condicao, data } = req.body; // toothId is actually the number like '18' here as per MVP

  // 1. Ensure the tooth exists in "teeth" for this tenant
  let toothUuid = '';
  const existingTooth = await query<{ id: string }>(
    `SELECT id FROM teeth WHERE tenant_id = $1 AND numero_dente = $2`,
    [tenantId, toothId]
  );

  if (existingTooth.rows.length > 0) {
    toothUuid = existingTooth.rows[0].id;
  } else {
    const newTooth = await query<{ id: string }>(
      `INSERT INTO teeth (tenant_id, numero_dente) VALUES ($1, $2) RETURNING id`,
      [tenantId, toothId]
    );
    toothUuid = newTooth.rows[0].id;
  }

  // 2. Insert the condition
  const result = await query<{ id: string }>(
    `INSERT INTO tooth_conditions (tenant_id, tooth_id, patient_id, condicao, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [tenantId, toothUuid, patientId, condicao, data ?? new Date().toISOString()]
  );

  return res.status(201).json({ id: result.rows[0].id });
});
