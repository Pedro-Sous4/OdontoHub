import { Router } from 'express';
import bcrypt from 'bcrypt';
import { db, query } from '../../server/common/db.js';
import { signJwt } from '../../server/common/auth.js';
import { logAudit } from '../../server/common/audit.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { nomeClinica, cnpj, emailClinica, nome, email, senha, role } = req.body;

  const client = await db.connect();
  await client.query('BEGIN');
  try {
    const tenantResult = await client.query<{ id: string }>(
      'INSERT INTO tenants (nome_clinica, cnpj, email) VALUES ($1, $2, $3) RETURNING id',
      [nomeClinica, cnpj, emailClinica]
    );

    const tenantId = tenantResult.rows[0].id;
    const senhaHash = await bcrypt.hash(senha, 12);

    const userResult = await client.query<{ id: string; role: 'admin' | 'dentist' | 'receptionist' | 'finance' }>(
      'INSERT INTO users (tenant_id, nome, email, senha_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, role',
      [tenantId, nome, email, senhaHash, role ?? 'admin']
    );

    await client.query('COMMIT');
    const user = userResult.rows[0];
    const token = signJwt({ userId: user.id, tenantId, role: user.role });

    await logAudit({
      tenantId,
      userId: user.id,
      action: 'register',
      entity: 'users',
      entityId: user.id
    });

    return res.status(201).json({ token, tenantId, userId: user.id, role: user.role });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(400).json({ message: 'Erro ao criar conta', error });
  } finally {
    client.release();
  }
});

authRouter.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  const result = await query<{
    id: string;
    tenant_id: string;
    senha_hash: string;
    role: 'admin' | 'dentist' | 'receptionist' | 'finance';
  }>('SELECT id, tenant_id, senha_hash, role FROM users WHERE email = $1', [email]);

  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ message: 'Credenciais inválidas' });
  }

  const ok = await bcrypt.compare(senha, user.senha_hash);
  if (!ok) {
    return res.status(401).json({ message: 'Credenciais inválidas' });
  }

  const token = signJwt({ userId: user.id, tenantId: user.tenant_id, role: user.role });

  await logAudit({
    tenantId: user.tenant_id,
    userId: user.id,
    action: 'login',
    entity: 'users',
    entityId: user.id
  });

  return res.json({ token, tenantId: user.tenant_id, userId: user.id, role: user.role });
});
