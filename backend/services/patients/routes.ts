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
  try {
    console.log('[DEBUG-PATIENTS] 1. Rota de criação de paciente atingida.');
    const tenantId = req.auth!.tenantId;
    const {
      nome,
      cpf,
      telefone,
      email,
      dataNascimento
    } = req.body;
    console.log(`[DEBUG-PATIENTS] 2. Dados recebidos. Tenant ID: ${tenantId}, Nome: ${nome}`);

    console.log('[DEBUG-PATIENTS] 3. Executando a query de inserção...');
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
          $1, $2, $3, $4, $5, $6
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
    console.log('[DEBUG-PATIENTS] 4. Query de inserção concluída. ID: ', created.rows[0].id);

    console.log('[DEBUG-PATIENTS] 5. Executando log de auditoria...');
    await logAudit({
      tenantId,
      userId: req.auth?.userId,
      action: 'create',
      entity: 'patients',
      entityId: created.rows[0].id
    });
    console.log('[DEBUG-PATIENTS] 6. Log de auditoria concluído.');

    return res.status(201).json({ id: created.rows[0].id });
  } catch (error) {
    console.error('[DEBUG-PATIENTS] ERRO NO BLOCO TRY/CATCH:', error);
    return res.status(500).json({ message: 'Erro interno no serviço de pacientes' });
  }
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

patientsRouter.put('/:id', requireRole(['admin', 'receptionist', 'dentist']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const patientId = req.params.id;
    const {
      nome,
      cpf,
      telefone,
      email,
      dataNascimento
    } = req.body;

    const result = await query(
      `UPDATE patients
       SET nome = $1,
           cpf = $2,
           telefone = $3,
           email = $4,
           data_nascimento = $5
       WHERE id = $6 AND tenant_id = $7`,
      [
        nome,
        cpf,
        telefone,
        email,
        dataNascimento,
        patientId,
        tenantId
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    await logAudit({
      tenantId,
      userId: req.auth?.userId,
      action: 'update',
      entity: 'patients',
      entityId: patientId
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('[DEBUG-PATIENTS] ERRO NO PUT:', error);
    return res.status(500).json({ message: 'Erro interno no serviço de pacientes' });
  }
});

patientsRouter.delete('/:id', requireRole(['admin', 'receptionist', 'dentist']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const patientId = req.params.id;

    const result = await query(
      `DELETE FROM patients
       WHERE id = $1 AND tenant_id = $2`,
      [patientId, tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    await logAudit({
      tenantId,
      userId: req.auth?.userId,
      action: 'delete',
      entity: 'patients',
      entityId: patientId
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('[DEBUG-PATIENTS] ERRO NO DELETE:', error);
    return res.status(500).json({ message: 'Erro interno no serviço de pacientes' });
  }
});

