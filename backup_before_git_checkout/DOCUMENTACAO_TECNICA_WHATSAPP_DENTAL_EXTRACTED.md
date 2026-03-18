Crie um sistema SaaS completo para gestão de clínicas odontológicas em escala enterprise.
O sistema deve ser multi-tenant e suportar até 10.000 clínicas e até 100.000 consultas por dia.
Stack obrigatória:
Frontend:
React + TypeScript
Backend:
Node.js + TypeScript + Express
Banco de dados:
PostgreSQL
Fila:
Redis + BullMQ
Infraestrutura:
Docker
Storage:
S3 ou MinIO
Arquitetura geral:
Frontend (React)
│
▼
API Gateway
│
▼
Microserviços Backend
│
├ auth-service
├ patients-service
├ agenda-service
├ prontuario-service
├ finance-service
├ tiss-service
├ whatsapp-service
├ google-sync-service
└ notification-service
│
▼
PostgreSQL Cluster
│
▼
Redis Queue
│
▼
Workers
Todas as tabelas devem possuir coluna tenant_id para isolamento entre clínicas.
Criar arquitetura de banco com aproximadamente 60 tabelas.
Tabelas principais:
TENANTS
id
nome_clinica
cnpj
email
telefone
endereco
created_at
USERS
id
tenant_id
nome
email
senha_hash
role
created_at
ROLES
id
tenant_id
nome
PERMISSIONS
id
nome
ROLE_PERMISSIONS
role_id
permission_id
DENTISTS
id
tenant_id
nome
cro
especialidade
cor_agenda
ROOMS
id
tenant_id
nome
tipo
PATIENTS
id
tenant_id
nome
cpf
telefone
email
data_nascimento
endereco
created_at
PATIENT_DOCUMENTS
id
tenant_id
patient_id
tipo_documento
arquivo_url
PROCEDURES
id
tenant_id
nome
duracao_padrao
valor_base
APPOINTMENTS
id
tenant_id
patient_id
dentist_id
room_id
start_time
end_time
status
google_event_id
created_at
APPOINTMENT_PROCEDURES
appointment_id
procedure_id
duracao
valor
APPOINTMENT_HISTORY
id
tenant_id
appointment_id
acao
usuario_id
data
PRONTUÁRIO ODONTOLÓGICO DIGITAL
Criar módulo completo de prontuário.
Tabelas:
CLINICAL_RECORDS
id
tenant_id
patient_id
dentist_id
appointment_id
descricao
created_at
CLINICAL_EVOLUTIONS
id
tenant_id
clinical_record_id
observacoes
created_at
ODONTOGRAMS
id
tenant_id
patient_id
created_at
TEETH
id
numero_dente
nome
TOOTH_CONDITIONS
id
tenant_id
tooth_id
patient_id
condicao
data
RADIOGRAPHS
id
tenant_id
patient_id
imagem_url
descricao
created_at
PHOTOS
id
tenant_id
patient_id
imagem_url
descricao
FINANCEIRO
FINANCE_TRANSACTIONS
id
tenant_id
patient_id
appointment_id
valor
tipo
status
created_at
INVOICES
id
tenant_id
patient_id
valor_total
status
created_at
PAYMENTS
id
tenant_id
invoice_id
forma_pagamento
valor
data_pagamento
CONVÊNIOS / TISS
Criar módulo de faturamento compatível com padrão TISS.
Tabelas:
INSURANCE_PROVIDERS
id
tenant_id
nome
codigo_ans
INSURANCE_PLANS
id
tenant_id
provider_id
nome_plano
PATIENT_INSURANCE
id
tenant_id
patient_id
plan_id
numero_carteira
TISS_GUIDES
id
tenant_id
patient_id
appointment_id
numero_guia
status
TISS_PROCEDURES
id
guide_id
procedure_id
valor
TISS_SUBMISSIONS
id
tenant_id
guia_id
data_envio
status
AGENDA ESCALÁVEL
Criar agenda-service responsável por:
criação de consultas
reagendamento
cancelamento
cálculo de disponibilidade
Antes de criar consulta verificar conflito:
SELECT *
FROM appointments
WHERE dentist_id = $dentist
AND start_time < $novo_fim
AND end_time > $novo_inicio;
Criar índices:
CREATE INDEX idx_appointments_time
ON appointments (tenant_id, start_time);
A agenda deve carregar apenas período visível (ex: semana atual).
SINCRONIZAÇÃO COM GOOGLE CALENDAR
O sistema SaaS é a fonte principal da agenda.
Fluxo:
consulta criada
↓
evento enviado para fila
↓
worker sincroniza
↓
cria evento no Google Calendar
↓
salva google_event_id
INTEGRAÇÃO WHATSAPP
Criar serviço utilizando biblioteca whatsapp-web.js.
Funcionalidades:
conexão via QR Code
sessão persistente
envio automático de mensagens
lembretes de consulta
confirmação de consulta
Implementar keep-alive a cada 5 minutos.
NOTIFICAÇÕES
Criar notification-service para:
lembrete de consulta
confirmação
avisos financeiros
PROCESSAMENTO ASSÍNCRONO
Todas integrações externas devem ser feitas via fila Redis.
Exemplo:
agenda cria consulta
↓
job enviado para fila
↓
worker executa
ESCALABILIDADE
Arquitetura preparada para:
10.000 clínicas
100.000 consultas/dia
Separar:
API
Workers
Serviços externos
Criar docker-compose com:
api
postgres
redis
worker
whatsapp-service
SEGURANÇA
Implementar:
JWT
controle de permissões
criptografia de senha
logs de auditoria
CONFORMIDADE
Sistema deve seguir boas práticas da Lei Geral de Proteção de Dados.
DOCUMENTAÇÃO
Gerar documentação explicando:
arquitetura
fluxo da agenda
fluxo do prontuário
fluxo TISS
integração WhatsApp
integração Google Calendar
Gerar código limpo, modular e pronto para produção.
DOCUMENTAÇÃO TÉCNICA
Integração WhatsApp Web para SaaS (QR Code + Sessão Persistente)
1. Visão Geral da Arquitetura
O sistema permitirá que cada cliente do SaaS conecte seu próprio WhatsApp escaneando um QR Code.
Fluxo geral:
Cliente entra no SaaS
↓
Clica "Conectar WhatsApp"
↓
Servidor Node cria sessão
↓
Gera QR Code
↓
Cliente escaneia no celular
↓
Sessão autenticada
↓
Sessão salva
↓
Mensagens enviadas automaticamente
Arquitetura recomendada:
Frontend (React)
        ↓
API Gateway
        ↓
Backend Node.js
        ↓
Módulo WhatsApp
        ↓
whatsapp-web.js
        ↓
WhatsApp Web
2. Tecnologias Utilizadas
Backend:
Node.js
Express
whatsapp-web.js
Puppeteer
Redis (opcional)
MongoDB ou PostgreSQL
Frontend:
React
Socket.io (para QR em tempo real)
Infraestrutura:
Docker
Redis
VPS ou Kubernetes
3. Estrutura de Pastas Recomendada
backend/
 ├ src/
 │  ├ whatsapp/
 │  │  ├ sessions/
 │  │  ├ whatsappManager.js
 │  │  ├ whatsappEvents.js
 │  │  ├ sendMessage.js
 │  │  └ sessionStore.js
 │  │
 │  ├ api/
 │  │  ├ connectWhatsapp.js
 │  │  ├ disconnectWhatsapp.js
 │  │  ├ sendMessageRoute.js
 │  │
 │  ├ services/
 │  │  └ appointmentReminder.js
 │
 ├ database/
 ├ logs/
 └ server.js
4. Instalação das Dependências
npm install whatsapp-web.js qrcode express socket.io puppeteer
5. Criação do Gerenciador de Sessões
Arquivo:
whatsappManager.js
Função principal:
iniciar cliente
salvar sessão
reconectar automaticamente
Exemplo base:
const { Client, LocalAuth } = require('whatsapp-web.js');

function createClient(userId) {

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: userId
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    }
  });

  return client;
}

module.exports = { createClient };
6. Geração de QR Code
Evento principal:
client.on('qr')
Exemplo:
const qrcode = require('qrcode');

client.on('qr', async (qr) => {

   const qrImage = await qrcode.toDataURL(qr);

   socket.emit('whatsapp-qr', {
       userId,
       qr: qrImage
   });

});
Fluxo:
Cliente abre tela
↓
Frontend chama API
↓
Servidor cria sessão
↓
QR gerado
↓
QR enviado via websocket
7. Autenticação
Evento:
client.on('authenticated')
Exemplo:
client.on('authenticated', () => {

  console.log("WhatsApp autenticado");

});
8. Confirmação de Conexão
Evento:
client.on('ready')
Exemplo:
client.on('ready', () => {

  console.log("WhatsApp conectado");

  socket.emit("whatsapp-connected", userId);

});
9. Persistência de Sessão
Para evitar reconexões, use:
LocalAuth
Isso salva sessão automaticamente em:
.wwebjs_auth/
Estrutura:
.wwebjs_auth/
 ├ session-user1
 ├ session-user2
 ├ session-user3
Cada cliente SaaS terá sua sessão separada.
10. Estratégia Keep Alive (ESSENCIAL)
Sem keep alive, o WhatsApp pode derrubar a sessão após horas.
Estratégia recomendada:
1) Ping interno
Enviar comando leve a cada 5 minutos.
client.getState()
Exemplo:
setInterval(async () => {

   try {
     await client.getState();
   } catch (err) {
     console.log("Erro keep alive");
   }

}, 300000);
2) Listener de desconexão
Evento:
client.on('disconnected')
Exemplo:
client.on('disconnected', (reason) => {

  console.log("WhatsApp desconectado", reason);

  reconnectClient(userId);

});
3) Reconexão automática
Exemplo:
function reconnectClient(userId){

   const client = createClient(userId);

   client.initialize();

}
4) Health Check
Criar endpoint:
GET /whatsapp/health
Resposta:
status: connected
status: disconnected
status: reconnecting
11. Estratégia Anti-Logout
Boas práticas:
✔ evitar múltiplas instâncias
✔ manter puppeteer ativo
✔ não reiniciar container frequentemente
✔ usar armazenamento persistente
12. Envio de Mensagens
Arquivo:
sendMessage.js
Exemplo:
async function sendMessage(userId, phone, message){

   const client = clients[userId];

   const formatted = phone + "@c.us";

   await client.sendMessage(formatted, message);

}
13. Mensagens Automáticas
Exemplo:
Confirmação de consulta.
Olá João 👋

Sua consulta foi confirmada.

📅 Data: 12/04
⏰ Horário: 14:30
📍 Clínica Sorriso
14. Fila de Mensagens (Recomendado)
Use fila para evitar bloqueio.
Opções:
Redis
BullMQ
Fluxo:
Sistema cria consulta
↓
Job entra na fila
↓
Worker envia WhatsApp
15. Escalabilidade
Para SaaS com muitos clientes.
Estrutura:
Load Balancer
      ↓
Node Instance 1
Node Instance 2
Node Instance 3
      ↓
Redis
      ↓
Storage sessões
16. Armazenamento de Sessão em Produção
Nunca use apenas disco local.
Use:
volume docker persistente
ou
S3
ou
NFS
17. Logs
Registrar:
envio mensagem
erro envio
desconexão
reconexão
Estrutura:
logs/whatsapp/
18. Segurança
Recomendações:
✔ limitar envio por minuto
✔ evitar disparos massivos
✔ criptografar tokens de sessão
19. Dashboard para Usuário
Na área do cliente:
WhatsApp
 ├ status conexão
 ├ botão conectar
 ├ botão desconectar
 ├ último envio
20. Botão Desconectar
API:
POST /whatsapp/disconnect
Executa:
client.logout()
21. Monitoramento
Recomenda-se monitorar:
sessões ativas
sessões desconectadas
falhas envio
Ferramentas:
Grafana
Prometheus
22. Estratégia Anti-Bloqueio
Nunca enviar:
❌ marketing massivo
❌ spam
Ideal:
✔ mensagens transacionais
Exemplo:
confirmação consulta
lembrete consulta
reagendamento
23. Infraestrutura Recomendada
Para até 200 sessões:
4 vCPU
8GB RAM
24. Limitações
Esse método não usa API oficial da Meta.
Riscos:
bloqueio
logout remoto
atualização do WhatsApp Web
25. Prompt para Gerar Implementação via IA
Você pode usar este prompt em um agente de código:
Criar módulo completo de integração com WhatsApp Web usando Node.js e whatsapp-web.js.

Requisitos:

- Multi usuário SaaS
- Conexão via QR Code
- Sessões persistentes usando LocalAuth
- Websocket para transmissão do QR
- Reconexão automática
- Sistema keep-alive com ping a cada 5 minutos
- Endpoint para enviar mensagem
- Endpoint para desconectar sessão
- Estrutura de arquivos modular
- Sistema de logs
- Compatível com Express
- Armazenamento de sessão em diretório persistente
- Preparado para Docker

Criar código limpo e documentado.
26. Melhorias Futuras
Adicionar:
✔ envio de mídia
✔ chatbot
✔ confirmação automática
✔ leitura de mensagens
27. Resultado Esperado
Seu SaaS terá:
✔ conexão WhatsApp em 10 segundos
✔ sessões persistentes
✔ reconexão automática
✔ envio automático de mensagens
Sem precisar pagar API oficial.