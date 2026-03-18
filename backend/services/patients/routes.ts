import { Router } from 'express';
import { query } from '../../server/common/db.js';
import { AuthRequest } from '../../server/common/types.js';
import { requireRole } from '../../server/common/middleware.js';
import { uploadPatientFile } from '../../server/common/storage.js';
import { logAudit } from '../../server/common/audit.js';

export const patientsRouter = Router();

patientsRouter.get('/', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const result = await query(
    `SELECT id,
            tenant_id,
            nome,
            cpf,
            telefone,
            email,
            data_nascimento,
            created_at
     FROM patients
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [tenantId]
  );
  return res.json(result.rows);
});

patientsRouter.post('/', requireRole(['admin', 'receptionist', 'dentist']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const {
    nome,
    cpf,
    telefone,
    email,
    dataNascimento
  } = req.body;

  const created = await query<{ id: string }>(
    `INSERT INTO patients (
        tenant_id,
        nome,
        cpf,
        telefone,
        email,
        data_nascimento
     )
     VALUES (
        $1, $2, $3, $4, $5
     )
     RETURNING id`,
    [
      tenantId,
      nome,
      cpf,
      telefone,
      email,
      dataNascimento
    ]
  );

  await logAudit({
    tenantId,
    userId: req.auth?.userId,
    action: 'create',
    entity: 'patients',
    entityId: created.rows[0].id
  });

  return res.status(201).json({ id: created.rows[0].id });
});

patientsRouter.post('/:id/files', requireRole(['admin', 'dentist', 'receptionist']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const patientId = req.params.id;
  const { filename, contentType, fileType, base64 } = req.body as {
    filename: string;
    contentType: string;
    fileType: 'radiografia' | 'imagem' | 'documento';
    base64: string;
  };

  const data = Buffer.from(base64, 'base64');
  const uploaded = await uploadPatientFile({
    tenantId,
    patientId,
    filename,
    contentType,
    data
  });

  const metadata = await query<{ id: string }>(
    `INSERT INTO patient_files (tenant_id, patient_id, file_type, file_key)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [tenantId, patientId, fileType, uploaded.key]
  );

  await logAudit({
    tenantId,
    userId: req.auth?.userId,
    action: 'upload',
    entity: 'patient_files',
    entityId: metadata.rows[0].id,
    payload: { patientId, fileType }
  });

  return res.status(201).json({ id: metadata.rows[0].id, key: uploaded.key });
});
