import { config } from '../../server/common/config.js';
import { createServiceApp } from '../../server/service-app.js';
import { stockRouter } from './routes.js';

const app = createServiceApp(stockRouter);
app.listen(config.servicePorts.stock, () => {
  console.log(`stock-service na porta ${config.servicePorts.stock}`);
});
