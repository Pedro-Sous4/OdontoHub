import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@postgres:5432/odontohub' });

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dentist_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      dentist_id UUID NOT NULL REFERENCES dentists(id) ON DELETE CASCADE,
      dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
      hora_inicio TIME NOT NULL,
      hora_fim TIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, dentist_id, dia_semana)
    );
  `);
  console.log('Migration dentist_schedules aplicada com sucesso.');
  process.exit(0);
}
run();
