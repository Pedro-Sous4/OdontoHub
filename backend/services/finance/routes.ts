import { Router } from 'express';
import { query } from '../../server/common/db.js';
import { AuthRequest } from '../../server/common/types.js';
import { requireRole } from '../../server/common/middleware.js';
import { s3 } from '../../server/common/storage.js';
import { PutObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

export const financeRouter = Router();

// Garante a existência da tabela de pagamentos acoplados e coluna comprovante_key
query(`
  CREATE TABLE IF NOT EXISTS finance_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
    valor NUMERIC(12,2) NOT NULL,
    forma_pagamento VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
`).catch((err) => {
  console.error('Erro ao inicializar tabela finance_payments:', err);
});

query(`
  ALTER TABLE finance_payments ADD COLUMN IF NOT EXISTS comprovante_key VARCHAR(512);
`).catch((err) => {
  console.error('Erro ao adicionar comprovante_key em finance_payments:', err);
});

query(`
  ALTER TABLE finance_payments ADD COLUMN IF NOT EXISTS observacao TEXT;
`).catch((err) => {
  console.error('Erro ao adicionar observacao em finance_payments:', err);
});

async function uploadReceipt(tenantId: string, filename: string, contentType: string, base64: string) {
  const data = Buffer.from(base64, 'base64');
  const key = `${tenantId}/finance/receipts/${Date.now()}_${filename}`;
  const bucketName = process.env.S3_BUCKET ?? 'odonto-files';

  // Garante a existência do bucket no MinIO
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      try {
        await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
        console.log(`Bucket ${bucketName} criado com sucesso no MinIO.`);
      } catch (createErr) {
        console.error(`Erro ao tentar criar o bucket ${bucketName}:`, createErr);
      }
    } else {
      console.error(`Erro ao validar o bucket ${bucketName}:`, error);
    }
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: data,
      ContentType: contentType
    })
  );
  return key;
}

// Modifica tabela principal para suportar origens alternativas além do paciente
query(`
  ALTER TABLE finance_transactions ALTER COLUMN patient_id DROP NOT NULL;
`).catch(() => {});

query(`
  ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS tipo_origem VARCHAR(50) DEFAULT 'paciente';
`).catch(() => {});

query(`
  ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS origem_nome VARCHAR(255);
`).catch(() => {});

query(`
  ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS tipo_transacao VARCHAR(20) DEFAULT 'receita';
`).catch((err) => {
  console.error('Erro ao adicionar tipo_transacao em finance_transactions:', err);
});

query(`
  ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS observacao TEXT;
`).catch((err) => {
  console.error('Erro ao adicionar observacao em finance_transactions:', err);
});

// Cria tabela de parceiros/fontes (consultórios e empresas) se não existir
query(`
  CREATE TABLE IF NOT EXISTS finance_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'consultorio' ou 'empresa'
    nome VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
`).catch((err) => {
  console.error('Erro ao inicializar tabela finance_sources:', err);
});

financeRouter.get('/sources', requireRole(['admin', 'finance', 'receptionist']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const result = await query(
      `SELECT id, tipo, nome, created_at
       FROM finance_sources
       WHERE tenant_id = $1
       ORDER BY nome ASC`,
      [tenantId]
    );
    return res.json(result.rows);
  } catch (error: any) {
    console.error('Erro ao listar parceiros:', error);
    return res.status(500).json({ message: 'Erro interno ao listar parceiros', error: error.message });
  }
});

financeRouter.post('/sources', requireRole(['admin', 'finance', 'receptionist']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { tipo, nome } = req.body;

    if (!tipo || !nome || !nome.trim()) {
      return res.status(400).json({ message: 'Tipo e Nome são obrigatórios.' });
    }

    const result = await query<{ id: string }>(
      `INSERT INTO finance_sources (tenant_id, tipo, nome)
       VALUES ($1, $2, $3)
       RETURNING id, tipo, nome`,
      [tenantId, tipo, nome.trim()]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao criar parceiro:', error);
    return res.status(500).json({ message: 'Erro interno ao criar parceiro', error: error.message });
  }
});

financeRouter.put('/sources/:id', requireRole(['admin', 'finance', 'receptionist']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { id } = req.params;
    const { tipo, nome } = req.body;

    if (!tipo || !nome || !nome.trim()) {
      return res.status(400).json({ message: 'Tipo e Nome são obrigatórios.' });
    }

    const result = await query<{ id: string }>(
      `UPDATE finance_sources SET tipo = $1, nome = $2
       WHERE id = $3 AND tenant_id = $4
       RETURNING id, tipo, nome`,
      [tipo, nome.trim(), id, tenantId]
    );

    return res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao atualizar parceiro:', error);
    return res.status(500).json({ message: 'Erro interno ao atualizar parceiro', error: error.message });
  }
});

financeRouter.delete('/sources/:id', requireRole(['admin', 'finance']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { id } = req.params;

    const result = await query(
      `DELETE FROM finance_sources WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Parceiro não encontrado.' });
    }

    return res.json({ message: 'Parceiro excluído com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao excluir parceiro:', error);
    return res.status(500).json({ message: 'Erro interno ao excluir parceiro', error: error.message });
  }
});

financeRouter.get('/transactions', requireRole(['admin', 'finance']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const result = await query(
      `SELECT id, tenant_id, patient_id, appointment_id, valor, forma_pagamento, status, created_at, tipo_origem, origem_nome, tipo_transacao, observacao,
         COALESCE((SELECT SUM(valor) FROM finance_payments WHERE transaction_id = finance_transactions.id), 0) AS valor_pago,
         COALESCE((
           SELECT json_agg(json_build_object('id', id, 'valor', valor, 'forma_pagamento', forma_pagamento, 'created_at', created_at, 'comprovante_key', comprovante_key, 'observacao', observacao) ORDER BY created_at DESC)
           FROM finance_payments
           WHERE transaction_id = finance_transactions.id
         ), '[]'::json) AS pagamentos
       FROM finance_transactions
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return res.json(result.rows);
  } catch (error: any) {
    console.error('Erro ao listar transações:', error);
    return res.status(500).json({ message: 'Erro interno ao listar transações', error: error.message });
  }
});

financeRouter.post('/transactions', requireRole(['admin', 'finance', 'receptionist']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { patientId, appointmentId, valor, formaPagamento, status, createdAt, tipoOrigem, origemNome, valorSinal, tipoTransacao, observacao } = req.body;

    const dateVal = createdAt ? new Date(createdAt) : new Date();

    const initialPaid = valorSinal ? Number(valorSinal) : 0;
    let transactionStatus = status ?? 'pending';
    if (initialPaid >= Number(valor)) {
      transactionStatus = 'paid';
    }

    const result = await query<{ id: string }>(
      `INSERT INTO finance_transactions (tenant_id, patient_id, appointment_id, valor, forma_pagamento, status, created_at, tipo_origem, origem_nome, tipo_transacao, observacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        tenantId, 
        patientId || null, 
        appointmentId ?? null, 
        valor, 
        formaPagamento || 'pix', 
        transactionStatus, 
        dateVal,
        tipoOrigem || 'paciente',
        origemNome || null,
        tipoTransacao || 'receita',
        observacao || null
      ]
    );

    const transactionId = result.rows[0].id;

    if (initialPaid > 0) {
      await query(
        `INSERT INTO finance_payments (transaction_id, valor, forma_pagamento, created_at)
         VALUES ($1, $2, $3, $4)`,
        [transactionId, initialPaid, formaPagamento, dateVal]
      );
    }

    return res.status(201).json({ id: transactionId });
  } catch (error: any) {
    console.error('Erro ao criar transação:', error);
    return res.status(500).json({ message: 'Erro interno ao criar transação', error: error.message });
  }
});

financeRouter.put('/transactions/:id', requireRole(['admin', 'finance', 'receptionist']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { id } = req.params;
    const { 
      patientId, 
      appointmentId, 
      valor, 
      formaPagamento, 
      status, 
      createdAt,
      valorPago,
      paymentMethod,
      paymentDate,
      tipoOrigem,
      origemNome,
      comprovante,
      observacao,
      tipoTransacao
    } = req.body;

    const check = await query(
      `SELECT id FROM finance_transactions WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: 'Transação não encontrada.' });
    }

    // Se informou um pagamento/abatimento na requisição, grava na tabela de pagamentos
    if (valorPago && Number(valorPago) > 0) {
      const payDate = paymentDate ? new Date(paymentDate) : new Date();
      let comprovanteKey: string | null = null;
      if (comprovante && comprovante.base64) {
        comprovanteKey = await uploadReceipt(tenantId, comprovante.filename, comprovante.contentType, comprovante.base64);
      }
      await query(
        `INSERT INTO finance_payments (transaction_id, valor, forma_pagamento, created_at, comprovante_key, observacao)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, Number(valorPago), paymentMethod || formaPagamento, payDate, comprovanteKey, observacao || null]
      );
    }

    // Calcula o total pago consolidado para ver se quitou
    const sumResult = await query<{ total_pago: string | number }>(
      `SELECT COALESCE(SUM(valor), 0) AS total_pago FROM finance_payments WHERE transaction_id = $1`,
      [id]
    );
    const totalPago = Number(sumResult.rows[0].total_pago);
    const finalStatus = totalPago >= Number(valor) ? 'paid' : status;

    const dateVal = createdAt ? new Date(createdAt) : new Date();

    await query(
      `UPDATE finance_transactions
       SET patient_id = $1, appointment_id = $2, valor = $3, forma_pagamento = $4, status = $5, created_at = $6, tipo_origem = $7, origem_nome = $8, tipo_transacao = $9, observacao = $10
       WHERE id = $11 AND tenant_id = $12`,
      [
        patientId || null, 
        appointmentId ?? null, 
        Number(valor), 
        formaPagamento || 'pix', 
        finalStatus, 
        dateVal, 
        tipoOrigem || 'paciente', 
        origemNome || null, 
        tipoTransacao || 'receita',
        observacao || null,
        id, 
        tenantId
      ]
    );

    return res.json({ message: 'Transação atualizada com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao atualizar transação:', error);
    return res.status(500).json({ message: 'Erro interno ao atualizar transação', error: error.message });
  }
});

financeRouter.delete('/transactions/:id', requireRole(['admin', 'finance']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { id } = req.params;

    const result = await query(
      `DELETE FROM finance_transactions WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Transação não encontrada.' });
    }

    return res.json({ message: 'Transação excluída com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao excluir transação:', error);
    return res.status(500).json({ message: 'Erro interno ao excluir transação', error: error.message });
  }
});

// Atualiza um pagamento individual
financeRouter.put('/payments/:paymentId', requireRole(['admin', 'finance', 'receptionist']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { paymentId } = req.params;
    const { valor, formaPagamento, createdAt, comprovante, observacao } = req.body;

    const check = await query(
      `SELECT p.id, p.transaction_id, t.valor AS original_valor 
       FROM finance_payments p
       JOIN finance_transactions t ON p.transaction_id = t.id
       WHERE p.id = $1 AND t.tenant_id = $2`,
      [paymentId, tenantId]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: 'Pagamento não encontrado.' });
    }

    const transactionId = check.rows[0].transaction_id;
    const originalValor = Number(check.rows[0].original_valor);
    const dateVal = createdAt ? new Date(createdAt) : new Date();

    let comprovanteKey: string | null = null;
    let hasNewComprovante = false;
    if (comprovante && comprovante.base64) {
      comprovanteKey = await uploadReceipt(tenantId, comprovante.filename, comprovante.contentType, comprovante.base64);
      hasNewComprovante = true;
    }

    if (hasNewComprovante) {
      await query(
        `UPDATE finance_payments
         SET valor = $1, forma_pagamento = $2, created_at = $3, comprovante_key = $4, observacao = $5
         WHERE id = $6`,
        [Number(valor), formaPagamento, dateVal, comprovanteKey, observacao || null, paymentId]
      );
    } else {
      await query(
        `UPDATE finance_payments
         SET valor = $1, forma_pagamento = $2, created_at = $3, observacao = $4
         WHERE id = $5`,
        [Number(valor), formaPagamento, dateVal, observacao || null, paymentId]
      );
    }

    // Recalcula o total pago consolidado para atualizar o status do título pai
    const sumResult = await query<{ total_pago: string | number }>(
      `SELECT COALESCE(SUM(valor), 0) AS total_pago FROM finance_payments WHERE transaction_id = $1`,
      [transactionId]
    );
    const totalPago = Number(sumResult.rows[0].total_pago);
    const finalStatus = totalPago >= originalValor ? 'paid' : 'pending';

    await query(
      `UPDATE finance_transactions SET status = $1 WHERE id = $2`,
      [finalStatus, transactionId]
    );

    return res.json({ message: 'Pagamento atualizado com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao atualizar pagamento:', error);
    return res.status(500).json({ message: 'Erro interno ao atualizar pagamento', error: error.message });
  }
});

// Exclui um pagamento individual
financeRouter.delete('/payments/:paymentId', requireRole(['admin', 'finance']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { paymentId } = req.params;

    const check = await query(
      `SELECT p.id, p.transaction_id, t.valor AS original_valor 
       FROM finance_payments p
       JOIN finance_transactions t ON p.transaction_id = t.id
       WHERE p.id = $1 AND t.tenant_id = $2`,
      [paymentId, tenantId]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ message: 'Pagamento não encontrado.' });
    }

    const transactionId = check.rows[0].transaction_id;
    const originalValor = Number(check.rows[0].original_valor);

    await query(
      `DELETE FROM finance_payments WHERE id = $1`,
      [paymentId]
    );

    // Recalcula o total pago consolidado para atualizar o status do título pai
    const sumResult = await query<{ total_pago: string | number }>(
      `SELECT COALESCE(SUM(valor), 0) AS total_pago FROM finance_payments WHERE transaction_id = $1`,
      [transactionId]
    );
    const totalPago = Number(sumResult.rows[0].total_pago);
    const finalStatus = totalPago >= originalValor ? 'paid' : 'pending';

    await query(
      `UPDATE finance_transactions SET status = $1 WHERE id = $2`,
      [finalStatus, transactionId]
    );

    return res.json({ message: 'Pagamento excluído com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao excluir pagamento:', error);
    return res.status(500).json({ message: 'Erro interno ao excluir pagamento', error: error.message });
  }
});

// Endpoint seguro para download/visualização de comprovantes
financeRouter.get('/payments/receipt/:key(*)', requireRole(['admin', 'finance', 'receptionist']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { key } = req.params;

    // Garante que o arquivo solicitado pertence ao tenant do usuário para evitar vazamento de dados
    if (!key.startsWith(`${tenantId}/finance/receipts/`)) {
      return res.status(403).json({ message: 'Acesso negado. O arquivo não pertence ao seu tenant.' });
    }

    const response = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET ?? 'odonto-files',
        Key: key
      })
    );

    if (response.Body) {
      const bytes = await (response.Body as any).transformToByteArray();
      res.setHeader('Content-Type', response.ContentType || 'application/octet-stream');
      return res.send(Buffer.from(bytes));
    } else {
      return res.status(404).json({ message: 'Comprovante não encontrado.' });
    }
  } catch (error: any) {
    console.error('Erro ao buscar comprovante no S3:', error);
    return res.status(500).json({ message: 'Erro ao processar arquivo', error: error.message });
  }
});

