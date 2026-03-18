import { config } from '../../server/common/config.js';
import { createServiceApp } from '../../server/service-app.js';
import { authRouter } from './routes.js';

const app = createServiceApp(authRouter, { isPublic: true });
app.listen(config.servicePorts.auth, () => {
  console.log(`auth-service na porta ${config.servicePorts.auth}`);
});
