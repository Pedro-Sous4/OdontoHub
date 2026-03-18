import cors from 'cors';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './common/config.js';
import { apiLimiter, httpLogger } from './common/middleware.js';

const app = express();
app.use(cors());
// NOTE: Do NOT parse the request body here (e.g., express.json()),
// because this is a reverse proxy and parsing will consume the stream
// and break proxying of JSON requests.
app.use(httpLogger);
app.use(apiLimiter);

const useContainerHosts = process.env.USE_CONTAINER_HOSTS === 'true';

function hostFor(serviceName: string, port: number) {
  const host = useContainerHosts ? serviceName : 'localhost';
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

app.use('/api/auth', createProxyMiddleware({ target: services.auth, changeOrigin: true, pathRewrite: { '^/api/auth': '' } }));
app.use('/api/patients', createProxyMiddleware({ target: services.patients, changeOrigin: true, pathRewrite: { '^/api/patients': '' } }));
app.use('/api/agenda', createProxyMiddleware({ target: services.agenda, changeOrigin: true, pathRewrite: { '^/api/agenda': '' } }));
app.use('/api/prontuario', createProxyMiddleware({ target: services.prontuario, changeOrigin: true, pathRewrite: { '^/api/prontuario': '' } }));
app.use('/api/finance', createProxyMiddleware({ target: services.finance, changeOrigin: true, pathRewrite: { '^/api/finance': '' } }));
app.use('/api/tiss', createProxyMiddleware({ target: services.tiss, changeOrigin: true, pathRewrite: { '^/api/tiss': '' } }));
app.use('/api/whatsapp', createProxyMiddleware({ target: services.whatsapp, changeOrigin: true, ws: true, pathRewrite: { '^/api/whatsapp': '' } }));
app.use('/api/google-sync', createProxyMiddleware({ target: services.google, changeOrigin: true, pathRewrite: { '^/api/google-sync': '' } }));
app.use('/api/notifications', createProxyMiddleware({ target: services.notification, changeOrigin: true, pathRewrite: { '^/api/notifications': '' } }));

app.listen(config.apiGatewayPort, () => {
  console.log(`API Gateway ativo na porta ${config.apiGatewayPort}`);
});
