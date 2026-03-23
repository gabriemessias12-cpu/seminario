import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

// Extend Express types so downstream handlers can read req.requestId
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/** Paths that should not produce an access-log line (noise reduction). */
const SILENT_PATHS = new Set(['/api/health']);

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const startAt = process.hrtime.bigint();

  res.on('finish', () => {
    if (SILENT_PATHS.has(req.path)) return;

    const durationMs = Number(process.hrtime.bigint() - startAt) / 1_000_000;

    // Pull userId from the route handler if it attached req.user (via authMiddleware)
    const userId: string | undefined = (req as unknown as { user?: { userId?: string } }).user
      ?.userId;

    logger.info('http request', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
      userId,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}
