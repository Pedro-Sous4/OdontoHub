import cors from 'cors';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './common/config.js';
import { apiLimiter, httpLogger } from './common/middleware.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(httpLogger);
app.use(apiLimiter);

const useContainerHosts = process.env.USE_CONTAINER_HOSTS === 'true';

function hostFor(serviceName: string, port: number) {
  const host = useContainerHosts ? serviceName : `localhost`;
  return `http://${host}:${port}`;
}

const services = {
  auth: hostFor('auth-service', config.servicePorts.auth),
  patients: hostFor('patients-service', config.servicePorts.patients),
  agenda: hostFor('agenda-service', config.servicePorts.agenda),
  prontuario: hostFor('prontuario-service', config.servicePorts.prontuario),
  finance: hostFor('finance-service', config.servicePorts.finance),
  tiss: hostFor('tiss-service', config.servicePorts.tiss),
  whatsapp: hostFor('whatsapp-service', config.servicePorts.whatsapp),
  google: hostFor('google-sync-service', config.servicePorts.googleSync),
  notification: hostFor('notification-service', config.servicePorts.notification)
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', services });
});

app.use('/api/auth', createProxyMiddleware({ target: services.auth, changeOrigin: true }));
app.use('/api/patients', createProxyMiddleware({ target: services.patients, changeOrigin: true }));
app.use('/api/agenda', createProxyMiddleware({ target: services.agenda, changeOrigin: true }));
app.use('/api/prontuario', createProxyMiddleware({ target: services.prontuario, changeOrigin: true }));
app.use('/api/finance', createProxyMiddleware({ target: services.finance, changeOrigin: true }));
app.use('/api/tiss', createProxyMiddleware({ target: services.tiss, changeOrigin: true }));
app.use('/api/whatsapp', createProxyMiddleware({ target: services.whatsapp, changeOrigin: true, ws: true }));
app.use('/api/google-sync', createProxyMiddleware({ target: services.google, changeOrigin: true }));
app.use('/api/notifications', createProxyMiddleware({ target: services.notification, changeOrigin: true }));

app.listen(config.apiGatewayPort, () => {
  console.log(`API Gateway ativo na porta ${config.apiGatewayPort}`);
});
