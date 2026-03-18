import cors from 'cors';
import express, { Router } from 'express';
import { apiLimiter, httpLogger, requireAuth } from './common/middleware.js';

export function createServiceApp(router: Router, options?: { isPublic?: boolean }) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));
  app.use(httpLogger);
  app.use(apiLimiter);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  if (!options?.isPublic) {
    app.use(requireAuth);
  }

  app.use(router);
  return app;
}
