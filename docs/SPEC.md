# OdontoHub - Especificacao Tecnica (Technical Spec)

**Versao:** 1.1  
**Data:** 02/04/2026  
**Autores:** Joao Paulo da Silva Cardoso

---

## 1. Visao Geral

O **OdontoHub** e uma plataforma SaaS multi-tenant para gestao completa de clinicas odontologicas, projetada para escala enterprise. A plataforma permite que clinicas gerenciem agenda, pacientes, prontuario clinico, financeiro e convenios (TISS), tudo em um unico ambiente integrado.

### 1.1 Objetivo

Entregar uma solucao completa, escalavel e segura que centralize todas as operacoes de uma clinica odontologica, eliminando a necessidade de multiplos sistemas fragmentados, com capacidade para atender ate **10.000 clinicas** e processar ate **100.000 consultas/dia**.

### 1.2 Publico-Alvo

| Segmento | Descricao |
|---|---|
| Clinicas pequenas | 1-3 dentistas, necessitam de agenda + pacientes + financeiro basico |
| Clinicas medias | 4-10 dentistas, prontuario digital + convenios + comunicacao automatizada |
| Redes/Franquias | 10+ unidades, relatorios consolidados + RBAC avancado + TISS em escala |

### 1.3 Papeis do Sistema (Roles)

| Role | Permissoes principais |
|---|---|
| `admin` | Acesso total: configuracoes da clinica, usuarios, financeiro, relatorios |
| `dentist` | Agenda propria, prontuario, planos de tratamento, prescricoes |
| `receptionist` | Agenda de todos, cadastro de pacientes, confirmacao de consultas |
| `finance` | Transacoes financeiras, faturas, pagamentos, relatorios financeiros |

---

## 2. Arquitetura do Sistema

### 2.1 Visao de Alto Nivel

```
                    +------------------+
                    |    Frontend      |
                    |  React + TS +    |
                    |  Vite (SPA)      |
                    +--------+---------+
                             |
                             | HTTP / WebSocket
                             v
                    +------------------+
                    |   API Gateway    |
                    |  Express + Proxy |
                    +--------+---------+
                             |
          +------------------+------------------+
          |                  |                  |
    +-----+-----+     +-----+-----+     +------+----+
    | auth-svc   |     | agenda-svc|     | patients  |
    +------------+     +-----------+     +-----------+
    | prontuario |     | finance   |     | tiss-svc  |
    +------------+     +-----------+     +-----------+
    | whatsapp   |     | google-   |     | notifi-   |
    | service    |     | sync-svc  |     | cation    |
    +-----+------+     +-----+-----+     +-----+-----+
          |                  |                  |
          +------------------+------------------+
                             |
              +--------------+--------------+
              |              |              |
        +-----+----+  +-----+----+  +------+----+
        | PostgreSQL|  |  Redis   |  |  S3/MinIO |
        |  Cluster  |  |  BullMQ  |  |  Storage  |
        +-----------+  +----------+  +-----------+
```

### 2.2 Stack Tecnologica

| Camada | Tecnologia | Versao | Justificativa |
|---|---|---|---|
| Frontend | React + TypeScript | React 18.3+ | Ecossistema maduro, componentes reutilizaveis |
| Bundler | Vite | 5.4+ | Build rapido, HMR instantaneo |
| Calendario | react-big-calendar | 1.13+ | Agenda visual com drag-and-drop |
| Backend | Node.js + TypeScript + Express | Node 22+, Express 4.19 | Runtime eficiente para I/O, tipagem forte |
| Banco de dados | PostgreSQL | 16+ | ACID, JSONB, extensoes, maturidade |
| Fila/Eventos | Redis + BullMQ | Redis 7+, BullMQ 5.9+ | Filas confiaveis, retry automatico, concorrencia |
| Mensageria | whatsapp-web.js | 1.26+ | Conexao WhatsApp (fase futura - suspenso no MVP) |
| WebSocket | Socket.IO | 4.8+ | Comunicacao bidirecional real-time |
| Object Storage | S3 / MinIO | MinIO latest | Armazenamento de arquivos (radiografias, fotos, docs) |
| Infraestrutura | Docker + Docker Compose | - | Ambiente reproduzivel, orquestracao local |
| Autenticacao | JWT + bcrypt | - | Tokens stateless + hashing seguro de senhas |
| Logging | Pino | 9.3+ | Logging estruturado de alta performance |

### 2.3 Microsservicos

Cada servico e um processo Express independente, rodando em seu proprio container Docker.

| Servico | Porta Interna | Responsabilidade |
|---|---|---|
| `api-gateway` | 3000 | Roteamento, proxy para microsservicos, rate limiting |
| `auth-service` | 3001 | Registro de tenant/usuario, login, JWT |
| `patients-service` | 3002 | CRUD de pacientes, upload de documentos (S3) |
| `agenda-service` | 3003 | Consultas, conflitos, disponibilidade, reagendamento |
| `prontuario-service` | 3004 | Prontuario clinico, odontograma, evolucoes |
| `finance-service` | 3005 | Transacoes, faturas, pagamentos |
| `tiss-service` | 3006 | Convenios, guias TISS, submissoes |
| `whatsapp-service` | 3007 | Sessoes WhatsApp (suspenso - fase futura) |
| `google-sync-service` | 3008 | Sincronizacao com Google Calendar |
| `notification-service` | 3009 | Templates, enfileiramento, entrega de notificacoes |
| `worker-service` | - | Consome filas BullMQ (Google Sync, Notificacoes) |

### 2.4 Comunicacao entre Servicos

- **Sincrona:** API Gateway faz proxy HTTP para cada microsservico baseado no prefixo de rota (ex: `/api/auth/*` → `auth-service`).
- **Assincrona:** Eventos sao publicados em filas Redis/BullMQ. Workers consomem e processam de forma desacoplada.

---

## 3. Modelo de Dados

### 3.1 Estrategia Multi-Tenant

O isolamento de dados e feito por **coluna `tenant_id`** em todas as tabelas. Toda query de leitura e escrita filtra obrigatoriamente por `tenant_id`, extraido do JWT.

```
JWT Payload = { tenantId, userId, role, iat, exp }
```

### 3.2 Catalogo de Tabelas (~60 tabelas)

#### Nucleo

| Tabela | Descricao | Relacoes chave |
|---|---|---|
| `tenants` | Clinicas cadastradas | PK raiz de todo o sistema |
| `users` | Usuarios do sistema | → tenants |
| `dentists` | Profissionais | → tenants |
| `patients` | Pacientes | → tenants |
| `rooms` | Salas/consultórios | → tenants |
| `procedures` | Procedimentos odontologicos | → tenants |

#### RBAC (Role-Based Access Control)

| Tabela | Descricao |
|---|---|
| `roles` | Perfis personalizados por tenant |
| `permissions` | Permissoes granulares |
| `role_permissions` | Associacao role ↔ permission |
| `user_roles` | Associacao user ↔ role |

#### Pacientes (Dados Complementares)

| Tabela | Descricao |
|---|---|
| `patient_contacts` | Contatos adicionais |
| `patient_addresses` | Enderecos |
| `patient_allergies` | Alergias e gravidade |
| `patient_medications` | Medicamentos em uso |
| `patient_anamnesis` | Ficha de anamnese (JSONB) |
| `patient_consents` | Termos de consentimento (LGPD) |
| `patient_emergency_contacts` | Contatos de emergencia |
| `patient_files` | Documentos em S3 |

#### Agenda

| Tabela | Descricao |
|---|---|
| `appointments` | Consultas agendadas |
| `appointment_procedures` | Procedimentos vinculados |
| `appointment_history` | Historico de acoes |
| `appointment_notes` | Observacoes da consulta |
| `appointment_reminders` | Lembretes programados |
| `appointment_confirmations` | Confirmacoes de presenca |
| `appointment_waitlist` | Lista de espera |

#### Prontuario Clinico

| Tabela | Descricao |
|---|---|
| `clinical_records` | Registros clinicos |
| `clinical_evolutions` | Evolucoes por consulta |
| `odontograms` | Odontogramas |
| `teeth` | Catalogo de dentes |
| `tooth_conditions` | Condicoes por dente/paciente |
| `radiographs` | Radiografias (URL em S3) |
| `photos` | Fotos intraorais |
| `treatment_plans` | Planos de tratamento |
| `treatment_plan_items` | Itens do plano |
| `prescriptions` | Prescricoes |
| `prescription_items` | Itens da prescricao |
| `vital_signs` | Sinais vitais |

#### Financeiro

| Tabela | Descricao |
|---|---|
| `finance_transactions` | Transacoes financeiras |
| `invoices` | Faturas |
| `payments` | Pagamentos |

#### TISS / Convenios

| Tabela | Descricao |
|---|---|
| `insurance_providers` | Operadoras de convenio |
| `insurance_plans` | Planos disponíveis |
| `patient_insurance` | Carteirinha do paciente |
| `tiss_guides` | Guias TISS |
| `tiss_procedures` | Procedimentos da guia |
| `tiss_submissions` | Envios ao convenio |
| `tiss_batches` | Lotes de envio |
| `tiss_rejections` | Rejeicoes/glossas |
| `tiss_documents` | Documentos da guia |
| `tiss_audit_logs` | Auditoria TISS |

#### Notificacoes

| Tabela | Descricao |
|---|---|
| `notification_templates` | Templates por canal |
| `notification_preferences` | Preferencias do paciente |
| `notification_events` | Eventos de notificacao |
| `notification_deliveries` | Entregas realizadas |
| `notification_failures` | Falhas de entrega |

#### WhatsApp

| Tabela | Descricao |
|---|---|
| `whatsapp_sessions` | Sessoes por tenant |
| `message_logs` | Historico de mensagens |

#### Auditoria

| Tabela | Descricao |
|---|---|
| `audit_logs` | Log de todas as acoes do sistema |

### 3.3 Indices Criticos

```sql
-- Busca de consultas por periodo (query principal da agenda)
CREATE INDEX idx_appointments_time ON appointments (tenant_id, start_time);

-- Verificacao de conflito de horario por dentista
CREATE INDEX idx_appointments_conflict ON appointments (tenant_id, dentist_id, start_time, end_time);

-- Listagem de pacientes
CREATE INDEX idx_patients_tenant_created ON patients (tenant_id, created_at DESC);

-- Transacoes financeiras
CREATE INDEX idx_finance_tenant_created ON finance_transactions (tenant_id, created_at DESC);

-- Prontuario
CREATE INDEX idx_clinical_records_tenant_patient ON clinical_records (tenant_id, patient_id, created_at DESC);

-- Guias TISS
CREATE INDEX idx_tiss_guides_tenant_status ON tiss_guides (tenant_id, status, created_at DESC);

-- Notificacoes
CREATE INDEX idx_notification_events_tenant_status ON notification_events (tenant_id, status, created_at DESC);
```

---

## 4. Fluxos Principais

### 4.1 Autenticacao

```
1. POST /api/auth/register  →  Cria tenant + usuario admin + JWT
2. POST /api/auth/login     →  Valida credenciais, retorna JWT
3. JWT inclui: { tenantId, userId, role }
4. Middleware em cada servico extrai e valida JWT
5. tenant_id e injetado em todas as queries
```

### 4.2 Agenda

```
1. Frontend requisita GET /api/agenda/appointments?start=X&end=Y
   (carrega APENAS o periodo visivel - ex: semana atual)

2. Para criar consulta:
   a. POST /api/agenda/appointments
   b. Verificacao de conflito:
      SELECT * FROM appointments
      WHERE dentist_id = $dentist
        AND start_time < $novo_fim
        AND end_time > $novo_inicio
   c. Persiste no PostgreSQL
   d. Enfileira jobs: google-sync-queue + whatsapp-queue

3. Reagendamento: PUT /api/agenda/appointments/:id/reschedule
4. Cancelamento: PUT /api/agenda/appointments/:id/cancel
5. Fluxo de status: scheduled → confirmed → arrived → in_service → attended
```

### 4.3 Prontuario Digital

```
1. GET /api/prontuario/records/:patientId  →  Lista registros clinicos
2. POST /api/prontuario/records           →  Novo registro
3. POST /api/prontuario/records/:id/evolutions  →  Nova evolucao
4. POST /api/prontuario/patients/:id/tooth-conditions  →  Odontograma
5. Radiografias e fotos sao armazenadas via S3/MinIO
```

### 4.4 WhatsApp (Fase Futura - Suspenso no MVP)

> **Nota (v1.1):** O modulo WhatsApp foi movido para fase futura (Q2 2027).
> A infraestrutura base (schema, filas, workers) esta implementada, mas a integracao
> com `whatsapp-web.js` apresenta riscos (API nao-oficial, crash por incompatibilidade ESM).
> Quando retomado, avaliar a API oficial do WhatsApp Business (Meta Cloud API).

```
1. POST /api/whatsapp/sessions/connect  →  Cria sessao whatsapp-web.js
2. QR Code emitido via WebSocket (evento: whatsapp-qr)
3. client.on('ready') → sessao autenticada
4. Keep-Alive: client.getState() a cada 5 minutos
5. POST /api/whatsapp/send  →  Enfileira mensagem
6. Worker consome fila e envia via client.sendMessage()
7. Registro em message_logs
8. client.on('disconnected') → reconnect automatico
```

### 4.5 Sincronizacao Google Calendar

```
1. Consulta criada no OdontoHub
2. Job entra em google-sync-queue
3. Worker consome e cria evento no Google Calendar
4. google_event_id salvo em appointments
5. O SaaS e a fonte principal; Google e espelho
```

### 4.6 TISS / Convenios

```
1. GET /api/tiss/providers      →  Lista operadoras
2. POST /api/tiss/providers     →  Cadastra operadora
3. POST /api/tiss/guides        →  Cria guia TISS
4. POST /api/tiss/guides/:id/submit  →  Envia guia para convenio
5. Lotes, rejeicoes e documentos sao rastreados
```

### 4.7 Notificacoes

```
1. POST /api/notifications/enqueue  →  Enfileira notificacao
2. Worker processa por canal (whatsapp, email, sms)
3. GET /api/notifications/events    →  Lista historico
4. Falhas registradas em notification_failures
```

---

## 5. Processamento Assincrono

### 5.1 Filas BullMQ

| Fila | Produtor | Consumidor | Funcao |
|---|---|---|---|
| `google-sync-queue` | agenda-service | googleSyncWorker | Sincroniza com Google Calendar |
| `whatsapp-queue` | agenda-service, notification-service | whatsappWorker | Envia mensagens WhatsApp (suspenso) |
| `notification-queue` | agenda-service | notificationWorker | Processa notificacoes multi-canal |

### 5.2 Workers

Cada worker roda em processo separado e suporta concorrencia configuravel via BullMQ.

```typescript
// Exemplo: whatsappWorker
new Worker('whatsapp-queue', async (job) => {
  // 1. Busca sessao do tenant
  // 2. Envia mensagem via whatsapp-web.js
  // 3. Registra em message_logs
}, { connection: redis, concurrency: 5 });
```

---

## 6. Seguranca

### 6.1 Autenticacao e Autorizacao

| Mecanismo | Implementacao |
|---|---|
| Hash de senha | bcrypt com salt factor 12 |
| Token | JWT com expiracao |
| Autorizacao | Role-based (admin, dentist, receptionist, finance) |
| Rate limiting | express-rate-limit por endpoint |

### 6.2 Isolamento de Dados

- Toda query inclui `WHERE tenant_id = $tenantId`
- `tenant_id` extraido do JWT, nunca do request body
- Testes de isolamento: tenant A nunca acessa dados do tenant B

### 6.3 Auditoria

```sql
-- Toda acao relevante registrada
INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, payload)
VALUES ($tenant, $user, 'CREATE', 'appointment', $id, $json);
```

### 6.4 Conformidade LGPD

- Consentimento rastreado em `patient_consents`
- Dados pessoais isolados por tenant
- Logs de auditoria para rastreabilidade de acesso
- Estrutura preparada para exportacao/exclusao de dados pessoais

---

## 7. Escalabilidade

### 7.1 Metas de Scale

| Metrica | Target |
|---|---|
| Clinicas (tenants) | 10.000 |
| Consultas/dia | 100.000 |
| Usuarios concorrentes | 50.000+ |
| Latencia p99 (agenda) | < 200ms |

### 7.2 Estrategias

| Estrategia | Implementacao |
|---|---|
| Servicos stateless | Cada microsservico pode ser replicado horizontalmente |
| Filas desacopladas | BullMQ absorve picos de carga em integrações externas |
| Indices otimizados | Consultas criticas com indices compostos |
| Carga sob demanda | Frontend carrega apenas periodo visivel da agenda |
| Workers concorrentes | `concurrency` configuravel por fila |
| Isolamento de tenant | Queries filtradas, sem cross-tenant leaks |

### 7.3 Caminho para Producao

1. **Docker Compose** → desenvolvimento local e staging
2. **Kubernetes** → producao, com autoscaling por servico
3. **Particionamento** → sharding por tenant_id em cenarios extremos
4. **Observabilidade** → OpenTelemetry + Prometheus + Grafana

---

## 8. Infraestrutura

### 8.1 Docker Compose (Desenvolvimento)

| Container | Imagem | Exposicao |
|---|---|---|
| api (gateway) | Build local | :3000 |
| auth-service | Build local | Interno |
| patients-service | Build local | Interno |
| agenda-service | Build local | Interno |
| prontuario-service | Build local | Interno |
| finance-service | Build local | Interno |
| tiss-service | Build local | Interno |
| whatsapp-service | Build local | Interno |
| google-sync-service | Build local | Interno |
| notification-service | Build local | Interno |
| worker-service | Build local | Interno |
| frontend | Build local | :5173 |
| postgres | postgres:16-alpine | :5433 |
| redis | redis:7-alpine | :6379 |
| minio | minio/minio:latest | :9000, :9001 |

### 8.2 Modos de Execucao

- **Modo leve:** `docker compose up --build` — API Gateway + Frontend + infra
- **Modo completo:** `docker compose --profile full up --build` — Todos os microsservicos + worker

### 8.3 Requisitos de Infraestrutura (Producao)

| Componente | Minimo recomendado |
|---|---|
| WhatsApp (fase futura) | 4 vCPU, 8GB RAM (quando ativado) |
| PostgreSQL | 2 vCPU, 4GB RAM, SSD |
| Redis | 1 vCPU, 2GB RAM |
| API + Workers | 2 vCPU, 4GB RAM por instancia |

---

## 9. Endpoints da API

### 9.1 Autenticacao

| Metodo | Rota | Descricao |
|---|---|---|
| POST | `/api/auth/register` | Registro de clinica + usuario |
| POST | `/api/auth/login` | Login e obter JWT |

### 9.2 Pacientes

| Metodo | Rota | Descricao |
|---|---|---|
| GET | `/api/patients` | Listar pacientes |
| POST | `/api/patients` | Criar paciente |
| POST | `/api/patients/:id/files` | Upload de documento |

### 9.3 Agenda

| Metodo | Rota | Descricao |
|---|---|---|
| GET | `/api/agenda/dentists` | Listar dentistas |
| GET | `/api/agenda/appointments` | Listar consultas (com `?start&end`) |
| POST | `/api/agenda/appointments` | Criar consulta |
| PUT | `/api/agenda/appointments/:id/reschedule` | Reagendar |
| PUT | `/api/agenda/appointments/:id/cancel` | Cancelar |

### 9.4 Prontuario

| Metodo | Rota | Descricao |
|---|---|---|
| GET | `/api/prontuario/records/:patientId` | Registros do paciente |
| POST | `/api/prontuario/records` | Novo registro |
| POST | `/api/prontuario/records/:id/evolutions` | Nova evolucao |
| POST | `/api/prontuario/patients/:id/tooth-conditions` | Condicao do dente |

### 9.5 Financeiro

| Metodo | Rota | Descricao |
|---|---|---|
| GET | `/api/finance/transactions` | Listar transacoes |
| POST | `/api/finance/transactions` | Nova transacao |

### 9.6 TISS

| Metodo | Rota | Descricao |
|---|---|---|
| GET | `/api/tiss/providers` | Listar operadoras |
| POST | `/api/tiss/providers` | Cadastrar operadora |
| POST | `/api/tiss/guides` | Criar guia |
| POST | `/api/tiss/guides/:id/submit` | Enviar guia |

### 9.7 WhatsApp (Suspenso - Fase Futura)

> Endpoints existem mas o servico esta suspenso no MVP. Serao reativados na Fase 4.

| Metodo | Rota | Descricao |
|---|---|---|
| GET | `/api/whatsapp/sessions` | Listar sessoes |
| POST | `/api/whatsapp/sessions/connect` | Conectar (gera QR) |
| GET | `/api/whatsapp/sessions/status` | Status da sessao |
| POST | `/api/whatsapp/sessions/disconnect` | Desconectar |
| GET | `/api/whatsapp/health` | Health check |
| POST | `/api/whatsapp/send` | Enviar mensagem (fila) |
| POST | `/api/whatsapp/send-now` | Enviar imediatamente |

### 9.8 Notificacoes

| Metodo | Rota | Descricao |
|---|---|---|
| POST | `/api/notifications/enqueue` | Enfileirar notificacao |
| GET | `/api/notifications/events` | Historico de eventos |

### 9.9 Google Sync

| Metodo | Rota | Descricao |
|---|---|---|
| POST | `/api/google-sync/appointments/:id/sync` | Sincronizar consulta |

---

## 10. Limitacoes Conhecidas e Riscos

### 10.1 WhatsApp (Suspenso)

> **Status (v1.1):** Modulo suspenso no MVP. O servico apresenta crash por incompatibilidade
> ESM com `whatsapp-web.js`. Sera reavaliado na Fase 4 com possivel migracao para
> a API oficial do WhatsApp Business (Meta Cloud API).

| Risco | Mitigacao |
|---|---|
| Nao usa API oficial da Meta | Avaliar Meta Cloud API na Fase 4 |
| Incompatibilidade ESM com whatsapp-web.js | Corrigir import ou migrar para API oficial |
| Possivel bloqueio de sessao | Rate limiting, considerar API oficial |
| Atualizacoes do WhatsApp Web podem quebrar | Migrar para API oficial mitiga este risco |

### 10.2 Google Calendar

| Status | Descricao |
|---|---|
| Mock ativo | Adapter real ainda nao implementado |
| Producao | Necessario configurar OAuth2 + Google Workspace API |

### 10.3 Observabilidade

- OpenTelemetry ainda nao implementado
- Metricas de fila (BullMQ dashboard) ainda nao configuradas
- Recomendacao: Prometheus + Grafana para producao

---

## Apendice A: Diagrama ER Simplificado

```
tenants ─┬──> users ──> user_roles ──> roles ──> role_permissions ──> permissions
         ├──> dentists
         ├──> patients ─┬──> patient_contacts
         │              ├──> patient_addresses
         │              ├──> patient_allergies
         │              ├──> patient_medications
         │              ├──> patient_anamnesis
         │              ├──> patient_consents
         │              ├──> patient_emergency_contacts
         │              ├──> patient_files
         │              ├──> patient_insurance ──> insurance_plans ──> insurance_providers
         │              └──> clinical_records ──> clinical_evolutions
         │
         ├──> rooms
         ├──> procedures
         ├──> appointments ─┬──> appointment_procedures
         │                  ├──> appointment_history
         │                  ├──> appointment_notes
         │                  ├──> appointment_reminders
         │                  ├──> appointment_confirmations
         │                  └──> tiss_guides ──> tiss_procedures
         │                                   ──> tiss_submissions ──> tiss_rejections
         │
         ├──> finance_transactions
         ├──> invoices ──> payments
         ├──> whatsapp_sessions
         ├──> message_logs
         ├──> notification_events ──> notification_deliveries
         │                        ──> notification_failures
         └──> audit_logs
```
