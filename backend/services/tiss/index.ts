import { config } from '../../server/common/config.js';
import { createServiceApp } from '../../server/service-app.js';
import { tissRouter } from './routes.js';

const app = createServiceApp(tissRouter);
app.listen(config.servicePorts.tiss, () => {
  console.log(`tiss-service na porta ${config.servicePorts.tiss}`);
});
