import { query } from '../server/common/db.js';
import * as fs from 'fs';

async function main() {
  try {
    console.log('Executando migração 009 (assistant control)...');
    const sql = fs.readFileSync('./database/migrations/009_assistant_control.sql', 'utf-8');
    await query(sql);
    console.log('Migração 009 executada com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('Erro ao executar migração 009:', error);
    process.exit(1);
  }
}

main();
