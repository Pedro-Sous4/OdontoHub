import { Pool, QueryResultRow } from 'pg';
import { config } from './config.js';

export const db = new Pool({
  connectionString: config.databaseUrl,
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return db.query<T>(text, params);
}
