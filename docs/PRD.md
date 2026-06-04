# OdontoHub - Product Requirements Document (PRD)

**Versao:** 1.1  
**Data:** 02/04/2026  
**Autores:** Joao Paulo da Silva Cardoso  
**Repositorio:** https://github.com/jpscard/uci_ai/tree/main

---

## 1. Resumo Executivo

O **OdontoHub** e uma plataforma SaaS multi-tenant que centraliza a gestao de clinicas odontologicas em uma unica solucao digital. O produto resolve a fragmentacao de sistemas que clinicas enfrentam hoje, oferecendo agenda inteligente, prontuario digital, gestao financeira e convenios em uma plataforma escalavel para ate 10.000 clinicas simultaneas.

### 1.1 Declaracao do Problema

Clinicas odontologicas no Brasil operam com sistemas fragmentados, planilhas manuais e processos desconectados. Isso gera:
- **Perda de receita** por no-shows e agendamentos desorganizados
- **Ineficiencia operacional** com dados espalhados em multiplas ferramentas
- **Falhas de comunicacao** com pacientes (lembretes manuais, sem confirmacao)
- **Dificuldade com convenios** por processos TISS manuais e sujeitos a erro
- **Risco de conformidade** com LGPD por falta de controle sobre dados sensíveis

### 1.2 Proposta de Valor

> *"Tudo que sua clinica precisa, em um so lugar."*

| Antes (Sem OdontoHub) | Depois (Com OdontoHub) |
|---|---|
| Agenda em papel ou Google Calendar manual | Agenda digital com verificacao de conflito e drag-and-drop |
| Prontuario em fichas fisicas | Prontuario digital com odontograma, evolucoes e fotos |
| Financeiro no Excel | Modulo financeiro integrado com faturas e pagamentos |
| Lembrete por ligacao telefonica | Notificacoes automatizadas para pacientes |
| TISS em formularios manuais | Guias TISS digitais com rastreamento de status |
| Sem visibilidade de dados | Dashboard com metricas em tempo real |

---

## 2. Objetivos e Metricas de Sucesso

### 2.1 Objetivos do Produto

| # | Objetivo | Horizonte |
|---|---|---|
| O1 | Lancamento do MVP com agenda + pacientes + financeiro + configuracoes | Q2 2026 |
| O2 | Prontuario digital completo com odontograma | Q3 2026 |
| O3 | Modulo TISS para faturamento de convenios | Q3 2026 |
| O4 | Onboarding self-service + dashboard de metricas | Q4 2026 |
| O5 | Scale para 1.000 clinicas ativas | Q1 2027 |
| O6 | Comunicacao automatizada (WhatsApp/email) | Q2 2027 |
| O7 | Scale para 10.000 clinicas ativas | Q3 2027 |

### 2.2 KPIs (Key Performance Indicators)

| KPI | Meta | Medicao |
|---|---|---|
| Tempo de agendamento | < 30 segundos | Time-to-complete no frontend |
| Tempo de onboarding | < 15 minutos | Do registro a primeira consulta |
| Uptime do SaaS | 99.5% | Monitoramento de infraestrutura |
| NPS | > 50 | Pesquisa trimestral |
| Churn mensal | < 5% | Cancelamentos / base ativa |
| Taxa de no-show | Reduzir em 40% | Comparativo pre/pos adocao (fase futura com notificacoes) |

---

## 3. Personas

### 3.1 Dr. Marina - Dentista Proprietaria

- **Idade:** 35 anos
- **Clinica:** Pequena, 2 consultórios, 1 recepcionista
- **Dores:** Perde tempo organizando agenda, pacientes nao confirmam, prontuario em fichas
- **Necessidades:** Agenda facil, lembrete automatico, prontuario digital
- **Citacao:** *"Preciso de algo simples que resolva meu dia-a-dia sem complicacao."*

### 3.2 Carlos - Administrador de Rede

- **Idade:** 42 anos
- **Rede:** 8 unidades, 25 dentistas, 3 recepcionistas
- **Dores:** Falta visibilidade consolidada, faturamento TISS manual, sem padronizacao
- **Necessidades:** Dashboard multi-unidade, TISS automatizado, RBAC por unidade
- **Citacao:** *"Preciso ver o panorama geral e garantir que todas as unidades estejam no padrao."*

### 3.3 Ana - Recepcionista

- **Idade:** 28 anos
- **Rotina:** Atende telefone, agenda consultas, confirma presenca
- **Dores:** Tempo gasto em ligacoes, risco de conflito de horario, filas
- **Necessidades:** Tela unica para gerenciar agenda, confirmacao por WhatsApp
- **Citacao:** *"Se o sistema confirmasse a consulta sozinho, eu focaria em quem ta aqui."*

### 3.4 Ricardo - Gestor Financeiro

- **Idade:** 38 anos
- **Responsabilidade:** Faturamento, convenios, cobranca
- **Dores:** TISS manual, glosas frequentes, falta de controle de inadimplencia
- **Necessidades:** Faturas automaticas, rastreamento TISS, relatorio financeiro
- **Citacao:** *"Cada guia TISS que volta como glosa e dinheiro perdido."*

---

## 4. Modulos do Produto

### 4.1 Autenticacao e Onboarding

**Objetivo:** Permitir que clinicas se cadastrem e comecem a usar o sistema em minutos.

| Funcionalidade | Prioridade | Status |
|---|---|---|
| Registro de clinica (tenant) com CNPJ | P0 | Implementado |
| Criacao automatica de usuario admin | P0 | Implementado |
| Login com email/senha → JWT | P0 | Implementado |
| Tela de login com validacao | P0 | Implementado |
| Convite de membros da equipe | P1 | Planejado |
| Login social (Google) | P2 | Planejado |
| Recuperacao de senha | P1 | Planejado |
| 2FA (autenticacao em dois fatores) | P2 | Planejado |

---

### 4.2 Agenda (Modulo Core)

**Objetivo:** Gerenciar consultas com visual intuitivo, prevencao de conflitos e inteligencia de agendamento.

| Funcionalidade | Prioridade | Status |
|---|---|---|
| Calendario semanal/diario com drag-and-drop | P0 | Implementado |
| Visualizacao por dentista (recursos) | P0 | Implementado |
| Verificacao automatica de conflito de horario | P0 | Implementado |
| Criacao de consulta com modal de agendamento | P0 | Implementado |
| Reagendamento (drag-and-drop e API) | P0 | Implementado |
| Cancelamento de consulta | P0 | Implementado |
| Fluxo de status completo (8 estados) | P0 | Implementado |
| Mini-calendario lateral com navegacao mensal | P0 | Implementado |
| Painel lateral com KPIs (confirmadas/canceladas) | P0 | Implementado |
| Inteligencia de agendamento (risco no-show, debito pendente) | P1 | Implementado |
| Alerta de dupla confirmacao para pacientes de alto risco | P1 | Implementado |
| Lista de espera (waitlist) | P2 | Schema pronto |
| Visualizacao mensal | P2 | Planejado |
| Bloqueio de horarios (ferias, intervalos) | P2 | Planejado |
| Recorrencia de consultas | P3 | Planejado |

**Fluxo de Status de Consulta:**

```
scheduled → confirmed → arrived → in_service → attended
    ↓           ↓
rescheduled  cancelled
                         no_show
```

---

### 4.3 Pacientes

**Objetivo:** Cadastro completo de pacientes com historico medico, documentos e conformidade LGPD.

| Funcionalidade | Prioridade | Status |
|---|---|---|
| Cadastro basico (nome, CPF, telefone, email) | P0 | Implementado |
| Listagem e busca de pacientes | P0 | Implementado |
| Upload de documentos (S3/MinIO) | P0 | Implementado |
| Ficha completa na tela de pacientes | P0 | Implementado |
| Cadastro de enderecos | P1 | Schema pronto |
| Contatos adicionais / emergencia | P1 | Schema pronto |
| Historico de alergias | P1 | Schema pronto |
| Medicamentos em uso | P1 | Schema pronto |
| Anamnese digital (JSONB flexivel) | P1 | Schema pronto |
| Termos de consentimento (LGPD) | P1 | Schema pronto |
| Canal preferido para lembretes | P1 | Schema pronto |
| Exportacao de dados do paciente (LGPD) | P2 | Planejado |
| Exclusao de dados pessoais (LGPD) | P2 | Planejado |

---

### 4.4 Prontuario Clinico Digital

**Objetivo:** Registro clinico completo, seguro e acessivel a qualquer momento.

| Funcionalidade | Prioridade | Status |
|---|---|---|
| Criacao de registro clinico vinculado a consulta | P0 | Implementado (API) |
| Evolucoes clinicas (historico de atendimentos) | P0 | Implementado (API) |
| Condicoes por dente (odontograma) | P0 | Implementado (API) |
| Catalogo de dentes | P0 | Schema pronto |
| Upload de radiografias (S3) | P1 | Schema pronto |
| Upload de fotos intraorais | P1 | Schema pronto |
| Plano de tratamento com itens | P1 | Schema pronto |
| Prescricoes digitais | P1 | Schema pronto |
| Sinais vitais | P2 | Schema pronto |
| Visualizacao grafica do odontograma no frontend | P1 | Planejado |
| Assinatura digital do prontuario | P3 | Planejado |
| Compartilhamento seguro com outro profissional | P3 | Planejado |

---

### 4.5 Financeiro

**Objetivo:** Controle financeiro integrado com agenda e convenios.

| Funcionalidade | Prioridade | Status |
|---|---|---|
| Registro de transacoes (receita/despesa) | P0 | Implementado |
| Listagem de transacoes com filtros | P0 | Implementado |
| Interface financeira dedicada (FinanceCenter) | P0 | Implementado |
| Faturas por paciente | P1 | Schema pronto |
| Registro de pagamentos | P1 | Schema pronto |
| Relatorio de faturamento por periodo | P2 | Planejado |
| Relatorio de inadimplencia | P2 | Planejado |
| Dashboard financeiro (graficos) | P2 | Planejado |
| Integracao com gateway de pagamento | P3 | Planejado |
| Nota fiscal eletronica | P3 | Planejado |

---

### 4.6 TISS / Convenios

**Objetivo:** Automatizar o faturamento de convenios com padrao TISS, reduzindo glosas.

| Funcionalidade | Prioridade | Status |
|---|---|---|
| Cadastro de operadoras (ANS) | P0 | Implementado (API) |
| Cadastro de planos | P1 | Schema pronto |
| Vinculo paciente ↔ convenio (carteirinha) | P1 | Schema pronto |
| Criacao de guias TISS | P0 | Implementado (API) |
| Envio de guias | P0 | Implementado (API) |
| Rastreamento de status (enviada, aprovada, rejeitada) | P1 | Schema pronto |
| Lotes de envio | P1 | Schema pronto |
| Registro de glosas/rejeicoes | P1 | Schema pronto |
| Interface visual para gestao de guias | P2 | Planejado |
| Exportacao em formato XML TISS | P2 | Planejado |
| Recurso de glosa | P3 | Planejado |

---

### 4.7 Comunicacao WhatsApp (Fase Futura)

**Objetivo:** Comunicacao automatizada com pacientes via WhatsApp para reduzir no-shows.

> **Decisao de produto (v1.1):** O modulo WhatsApp foi movido para fase futura (Q2 2027).
> A infraestrutura base (schema, filas, workers) ja esta implementada, mas a integracao
> com `whatsapp-web.js` apresenta riscos tecniccos (API nao-oficial, instabilidade) que
> nao justificam investimento no MVP. Quando for o momento, considerar a API oficial
> do WhatsApp Business (Meta Cloud API) como alternativa mais sustentavel.

| Funcionalidade | Prioridade | Status |
|---|---|---|
| Conexao via QR Code (whatsapp-web.js) | P3 | Suspenso |
| Sessao persistente + keep-alive | P3 | Suspenso |
| Envio de mensagens via fila | P3 | Infraestrutura pronta (BullMQ) |
| Interface de mensagens (MessagesCenter) | P3 | Implementado (manter para notificacoes gerais) |
| Templates de mensagem | P3 | Schema pronto |
| Avaliacao da API oficial Meta (Cloud API) | P3 | Planejado |

---

### 4.8 Google Calendar Sync

**Objetivo:** Espelhar a agenda do SaaS no Google Calendar dos profissionais.

| Funcionalidade | Prioridade | Status |
|---|---|---|
| Enfileiramento de sincronizacao (BullMQ) | P0 | Implementado |
| Worker de sincronizacao | P0 | Implementado (mock) |
| Persistencia de google_event_id | P0 | Implementado |
| Integracao real com Google Calendar API | P1 | Planejado |
| Sincronizacao bidirecional | P3 | Planejado |

---

### 4.9 Notificacoes

**Objetivo:** Sistema multi-canal de notificacao para eventos do sistema.

| Funcionalidade | Prioridade | Status |
|---|---|---|
| Enfileiramento de notificacoes | P0 | Implementado |
| Worker de processamento | P0 | Implementado |
| Historico de eventos | P0 | Implementado |
| Registro de falhas | P0 | Implementado |
| Templates por canal (WhatsApp, email, SMS) | P1 | Schema pronto |
| Preferencias do paciente | P1 | Schema pronto |
| Canal de email (SMTP/SES) | P2 | Planejado |
| Canal de SMS | P3 | Planejado |
| Push notification (PWA) | P3 | Planejado |

---

### 4.10 Administracao e Configuracoes

**Objetivo:** Gerenciamento da clinica e controle de acesso.

| Funcionalidade | Prioridade | Status |
|---|---|---|
| RBAC basico (admin, dentist, receptionist, finance) | P0 | Implementado |
| Cadastro de dentistas | P0 | Implementado (seed) |
| Cadastro de salas | P1 | Schema pronto |
| Cadastro de procedimentos | P1 | Schema pronto |
| RBAC granular (roles + permissions customizaveis) | P2 | Schema pronto |
| Configuracoes da clinica (horario, logo, etc.) | P2 | Planejado |
| Gestao de planos/assinatura do SaaS | P3 | Planejado |
| Painel de administracao multi-tenant (super admin) | P3 | Planejado |

---

## 5. Frontend - Interface do Usuario

### 5.1 Estado Atual

A interface e uma SPA (Single Page Application) construida com React + TypeScript + Vite, com as seguintes telas:

| Tela | Descricao | Status |
|---|---|---|
| Login | Autenticacao com email/senha | Implementada |
| Cadastro | Modal de registro de clinica | Implementado |
| Agenda | Calendario com drag-and-drop, mini-cal lateral, KPIs | Implementada |
| Pacientes (PatientsCenter) | CRUD de pacientes com ficha detalhada | Implementada |
| Financeiro (FinanceCenter) | Listagem e registro de transacoes | Implementada |
| Mensagens (MessagesCenter) | Interface de WhatsApp e notificacoes | Implementada |

### 5.2 Design e UX

| Aspecto | Diretriz |
|---|---|
| Layout | Interface limpa e minimalista |
| Icones | Sem icones ou emojis nos elementos visuais |
| Navegacao | Botoes estilizados no topbar (nao menus radio) |
| Responsividade | Layout adaptavel com painel lateral colapsavel em mobile |
| Estado | Sem framework de estado global (useState local) |
| Paleta de cores | Tons suaves e profissionais |

### 5.3 Proximas Evolucoes de UI

| Feature | Prioridade |
|---|---|
| Dashboard com graficos e metricas | P1 |
| Odontograma visual interativo | P1 |
| Tela dedicada para prontuario | P1 |
| Tela dedicada para TISS / convenios | P2 |
| Dark mode | P2 |
| Customizacao de cores por clinica | P3 |
| App mobile (React Native ou PWA) | P3 |

---

## 6. Roadmap

### Fase 1 - MVP Core (Q2 2026) — *Em andamento*

**Foco:** Entregar o nucleo funcional para que uma clinica real consiga operar.

- [x] Arquitetura de microsservicos com Docker
- [x] Autenticacao JWT + multi-tenant
- [x] Agenda com calendario visual (drag-and-drop, conflito, status)
- [x] CRUD de pacientes com ficha detalhada
- [x] Modulo financeiro basico (transacoes)
- [x] Sistema de filas (BullMQ) + Workers assincronos
- [ ] **Seed automatico de dentistas e procedimentos no registro de clinica**
- [ ] **Tela de configuracoes da clinica** (cadastrar dentistas, salas, procedimentos)
- [ ] **Testes end-to-end automatizados**
- [ ] Documentacao de API (Swagger/OpenAPI)

### Fase 2 - Prontuario e TISS (Q3 2026)

**Foco:** Diferenciais clinicos que justificam a adocao do sistema.

- [ ] Prontuario clinico com interface visual
- [ ] Odontograma interativo (visualizacao grafica de dentes)
- [ ] Planos de tratamento com itens
- [ ] Prescricoes digitais
- [ ] Gestao de convenios com UI (operadoras, planos, carteirinhas)
- [ ] Exportacao TISS em XML
- [ ] Relatorios financeiros basicos

### Fase 3 - Growth (Q4 2026)

**Foco:** Funcionalidades que facilitam crescimento e retencao.

- [ ] Onboarding self-service (wizard de configuracao)
- [ ] Recuperacao de senha
- [ ] Convite de membros da equipe
- [ ] Dashboard com graficos e metricas (Chart.js ou Recharts)
- [ ] Integracao real com Google Calendar API
- [ ] Relatorios avancados (faturamento, inadimplencia, produtividade)
- [ ] Notificacoes por email (SMTP/SES)

### Fase 4 - Scale e Comunicacao (Q1-Q3 2027)

**Foco:** Escala, automacao de comunicacao e infraestrutura enterprise.

- [ ] **Integracao WhatsApp** (avaliar API oficial Meta Cloud API vs whatsapp-web.js)
- [ ] Templates de mensagem personalizaveis
- [ ] Confirmacao automatica de consultas via WhatsApp
- [ ] Migracao para Kubernetes
- [ ] Autoscaling de workers
- [ ] Observabilidade (OpenTelemetry + Prometheus + Grafana)
- [ ] Particionamento de dados por tenant
- [ ] 2FA
- [ ] App mobile (PWA)
- [ ] Gestao de planos e billing do SaaS
- [ ] Painel super-admin

---

## 7. Requisitos Nao-Funcionais

| Requisito | Especificacao |
|---|---|
| **Disponibilidade** | 99.5% uptime (objetivo de producao) |
| **Latencia** | p99 < 200ms para endpoints criticos (agenda) |
| **Escalabilidade** | Suporte a 10.000 tenants, 100.000 consultas/dia |
| **Seguranca** | JWT, bcrypt (salt 12), rate limiting, audit logs |
| **Conformidade** | LGPD: consentimento rastreavel, exportacao/exclusao de dados |
| **Isolamento** | Dados 100% isolados por tenant_id em todas as queries |
| **Backup** | Backup diario do PostgreSQL (a configurar) |
| **Monitoramento** | Health checks em todos os servicos |
| **Compatibilidade** | Chrome, Firefox, Edge, Safari (ultimas 2 versoes) |
| **Mobile** | Layout responsivo para telas >= 360px |

---

## 8. Dependencias e Riscos

### 8.1 Dependencias Externas

| Dependencia | Tipo | Impacto |
|---|---|---|
| PostgreSQL | Database | Core. Servico gerenciado ou self-hosted |
| Redis | Message broker | Filas e eventos. Servico gerenciado ou self-hosted |
| MinIO/S3 | Object storage | Arquivos. Substituivel por qualquer S3-compatible |
| Google Calendar API | Servico externo | Sincronizacao. Atualmente em mock |
| whatsapp-web.js | Biblioteca nao-oficial | Fase futura. Risco de breaking changes (considerar API oficial) |

### 8.2 Riscos

| Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|
| Performance com muitos tenants | Baixa | Alto | Indices otimizados, particionamento, Kubernetes |
| Vazamento de dados cross-tenant | Baixa | Critico | Middleware obrigatorio de tenant_id, testes de isolamento |
| LGPD: incidente de dados pessoais | Media | Critico | Consentimento rastreado, audit logs, politica de retencao |
| Dependencia de lib deprecated | Media | Medio | Monitorar releases, abstrair integrações com adapter pattern |

---

## 9. Modelo de Negocios (Inicial)

### 9.1 Planos Propostos

| Plano | Preco/mes | Dentistas | Features |
|---|---|---|---|
| **Starter** | R$ 149 | Ate 2 | Agenda + Pacientes + Financeiro basico |
| **Professional** | R$ 299 | Ate 5 | + Prontuario + Notificacoes + Relatorios |
| **Business** | R$ 499 | Ate 15 | + TISS + Google Sync + WhatsApp + Dashboard avancado |
| **Enterprise** | Sob consulta | Ilimitado | + Multi-unidade + API dedicada + SLA custom |

### 9.2 Metricas de Monetizacao

| Metrica | Descricao |
|---|---|
| MRR | Monthly Recurring Revenue |
| ARPU | Average Revenue Per User (clinica) |
| LTV | Lifetime Value |
| CAC | Customer Acquisition Cost |
| Payback Period | Tempo para recuperar CAC |

---

## 10. Criterios de Aceitacao do MVP

Para considerar o MVP pronto para lancamento beta:

- [ ] Clinica pode se cadastrar e comecar a usar em < 15 minutos
- [ ] Seed automatico de dentistas e procedimentos no registro
- [ ] Tela de configuracoes (cadastrar dentistas, salas, procedimentos)
- [ ] Agenda funcional com verificacao de conflito
- [ ] Cadastro completo de pacientes
- [ ] Financeiro basico (transacoes)
- [ ] Interface responsiva (desktop + mobile)
- [ ] Dados 100% isolados por tenant (teste com 2+ tenants)
- [ ] Zero downtime em deploy (rolling update)
- [ ] Documentacao de API publicada
- [ ] Smoke test automatizado passando

---

## 11. Equipe

| Membro | Papel |
|---|---|
| Felipe Rafael dos Santos Barbosa | Desenvolvimento |
| Joao Paulo da Silva Cardoso | Desenvolvimento |
| Victor Amazonas Viegas Ferreira | Desenvolvimento |

---

## 12. Historico de Revisoes

| Versao | Data | Descricao |
|---|---|---|
| 1.0 | 01/04/2026 | Criacao do documento com base no estado atual do codigo |
| 1.1 | 02/04/2026 | WhatsApp movido para Fase 4 (futura). Foco ajustado para core: configuracoes, seed, prontuario. Roadmap reorganizado. |
