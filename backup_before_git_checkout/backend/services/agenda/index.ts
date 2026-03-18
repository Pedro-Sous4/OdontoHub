import { config } from '../../server/common/config.js';
import { createServiceApp } from '../../server/service-app.js';
import { agendaRouter } from './routes.js';

const app = createServiceApp(agendaRouter);
app.listen(config.servicePorts.agenda, () => {
  console.log(`agenda-service na porta ${config.servicePorts.agenda}`);
});
