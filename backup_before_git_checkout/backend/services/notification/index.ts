import { config } from '../../server/common/config.js';
import { createServiceApp } from '../../server/service-app.js';
import { notificationRouter } from './routes.js';

const app = createServiceApp(notificationRouter);
app.listen(config.servicePorts.notification, () => {
  console.log(`notification-service na porta ${config.servicePorts.notification}`);
});
