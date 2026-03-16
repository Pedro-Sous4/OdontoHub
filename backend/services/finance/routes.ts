import { Router } from 'express';
import { query } from '../../server/common/db.js';
import { AuthRequest } from '../../server/common/types.js';
import { requireRole } from '../../server/common/middleware.js';

export const financeRouter = Router();

financeRouter.get('/transactions', requireRole(['admin', 'finance']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const result = await query(
    `SELECT id, tenant_id, patient_id, appointment_id, valor, forma_pagamento, status, created_at
     FROM finance_transactions
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return res.json(result.rows);
});

financeRouter.post('/transactions', requireRole(['admin', 'finance', 'receptionist']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { patientId, appointmentId, valor, formaPagamento, status } = req.body;

  const result = await query<{ id: string }>(
    `INSERT INTO finance_transactions (tenant_id, patient_id, appointment_id, valor, forma_pagamento, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [tenantId, patientId, appointmentId ?? null, valor, formaPagamento, status ?? 'pending']
  );

  return res.status(201).json({ id: result.rows[0].id });
});
