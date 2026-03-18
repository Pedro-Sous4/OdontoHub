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
            rg,
            telefone,
            celular,
            celular_ddi,
            lembretes_automaticos,
            lembrete_canal,
            // telefone_fixo and telefone_fixo_ddi removed
            email,
            como_conheceu_clinica,
            profissao,
            genero,
            paciente_estrangeiro,
            data_nascimento,
            observacoes,
            categoria,
            contato_emergencia_nome,
            contato_emergencia_telefone,
            contato_emergencia_ddi,
            endereco_cep,
            endereco_logradouro_numero,
            endereco_complemento,
            endereco_bairro,
            endereco_cidade,
            endereco_estado,
            responsavel_nome,
            responsavel_cpf,
            responsavel_data_nascimento,
            convenio_nome,
            convenio_titular,
            convenio_numero_carteirinha,
            convenio_cpf_responsavel,
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
    rg,
    telefone,
    celular,
    celularDdi,
    lembretesAutomaticos,
    lembreteCanal,
    // telefoneFixo and telefoneFixoDdi removed
    email,
    comoConheceuClinica,
    profissao,
    genero,
    pacienteEstrangeiro,
    dataNascimento,
    observacoes,
    categoria,
    contatoEmergenciaNome,
    contatoEmergenciaTelefone,
    contatoEmergenciaDdi,
    enderecoCep,
    enderecoLogradouroNumero,
    enderecoComplemento,
    enderecoBairro,
    enderecoCidade,
    enderecoEstado,
    responsavelNome,
    responsavelCpf,
    responsavelDataNascimento,
    convenioNome,
    convenioTitular,
    convenioNumeroCarteirinha,
    convenioCpfResponsavel
  } = req.body;

  const created = await query<{ id: string }>(
    `INSERT INTO patients (
        tenant_id,
        nome,
        cpf,
        rg,
        telefone,
        celular,
        celular_ddi,
        lembretes_automaticos,
        lembrete_canal,
        telefone_fixo,
        telefone_fixo_ddi,
        email,
        como_conheceu_clinica,
        profissao,
        genero,
        paciente_estrangeiro,
        data_nascimento,
        observacoes,
        categoria,
        contato_emergencia_nome,
        contato_emergencia_telefone,
        contato_emergencia_ddi,
        endereco_cep,
        endereco_logradouro_numero,
        endereco_complemento,
        endereco_bairro,
        endereco_cidade,
        endereco_estado,
        responsavel_nome,
        responsavel_cpf,
        responsavel_data_nascimento,
        convenio_nome,
        convenio_titular,
        convenio_numero_carteirinha,
        convenio_cpf_responsavel
     )
     VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35
     )
     RETURNING id`,
    [
      tenantId,
      nome,
      cpf,
      rg,
      telefone,
      celular,
      celularDdi ?? '+55',
      lembretesAutomaticos ?? true,
      lembreteCanal ?? null,
      telefoneFixo,
      telefoneFixoDdi ?? '+55',
      email,
      comoConheceuClinica,
      profissao,
      genero,
      pacienteEstrangeiro ?? false,
      dataNascimento,
      observacoes,
      categoria,
      contatoEmergenciaNome,
      contatoEmergenciaTelefone,
      contatoEmergenciaDdi ?? '+55',
      enderecoCep,
      enderecoLogradouroNumero,
      enderecoComplemento,
      enderecoBairro,
      enderecoCidade,
      enderecoEstado,
      responsavelNome,
      responsavelCpf,
      responsavelDataNascimento,
      convenioNome,
      convenioTitular,
      convenioNumeroCarteirinha,
      convenioCpfResponsavel
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
