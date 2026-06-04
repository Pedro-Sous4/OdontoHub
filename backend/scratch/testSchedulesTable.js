const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:postgres@localhost:5432/odontohub'
});

async function run() {
  try {
    const res = await pool.query('SELECT * FROM dentist_schedules LIMIT 1');
    console.log('Query executada com sucesso:', res.rows);
  } catch (err) {
    console.error('Erro ao executar query:', err);
  } finally {
    await pool.end();
  }
}

run();
