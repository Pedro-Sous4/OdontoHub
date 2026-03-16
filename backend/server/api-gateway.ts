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

const services = {
  auth: `http://localhost:${config.servicePorts.auth}`,
  patients: `http://localhost:${config.servicePorts.patients}`,
  agenda: `http://localhost:${config.servicePorts.agenda}`,
  prontuario: `http://localhost:${config.servicePorts.prontuario}`,
  finance: `http://localhost:${config.servicePorts.finance}`,
  tiss: `http://localhost:${config.servicePorts.tiss}`,
  whatsapp: `http://localhost:${config.servicePorts.whatsapp}`,
  google: `http://localhost:${config.servicePorts.googleSync}`,
  notification: `http://localhost:${config.servicePorts.notification}`
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
