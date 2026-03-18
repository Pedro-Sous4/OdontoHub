import { Router } from 'express';
import { query } from '../../server/common/db.js';
import { AuthRequest } from '../../server/common/types.js';
import { requireRole } from '../../server/common/middleware.js';

export const tissRouter = Router();

tissRouter.get('/providers', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const providers = await query(
    `SELECT id, tenant_id, nome, codigo_ans, created_at
     FROM insurance_providers
     WHERE tenant_id = $1
     ORDER BY nome ASC`,
    [tenantId]
  );

  return res.json(providers.rows);
});

tissRouter.post('/providers', requireRole(['admin', 'finance']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { nome, codigoAns } = req.body;

  const result = await query<{ id: string }>(
    `INSERT INTO insurance_providers (tenant_id, nome, codigo_ans)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [tenantId, nome, codigoAns]
  );

  return res.status(201).json({ id: result.rows[0].id });
});

tissRouter.post('/guides', requireRole(['admin', 'finance', 'receptionist']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { patientId, appointmentId, numeroGuia } = req.body;

  const result = await query<{ id: string }>(
    `INSERT INTO tiss_guides (tenant_id, patient_id, appointment_id, numero_guia, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [tenantId, patientId, appointmentId, numeroGuia, 'draft']
  );

  return res.status(201).json({ id: result.rows[0].id });
});

tissRouter.post('/guides/:guideId/submit', requireRole(['admin', 'finance']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { guideId } = req.params;

  const submission = await query<{ id: string }>(
    `INSERT INTO tiss_submissions (tenant_id, guia_id, data_envio, status)
     VALUES ($1, $2, NOW(), $3)
     RETURNING id`,
    [tenantId, guideId, 'sent']
  );

  await query('UPDATE tiss_guides SET status = $1 WHERE id = $2 AND tenant_id = $3', ['submitted', guideId, tenantId]);

  return res.status(202).json({ submissionId: submission.rows[0].id, status: 'sent' });
});
