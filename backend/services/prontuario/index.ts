import { config } from '../../server/common/config.js';
import { createServiceApp } from '../../server/service-app.js';
import { prontuarioRouter } from './routes.js';

const app = createServiceApp(prontuarioRouter);
app.listen(config.servicePorts.prontuario, () => {
  console.log(`prontuario-service na porta ${config.servicePorts.prontuario}`);
});
