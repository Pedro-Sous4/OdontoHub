import { Request } from 'express';

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: 'admin' | 'dentist' | 'receptionist' | 'finance';
}

export interface AuthRequest extends Request {
  auth?: AuthContext;
}
