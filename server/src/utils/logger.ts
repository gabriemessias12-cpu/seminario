export type LogContext = Record<string, unknown>;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function activeLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as LogLevel;
  return LEVEL_PRIORITY[env] !== undefined ? env : 'info';
}

function normalizeArgs(
  msgOrErr: string | unknown,
  second?: LogContext | unknown,
): { message: string; ctx: LogContext } {
  let message: string;
  let ctx: LogContext = {};

  // First arg: string message
  if (typeof msgOrErr === 'string') {
    message = msgOrErr;
    // Second arg: structured context OR an error/unknown value
    if (second !== undefined) {
      if (second instanceof Error) {
        ctx = { error: second.message, stack: second.stack };
      } else if (second !== null && typeof second === 'object' && !Array.isArray(second)) {
        ctx = second as LogContext;
      } else {
        ctx = { detail: String(second) };
      }
    }
  }
  // First arg: Error object
  else if (msgOrErr instanceof Error) {
    message = msgOrErr.message;
    ctx = { stack: msgOrErr.stack };
  }
  // First arg: anything else
  else {
    message = 'Error';
    ctx = { raw: String(msgOrErr) };
  }

  return { message, ctx };
}

function emit(level: LogLevel, msgOrErr: string | unknown, second?: LogContext | unknown): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[activeLevel()]) return;

  const { message, ctx } = normalizeArgs(msgOrErr, second);

  const entry: Record<string, unknown> = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...ctx,
  };

  const line = JSON.stringify(entry);

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msgOrErr: string | unknown, context?: LogContext | unknown) =>
    emit('debug', msgOrErr, context),
  info: (msgOrErr: string | unknown, context?: LogContext | unknown) =>
    emit('info', msgOrErr, context),
  warn: (msgOrErr: string | unknown, context?: LogContext | unknown) =>
    emit('warn', msgOrErr, context),
  error: (msgOrErr: string | unknown, context?: LogContext | unknown) =>
    emit('error', msgOrErr, context),
};
