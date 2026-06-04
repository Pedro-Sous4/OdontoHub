import { query } from './db.js';

export async function logAudit(params: {
  tenantId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  payload?: unknown;
}) {
  const isDevFallbackUser = params.tenantId === '00000000-0000-0000-0000-000000000001';
  
  if (isDevFallbackUser) {
    console.log('[AUDIT] Ignorando log de auditoria para usuário fallback de dev.');
    return;
  }

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
