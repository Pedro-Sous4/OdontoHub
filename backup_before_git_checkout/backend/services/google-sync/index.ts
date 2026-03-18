import { config } from '../../server/common/config.js';
import { createServiceApp } from '../../server/service-app.js';
import { googleSyncRouter } from './routes.js';

const app = createServiceApp(googleSyncRouter);
app.listen(config.servicePorts.googleSync, () => {
  console.log(`google-sync-service na porta ${config.servicePorts.googleSync}`);
});
