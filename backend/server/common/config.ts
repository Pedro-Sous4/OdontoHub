import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiGatewayPort: Number(process.env.API_GATEWAY_PORT ?? 3000),
  servicePorts: {
    auth: Number(process.env.AUTH_SERVICE_PORT ?? 3001),
    patients: Number(process.env.PATIENTS_SERVICE_PORT ?? 3002),
    agenda: Number(process.env.AGENDA_SERVICE_PORT ?? 3003),
    prontuario: Number(process.env.PRONTUARIO_SERVICE_PORT ?? 3007),
    finance: Number(process.env.FINANCE_SERVICE_PORT ?? 3004),
    tiss: Number(process.env.TISS_SERVICE_PORT ?? 3008),
    whatsapp: Number(process.env.WHATSAPP_SERVICE_PORT ?? 3005),
    googleSync: Number(process.env.GOOGLE_SYNC_SERVICE_PORT ?? 3006),
    notification: Number(process.env.NOTIFICATION_SERVICE_PORT ?? 3009),
    worker: Number(process.env.WORKER_SERVICE_PORT ?? 3010)
  },
  jwtSecret: process.env.JWT_SECRET ?? 'change_me',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/odontohub',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379'
};
