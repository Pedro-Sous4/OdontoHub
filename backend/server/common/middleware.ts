import { NextFunction, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyJwt } from './auth.js';
import { AuthRequest } from './types.js';
import { logger } from './logger.js';
import { devConfig } from './config.js';

export function httpLogger(req: AuthRequest, res: Response, next: NextFunction) {
  logger.info({ method: req.method, path: req.path, tenantId: req.auth?.tenantId }, 'http_request');
  next();
}

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false
});

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // Try to use a real JWT first (forwarded by the API Gateway)
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.replace('Bearer ', '');
      req.auth = verifyJwt(token);
      return next();
    } catch {
      // If bypass is enabled, fall through to bypass logic instead of failing
      if (!devConfig.bypassAuth) {
        return res.status(401).json({ message: 'Token inválido' });
      }
    }
  }

  // Bypass de autenticação para ambientes de desenvolvimento (docker/composer)
  if (devConfig.bypassAuth) {
    req.auth = { userId: 'dev', tenantId: devConfig.bypassTenantId, role: 'admin' } as any;
    logger.warn({ auth: req.auth }, 'Autenticação ignorada (BYPASS_AUTH=true)');
    return next();
  }

  return res.status(401).json({ message: 'Token ausente' });
}

export function requireRole(roles: Array<'admin' | 'dentist' | 'receptionist' | 'finance'>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }
    return next();
  };
}
