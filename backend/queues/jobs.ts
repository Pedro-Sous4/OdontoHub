import { googleSyncQueue, notificationQueue, whatsappQueue } from './index.js';

export async function enqueueGoogleSync(data: {
  tenantId: string;
  appointmentId: string;
  patientName: string;
  dentistName: string;
  startTime: string;
  endTime: string;
}) {
  await googleSyncQueue.add('sync-appointment', data, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000
  });
}

export async function enqueueWhatsAppReminder(data: {
  tenantId: string;
  phoneNumber: string;
  patientId: string;
  appointmentId: string;
  message: string;
}) {
  await whatsappQueue.add('send-reminder', data, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000
  });
}

export async function enqueueNotification(data: {
  tenantId: string;
  eventId: string;
  channel: 'whatsapp' | 'email' | 'sms';
  recipient: string;
  subject?: string;
  body: string;
}) {
  await notificationQueue.add('dispatch-notification', data, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000
  });
}
