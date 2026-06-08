import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; role: 'admin' | 'provider' | 'user' };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access Token Missing' });

  jwt.verify(token, env.JWT_ACCESS_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token Refused / Expired' });
    req.user = user as AuthenticatedRequest['user'];
    next();
  });
}

export function requireRole(roles: ('admin' | 'provider' | 'user')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(432).json({ error: 'Permission Denied: Insufficient clearance level detected.' });
    }
    next();
  };
}
