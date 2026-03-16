import { query } from './db.js';

export async function logAudit(params: {
  tenantId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  payload?: unknown;
}) {
  await query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.tenantId,
      params.userId ?? null,
      params.action,
      params.entity,
      params.entityId ?? null,
      params.payload ? JSON.stringify(params.payload) : null
    ]
  );
}
