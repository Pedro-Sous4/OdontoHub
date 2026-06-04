import { Router } from 'express';
import { query } from '../../server/common/db.js';
import { AuthRequest } from '../../server/common/types.js';
import { requireRole } from '../../server/common/middleware.js';
import { logAudit } from '../../server/common/audit.js';

export const stockRouter = Router();

// Listar todos os itens do estoque
stockRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const result = await query(
      `SELECT id, nome, quantidade, nivel_minimo, unidade
       FROM stock
       WHERE tenant_id = $1
       ORDER BY nome ASC`,
      [tenantId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('[STOCK] Erro ao listar itens:', error);
    return res.status(500).json({ message: 'Erro interno no serviço de estoque.' });
  }
});

// Criar um novo item no estoque
stockRouter.post('/', requireRole(['admin', 'dentist']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { nome, quantidade, nivel_minimo, unidade } = req.body;

    const created = await query<{ id: string }>(
      `INSERT INTO stock (tenant_id, nome, quantidade, nivel_minimo, unidade)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [tenantId, nome, quantidade, nivel_minimo, unidade]
    );

    await logAudit({
      tenantId,
      userId: req.auth?.userId,
      action: 'create',
      entity: 'stock',
      entityId: created.rows[0].id
    });

    return res.status(201).json({ id: created.rows[0].id });
  } catch (error) {
    console.error('[STOCK] Erro ao criar item:', error);
    return res.status(500).json({ message: 'Erro interno no serviço de estoque.' });
  }
});

// Atualizar um item do estoque
stockRouter.put('/:id', requireRole(['admin', 'dentist']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { id } = req.params;
    const { nome, quantidade, nivel_minimo, unidade } = req.body;

    const result = await query(
      `UPDATE stock
       SET nome = $1, quantidade = $2, nivel_minimo = $3, unidade = $4, updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6`,
      [nome, quantidade, nivel_minimo, unidade, id, tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Item não encontrado.' });
    }

    await logAudit({
      tenantId,
      userId: req.auth?.userId,
      action: 'update',
      entity: 'stock',
      entityId: id
    });

    return res.json({ message: 'Item atualizado com sucesso.' });
  } catch (error) {
    console.error('[STOCK] Erro ao atualizar item:', error);
    return res.status(500).json({ message: 'Erro interno no serviço de estoque.' });
  }
});

// Excluir um item do estoque
stockRouter.delete('/:id', requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { id } = req.params;

    const result = await query(
      `DELETE FROM stock
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Item não encontrado.' });
    }

    await logAudit({
      tenantId,
      userId: req.auth?.userId,
      action: 'delete',
      entity: 'stock',
      entityId: id
    });

    return res.json({ message: 'Item excluído com sucesso.' });
  } catch (error) {
    console.error('[STOCK] Erro ao excluir item:', error);
    return res.status(500).json({ message: 'Erro interno no serviço de estoque.' });
  }
});
