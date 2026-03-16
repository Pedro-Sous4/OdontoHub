import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { AuthContext } from './types.js';

export function signJwt(payload: AuthContext) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '8h' });
}

export function verifyJwt(token: string): AuthContext {
  return jwt.verify(token, config.jwtSecret) as AuthContext;
}
