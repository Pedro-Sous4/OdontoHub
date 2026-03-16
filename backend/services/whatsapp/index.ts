import http from 'node:http';
import { Server } from 'socket.io';
import { config } from '../../server/common/config.js';
import { createServiceApp } from '../../server/service-app.js';
import { whatsappRouter } from './routes.js';
import { createWhatsAppQueueWorker } from './queueWorker.js';
import { keepAliveAllSessions, setWhatsAppSocketNotifier } from './manager.js';

const app = createServiceApp(whatsappRouter);
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

io.on('connection', (socket) => {
  const tenantId = String(socket.handshake.query.tenantId ?? '');
  if (tenantId) {
    socket.join(`tenant:${tenantId}`);
  }
});

setWhatsAppSocketNotifier((tenantId, event, payload) => {
  io.to(`tenant:${tenantId}`).emit(event, payload);
});

setInterval(async () => {
  await keepAliveAllSessions();
}, 5 * 60 * 1000);

const whatsappQueueWorker = createWhatsAppQueueWorker();
whatsappQueueWorker.on('completed', (job) => {
  console.log(`WhatsApp queue job concluído: ${job.id}`);
});

server.listen(config.servicePorts.whatsapp, () => {
  console.log(`whatsapp-service na porta ${config.servicePorts.whatsapp}`);
});
