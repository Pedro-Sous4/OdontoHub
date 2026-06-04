import { query } from '../server/common/db.js';
async function main() {
  try {
    const res = await query('SELECT * FROM message_logs ORDER BY created_at DESC LIMIT 5');
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
main();
