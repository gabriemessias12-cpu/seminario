import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Fail fast on startup if secrets are missing — no weak fallbacks
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET and JWT_REFRESH_SECRET environment variables are required. ' +
    'Generate them with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
  );
}

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

// In-memory refresh token store: jti → userId
// Provides single-use token rotation within a server instance.
// For multi-instance deployments, replace with Redis or DB storage.
const validRefreshTokens = new Map<string, string>();

export function generateTokens(payload: AuthPayload) {
  const accessToken = jwt.sign(payload, JWT_SECRET!, { expiresIn: '2h' });
  const jti = crypto.randomBytes(16).toString('hex');
  const refreshToken = jwt.sign({ ...payload, jti }, JWT_REFRESH_SECRET!, { expiresIn: '7d' });
  validRefreshTokens.set(jti, payload.userId);
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET!) as AuthPayload;
}

export function verifyAndRotateRefreshToken(token: string): { payload: AuthPayload; newTokens: ReturnType<typeof generateTokens> } {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET!) as AuthPayload & { jti?: string };
  const jti = decoded.jti;

  if (!jti || !validRefreshTokens.has(jti)) {
    throw new Error('Refresh token inválido ou já utilizado');
  }

  // Invalidate the old token (rotation)
  validRefreshTokens.delete(jti);

  const newPayload: AuthPayload = {
    userId: decoded.userId,
    email: decoded.email,
    papel: decoded.papel,
    nome: decoded.nome
  };
  return { payload: newPayload, newTokens: generateTokens(newPayload) };
}

export function invalidateRefreshToken(token: string): void {
  try {
    const decoded = jwt.decode(token) as { jti?: string } | null;
    if (decoded?.jti) validRefreshTokens.delete(decoded.jti);
  } catch { /* ignore */ }
}

export function generateVideoToken(payload: Omit<VideoTokenPayload, 'type'>) {
  return jwt.sign({ ...payload, type: 'video' }, JWT_SECRET!, { expiresIn: '30m' });
}

export function verifyVideoToken(token: string): VideoTokenPayload {
  const payload = jwt.verify(token, JWT_SECRET!) as VideoTokenPayload;
  if (payload.type !== 'video') {
    throw new Error('Tipo de token inválido');
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
