import { config } from '../../server/common/config.js';
import { createServiceApp } from '../../server/service-app.js';
import { patientsRouter } from './routes.js';

const app = createServiceApp(patientsRouter);
app.listen(config.servicePorts.patients, () => {
  console.log(`patients-service na porta ${config.servicePorts.patients}`);
});
