import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vinha-nova-secret-key-2024';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'vinha-nova-refresh-secret-2024';

export interface AuthPayload {
  userId: string;
  email: string;
  papel: string;
  nome: string;
}

export interface VideoTokenPayload {
  type: 'video';
  userId: string;
  aulaId: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export function generateTokens(payload: AuthPayload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as AuthPayload;
}

export function generateVideoToken(payload: Omit<VideoTokenPayload, 'type'>) {
  return jwt.sign({ ...payload, type: 'video' }, JWT_SECRET, { expiresIn: '6h' });
}

export function verifyVideoToken(token: string): VideoTokenPayload {
  const payload = jwt.verify(token, JWT_SECRET) as VideoTokenPayload;
  if (payload.type !== 'video') {
    throw new Error('Tipo de token invalido');
  }
  return payload;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || (req.user.papel !== 'admin' && req.user.papel !== 'pastor')) {
    res.status(403).json({ error: 'Acesso restrito a administradores' });
    return;
  }
  next();
}

export { JWT_SECRET, JWT_REFRESH_SECRET };
