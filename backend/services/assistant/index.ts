import { config } from '../../server/common/config.js';
import { createServiceApp } from '../../server/service-app.js';
import { assistantRouter } from './routes.js';

const app = createServiceApp(assistantRouter);
app.listen(config.servicePorts.assistant, () => {
  console.log(`assistant-service na porta ${config.servicePorts.assistant}`);
});
