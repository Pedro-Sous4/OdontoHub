import { Router } from 'express';
import { query } from '../../server/common/db.js';
import { AuthRequest } from '../../server/common/types.js';
import { requireAuth, requireRole } from '../../server/common/middleware.js';
import { logAudit } from '../../server/common/audit.js';

export const settingsRouter = Router();

// Apply authentication to all settings routes
settingsRouter.use(requireAuth);

// --- DENTISTS ---
settingsRouter.get('/dentists', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const result = await query(
    'SELECT id, nome, especialidade, cor_agenda, google_email FROM dentists WHERE tenant_id = $1 ORDER BY nome ASC',
    [tenantId]
  );
  return res.json(result.rows);
});

settingsRouter.post('/dentists', requireRole(['admin']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { nome, especialidade, cor_agenda } = req.body;
  
  const created = await query(
    'INSERT INTO dentists (tenant_id, nome, especialidade, cor_agenda) VALUES ($1, $2, $3, $4) RETURNING id',
    [tenantId, nome, especialidade, cor_agenda ?? '#3b82f6']
  );
  
  await logAudit({
    tenantId, userId: req.auth!.userId, action: 'create', entity: 'dentists', entityId: created.rows[0].id
  });
  
  return res.status(201).json({ id: created.rows[0].id });
});

settingsRouter.put('/dentists/:id', requireRole(['admin']), async (req: AuthRequest, res) => {
  console.log('PUT /dentists/:id', req.params.id, req.body);
  try {
    const tenantId = req.auth!.tenantId;
    const { id } = req.params;
    const { nome, especialidade, cor_agenda } = req.body;
    
    const result = await query(
      'UPDATE dentists SET nome = $1, especialidade = $2, cor_agenda = $3 WHERE id = $4 AND tenant_id = $5 RETURNING id',
      [nome, especialidade, cor_agenda, id, tenantId]
    );
    console.log('UPDATE result:', result.rowCount);
    
    await logAudit({
      tenantId, userId: req.auth!.userId, action: 'update', entity: 'dentists', entityId: id
    });
    
    return res.json({ message: 'Dentista atualizado' });
  } catch (err: any) {
    console.error('Erro ao atualizar dentista:', err);
    return res.status(500).json({ message: 'Erro interno' });
  }
});

settingsRouter.post('/dentists/:id/unlink-google', requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { id } = req.params;
    
    await query(
      'UPDATE dentists SET google_email = NULL, google_refresh_token = NULL WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    await logAudit({
      tenantId, userId: req.auth!.userId, action: 'unlink-google', entity: 'dentists', entityId: id
    });
    
    return res.json({ message: 'Google Agenda desvinculada com sucesso' });
  } catch (err: any) {
    console.error('Erro ao desvincular Google:', err);
    return res.status(500).json({ message: 'Erro interno' });
  }
});

settingsRouter.delete('/dentists/:id', requireRole(['admin']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { id } = req.params;
  
  await query('DELETE FROM dentists WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  
  await logAudit({
    tenantId, userId: req.auth!.userId, action: 'delete', entity: 'dentists', entityId: id
  });
  
  return res.json({ message: 'Dentista removido' });
});

// --- ROOMS ---
settingsRouter.get('/rooms', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const result = await query('SELECT id, nome FROM rooms WHERE tenant_id = $1 ORDER BY nome ASC', [tenantId]);
  return res.json(result.rows);
});

settingsRouter.post('/rooms', requireRole(['admin']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { nome } = req.body;
  
  const created = await query(
    'INSERT INTO rooms (tenant_id, nome) VALUES ($1, $2) RETURNING id',
    [tenantId, nome]
  );
  
  await logAudit({
    tenantId, userId: req.auth!.userId, action: 'create', entity: 'rooms', entityId: created.rows[0].id
  });
  
  return res.status(201).json({ id: created.rows[0].id });
});

settingsRouter.put('/rooms/:id', requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { id } = req.params;
    const { nome } = req.body;
    
    await query(
      'UPDATE rooms SET nome = $1 WHERE id = $2 AND tenant_id = $3',
      [nome, id, tenantId]
    );
    
    await logAudit({
      tenantId, userId: req.auth!.userId, action: 'update', entity: 'rooms', entityId: id
    });
    
    return res.json({ message: 'Sala atualizada' });
  } catch (err: any) {
    console.error('Erro ao atualizar sala:', err);
    return res.status(500).json({ message: 'Erro interno' });
  }
});

settingsRouter.delete('/rooms/:id', requireRole(['admin']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { id } = req.params;
  
  await query('DELETE FROM rooms WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  
  await logAudit({
    tenantId, userId: req.auth!.userId, action: 'delete', entity: 'rooms', entityId: id
  });
  
  return res.json({ message: 'Sala removida' });
});

// --- PROCEDURES ---
settingsRouter.get('/procedures', async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const result = await query(
    'SELECT id, nome, duracao_padrao, valor FROM procedures WHERE tenant_id = $1 ORDER BY nome ASC',
    [tenantId]
  );
  return res.json(result.rows);
});

settingsRouter.post('/procedures', requireRole(['admin']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { nome, duracao_padrao, valor } = req.body;
  
  const created = await query(
    'INSERT INTO procedures (tenant_id, nome, duracao_padrao, valor) VALUES ($1, $2, $3, $4) RETURNING id',
    [tenantId, nome, duracao_padrao, valor]
  );
  
  await logAudit({
    tenantId, userId: req.auth!.userId, action: 'create', entity: 'procedures', entityId: created.rows[0].id
  });
  
  return res.status(201).json({ id: created.rows[0].id });
});

settingsRouter.put('/procedures/:id', requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { id } = req.params;
    const { nome, duracao_padrao, valor } = req.body;
    
    await query(
      'UPDATE procedures SET nome = $1, duracao_padrao = $2, valor = $3 WHERE id = $4 AND tenant_id = $5',
      [nome, duracao_padrao, valor, id, tenantId]
    );
    
    await logAudit({
      tenantId, userId: req.auth!.userId, action: 'update', entity: 'procedures', entityId: id
    });
    
    return res.json({ message: 'Procedimento atualizado' });
  } catch (err: any) {
    console.error('Erro ao atualizar proc:', err);
    return res.status(500).json({ message: 'Erro interno' });
  }
});

settingsRouter.delete('/procedures/:id', requireRole(['admin']), async (req: AuthRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { id } = req.params;
  
  await query('DELETE FROM procedures WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  
  await logAudit({
    tenantId, userId: req.auth!.userId, action: 'delete', entity: 'procedures', entityId: id
  });
  
  return res.json({ message: 'Procedimento removido' });
});
