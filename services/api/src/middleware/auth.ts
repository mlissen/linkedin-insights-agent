import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { AuthContext } from '../types.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function supabaseAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const decoded = jwt.verify(token, config.supabaseJwtSecret) as {
      sub: string;
      email?: string;
      role?: string;
    };
    if (!decoded?.sub) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    req.auth = {
      userId: decoded.sub,
      email: decoded.email ?? '',
      role: decoded.role,
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
