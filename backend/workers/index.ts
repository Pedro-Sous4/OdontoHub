import { createGoogleSyncWorker } from './googleSyncWorker.js';
import { createNotificationWorker } from './notificationWorker.js';

const googleWorker = createGoogleSyncWorker();
const notificationWorker = createNotificationWorker();

googleWorker.on('completed', (job) => {
  console.log(`Google sync job concluído: ${job.id}`);
});

notificationWorker.on('completed', (job) => {
  console.log(`Notification job concluído: ${job.id}`);
});

console.log('Workers iniciados');
