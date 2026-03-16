# OdontoHub SaaS (Multi-tenant)

Plataforma SaaS para gestão de clínicas odontológicas com arquitetura orientada a microserviços, isolamento por `tenant_id`, filas assíncronas e infraestrutura Docker.

## Stack

- Frontend: React + TypeScript + React Big Calendar
- Backend: Node.js + TypeScript + Express
- Banco: PostgreSQL
- Fila/Eventos: Redis + BullMQ
- Mensageria WhatsApp: `whatsapp-web.js`
- Storage: S3/MinIO

## Arquitetura

```text
Frontend (React)
   |
   v
API Gateway (Express + Proxy)
   |
   v
Microserviços
- auth-service
- patients-service
- agenda-service
- prontuario-service
- finance-service
- tiss-service
- whatsapp-service
- google-sync-service
- notification-service
   |
   +--> PostgreSQL (dados multi-tenant)
   +--> Redis/BullMQ (eventos)
   +--> Workers assíncronos
   +--> S3/MinIO (arquivos)
```

## Estrutura de pastas

```text
backend
├ services
│   ├ auth
│   ├ patients
│   ├ agenda
│   ├ prontuario
│   ├ finance
│   ├ tiss
│   ├ whatsapp
│   ├ google-sync
│   └ notification
├ database
│   ├ migrations
│   └ seeds
├ queues
├ workers
└ server

frontend
```

## Multi-tenant

- Todas as tabelas possuem `tenant_id`.
- Todas as consultas de leitura/escrita filtram por `tenant_id`.
- JWT contém `tenantId`, `userId` e `role`.
- Controle de permissão por role (`admin`, `dentist`, `receptionist`, `finance`).

## Fluxo de Agenda

1. Frontend carrega apenas período visível (semana atual) via `GET /api/agenda/appointments?start&end`.
2. Criação de consulta em `POST /api/agenda/appointments`.
3. Verificação de conflito por dentista:

```sql
SELECT *
FROM appointments
WHERE dentist_id = $dentist
AND start_time < $novo_fim
AND end_time > $novo_inicio;
```

4. Persistência da consulta no PostgreSQL.
5. Enfileiramento de sincronização Google + lembrete WhatsApp no Redis/BullMQ.

## Fluxo de sincronização Google Calendar

1. Consulta criada no SaaS.
2. Evento vai para `google-sync-queue`.
3. Worker consome job assíncrono.
4. Evento é espelhado no Google Calendar (mock pronto para adapter real).
5. `google_event_id` salvo em `appointments`.

> O SaaS é a fonte principal da agenda; Google é espelho.

## Fluxo WhatsApp

1. Sessão criada em `POST /api/whatsapp/sessions/connect`.
2. QR code emitido em tempo real via WebSocket (`whatsapp-qr`).
3. Keep Alive executa ping de sessão a cada 5 minutos.
4. Mensagens e lembretes são enfileirados (`whatsapp-queue`).
5. Worker envia e grava em `message_logs`.

## Escalabilidade para 10.000 clínicas

- Serviços stateless com escalonamento horizontal por container.
- Filas desacoplam tarefas pesadas (Google/WhatsApp).
- Índices para consultas críticas (`appointments` por `tenant_id` + tempo).
- Suporte de concorrência em workers (`concurrency` BullMQ).
- Isolamento de dados por tenant em cada query.

## Segurança

- Autenticação JWT.
- Senhas com `bcrypt` (salt 12).
- Autorização baseada em role.
- Tabela `audit_logs` para rastreabilidade.
- Limitação de taxa por API (`express-rate-limit`).

## Banco de dados

Migração principal: `backend/database/migrations/001_init.sql`
Migração de expansão enterprise: `backend/database/migrations/002_enterprise_expansion.sql`

Inclui tabelas:
- `tenants`
- `users`
- `dentists`
- `patients`
- `rooms`
- `procedures`
- `appointments`
- `finance_transactions`
- `whatsapp_sessions`
- `message_logs`
- `patient_files`
- `audit_logs`

Módulos adicionais (aprox. 60 tabelas totais):
- RBAC: `roles`, `permissions`, `role_permissions`, `user_roles`
- Prontuário: `clinical_records`, `clinical_evolutions`, `odontograms`, `teeth`, `tooth_conditions`, `radiographs`, `photos`
- TISS: `insurance_providers`, `insurance_plans`, `patient_insurance`, `tiss_guides`, `tiss_procedures`, `tiss_submissions`
- Notificações: `notification_templates`, `notification_events`, `notification_deliveries`, `notification_failures`
- Financeiro adicional: `invoices`, `payments`

Índice obrigatório:

```sql
CREATE INDEX idx_appointments_time
ON appointments (tenant_id, start_time);
```

## Como subir com Docker

```bash
docker compose up --build
```

Se o comando `docker` não existir no PATH, instale/abra o Docker Desktop e valide com `docker --version`.

Serviços:
- API Gateway: `http://localhost:3000`
- Frontend: `http://localhost:5173`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO: `http://localhost:9001`

## Endpoints principais

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/patients`
- `POST /api/patients`
- `POST /api/patients/:id/files`
- `GET /api/agenda/dentists`
- `GET /api/agenda/appointments`
- `POST /api/agenda/appointments`
- `PUT /api/agenda/appointments/:id/reschedule`
- `PUT /api/agenda/appointments/:id/cancel`
- `GET /api/finance/transactions`
- `POST /api/finance/transactions`
- `GET /api/prontuario/records/:patientId`
- `POST /api/prontuario/records`
- `POST /api/prontuario/records/:recordId/evolutions`
- `POST /api/prontuario/patients/:patientId/tooth-conditions`
- `GET /api/tiss/providers`
- `POST /api/tiss/providers`
- `POST /api/tiss/guides`
- `POST /api/tiss/guides/:guideId/submit`
- `GET /api/whatsapp/sessions`
- `POST /api/whatsapp/sessions/connect`
- `GET /api/whatsapp/sessions/status`
- `POST /api/whatsapp/sessions/disconnect`
- `GET /api/whatsapp/health`
- `POST /api/whatsapp/send`
- `POST /api/whatsapp/send-now`
- `POST /api/notifications/enqueue`
- `GET /api/notifications/events`
- `POST /api/google-sync/appointments/:id/sync`

## Observações de produção

- Trocar endpoints mocks do Google/WhatsApp por providers reais.
- Adicionar observabilidade (OpenTelemetry + métricas de fila).
- Configurar particionamento e/ou sharding por tenant em cenários extremos.
- Evoluir para Kubernetes com autoscaling de workers e serviços críticos.

## Smoke test automático

Após subir os serviços, execute:

```powershell
pwsh ./scripts/smoke-test.ps1
```

Ou no PowerShell 5:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
```

## Bootstrap 1 comando (Docker + Health + Smoke)

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
```

Prompt CMD:

```cmd
scripts\bootstrap.cmd
```
