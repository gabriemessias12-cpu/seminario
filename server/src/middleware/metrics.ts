import { Request, Response, NextFunction } from 'express';

// ── In-memory metrics store ────────────────────────────────────────────────

const startedAt = Date.now();

interface RouteMetric {
  count: number;
  errors: number;
  totalMs: number;
  /** Sorted list of the last 1 000 latencies for percentile calculation. */
  latencies: number[];
}

const routes = new Map<string, RouteMetric>();

function routeKey(method: string, path: string): string {
  // Normalise dynamic segments so /aula/123 and /aula/456 share a bucket
  const normalized = path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
  return `${method} ${normalized}`;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── Global counters ────────────────────────────────────────────────────────

let totalRequests = 0;
let totalErrors = 0;
let total4xx = 0;
let total5xx = 0;

// ── Middleware ─────────────────────────────────────────────────────────────

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startAt) / 1_000_000;
    const key = routeKey(req.method, req.path);

    totalRequests++;
    if (res.statusCode >= 400) totalErrors++;
    if (res.statusCode >= 400 && res.statusCode < 500) total4xx++;
    if (res.statusCode >= 500) total5xx++;

    let metric = routes.get(key);
    if (!metric) {
      metric = { count: 0, errors: 0, totalMs: 0, latencies: [] };
      routes.set(key, metric);
    }

    metric.count++;
    if (res.statusCode >= 400) metric.errors++;
    metric.totalMs += durationMs;

    // Keep at most 1 000 latencies per route (circular-ish: drop oldest when full)
    metric.latencies.push(durationMs);
    if (metric.latencies.length > 1000) metric.latencies.shift();
    metric.latencies.sort((a, b) => a - b);
  });

  next();
}

// ── Snapshot builder ───────────────────────────────────────────────────────

export function getMetrics() {
  const mem = process.memoryUsage();

  const routeStats = Array.from(routes.entries()).map(([key, m]) => ({
    route: key,
    count: m.count,
    errors: m.errors,
    errorRate: m.count > 0 ? +(m.errors / m.count).toFixed(4) : 0,
    avgMs: m.count > 0 ? +(m.totalMs / m.count).toFixed(2) : 0,
    p50Ms: +percentile(m.latencies, 50).toFixed(2),
    p95Ms: +percentile(m.latencies, 95).toFixed(2),
    p99Ms: +percentile(m.latencies, 99).toFixed(2),
  }));

  // Sort by count desc
  routeStats.sort((a, b) => b.count - a.count);

  return {
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    requests: {
      total: totalRequests,
      errors: totalErrors,
      errorRate: totalRequests > 0 ? +(totalErrors / totalRequests).toFixed(4) : 0,
      '4xx': total4xx,
      '5xx': total5xx,
    },
    memory: {
      heapUsedMb: +(mem.heapUsed / 1_048_576).toFixed(2),
      heapTotalMb: +(mem.heapTotal / 1_048_576).toFixed(2),
      rssMb: +(mem.rss / 1_048_576).toFixed(2),
    },
    routes: routeStats,
  };
}
