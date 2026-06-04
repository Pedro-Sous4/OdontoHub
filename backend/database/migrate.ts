import { query } from '../server/common/db.js';
import * as fs from 'fs';

async function main() {
  try {
    const sql = fs.readFileSync('./database/migrations/005_stock_materials.sql', 'utf-8');
    
    console.log('Executando migração de estoque...');
    await query(sql);
    console.log('Migração de estoque concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('Erro ao executar migração de estoque:', error);
    process.exit(1);
  }
}

main();
