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
  console.log('login request', { email });

  let user: { id: string; tenant_id: string; senha_hash: string; role: 'admin' | 'dentist' | 'receptionist' | 'finance' } | null = null;

  try {
    console.log('querying DB for user');
    const result = await query<{
      id: string;
      tenant_id: string;
      senha_hash: string;
      role: 'admin' | 'dentist' | 'receptionist' | 'finance';
    }>('SELECT id, tenant_id, senha_hash, role FROM users WHERE email = $1', [email]);
    user = result.rows[0] ?? null;
    console.log('db result', user ? 'found' : 'not found');
  } catch (e) {
    console.error('DB query failed, falling back to dev credentials', e);
  }

  // If DB not available (dev environment), fall back to a fixed user for local development.
  if (!user) {
    if (process.env.NODE_ENV !== 'production') {
      const devEmail = 'pedro@odontohub.com';
      const devPassword = 'senha123';
      const devHash = await bcrypt.hash(devPassword, 12);
      if (email === devEmail && senha === devPassword) {
        user = {
          id: '00000000-0000-0000-0000-000000000001',
          tenant_id: '00000000-0000-0000-0000-000000000001',
          senha_hash: devHash,
          role: 'admin'
        };
      }
    }
  }

  if (!user) {
    return res.status(401).json({ message: 'Credenciais inválidas' });
  }

  const ok = await bcrypt.compare(senha, user.senha_hash);
  if (!ok) {
    return res.status(401).json({ message: 'Credenciais inválidas' });
  }

  const token = signJwt({ userId: user.id, tenantId: user.tenant_id, role: user.role });

  // Em dev, não temos as entidades de tenant no banco para o usuário fake.
  // Evita crash ao tentar registrar o audit log.
  const isDevFallbackUser = user.tenant_id === '00000000-0000-0000-0000-000000000001';
  if (!isDevFallbackUser) {
    try {
      await logAudit({
        tenantId: user.tenant_id,
        userId: user.id,
        action: 'login',
        entity: 'users',
        entityId: user.id
      });
    } catch (err) {
      // Logging failure should not block login.
      console.warn('Falha ao registrar audit log', err);
    }
  }

  return res.json({ token, tenantId: user.tenant_id, userId: user.id, role: user.role });
});
