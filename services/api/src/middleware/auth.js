import jwt from 'jsonwebtoken';
import { config } from '../config.js';
export function supabaseAuth(req, res, next) {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
        return res.status(401).json({ error: 'Missing bearer token' });
    }
    try {
        const decoded = jwt.verify(token, config.supabaseJwtSecret);
        if (!decoded?.sub) {
            return res.status(401).json({ error: 'Invalid token payload' });
        }
        req.auth = {
            userId: decoded.sub,
            email: decoded.email ?? '',
            role: decoded.role,
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
