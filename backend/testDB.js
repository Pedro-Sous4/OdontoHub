import pkg from 'pg';
const { Client } = pkg;

async function test() {
  const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5433/odontohub' });
  await client.connect();
  const res = await client.query('SELECT * FROM dentists;');
  console.log(res.rows);
  const res2 = await client.query('SELECT * FROM tenants;');
  console.log(res2.rows);
  await client.end();
}

test().catch(console.error);
