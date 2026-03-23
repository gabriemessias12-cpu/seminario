import { ErrorRequestHandler, Request } from 'express';
import { logger } from '../utils/logger.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = (req as Request & { requestId?: string }).requestId;
  const isDev = process.env.NODE_ENV !== 'production';

  logger.error('Unhandled route error', {
    requestId,
    method: req.method,
    path: req.path,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({
    error: 'Erro interno do servidor.',
    ...(isDev && { detail: err instanceof Error ? err.message : String(err) }),
    ...(requestId && { requestId }),
  });
};
