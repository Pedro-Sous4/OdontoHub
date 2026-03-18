import { config } from '../../server/common/config.js';
import { createServiceApp } from '../../server/service-app.js';
import { financeRouter } from './routes.js';

const app = createServiceApp(financeRouter);
app.listen(config.servicePorts.finance, () => {
  console.log(`finance-service na porta ${config.servicePorts.finance}`);
});
