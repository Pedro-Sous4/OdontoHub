import pg from 'pg';
const { Client } = pg;

async function check() {
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5433/odontohub'
  });
  await client.connect();

  console.log('--- COLUMNS IN finance_payments ---');
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'finance_payments'
  `);
  console.log(cols.rows);

  console.log('--- ENTRIES IN finance_payments ---');
  const entries = await client.query(`
    SELECT id, transaction_id, valor, forma_pagamento, comprovante_key FROM finance_payments
  `);
  console.log(entries.rows);

  await client.end();
}

check().catch(console.error);
