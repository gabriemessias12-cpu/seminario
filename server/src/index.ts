import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { loadEnvFiles } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { metricsMiddleware, getMetrics } from './middleware/metrics.js';
import { authMiddleware, adminMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import alunoRoutes from './routes/alunos.js';
import adminRoutes from './routes/admin.js';
import { getAIConfig } from './services/ai-mock.js';
import { ensureSystemAccounts } from './services/system-accounts.js';
import { logger } from './utils/logger.js';

loadEnvFiles();

const app = express();
const PORT = process.env.PORT || 3001;
const uploadRoot = path.resolve('uploads');

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, '');
}

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

for (const dir of ['materials', 'thumbnails', 'videos', 'submissions', 'avatars', 'brand']) {
  fs.mkdirSync(path.join(uploadRoot, dir), { recursive: true });
}

app.use(requestLogger);
app.use(metricsMiddleware);
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled — configured at CDN/reverse-proxy level
app.use(compression({ threshold: 1024 }));
app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, curl, health checks)
    // and explicitly listed browser origins
    if (!origin || corsOrigins.includes(normalizeOrigin(origin))) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin não permitida pelo CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use('/uploads/materials', express.static(path.join(uploadRoot, 'materials')));
app.use('/uploads/thumbnails', express.static(path.join(uploadRoot, 'thumbnails')));
app.use('/uploads/avatars', express.static(path.join(uploadRoot, 'avatars')));
app.use('/api/uploads/materials', express.static(path.join(uploadRoot, 'materials')));
app.use('/api/uploads/thumbnails', express.static(path.join(uploadRoot, 'thumbnails')));
app.use('/api/uploads/avatars', express.static(path.join(uploadRoot, 'avatars')));
app.use('/api/uploads/brand', express.static(path.join(uploadRoot, 'brand')));

app.use('/api/auth', authRoutes);
app.use('/api/aluno', alunoRoutes);
app.use('/api/admin', adminRoutes);
app.use(errorHandler);

// Public brand endpoint — reads same config as admin
app.get('/api/brand/lideranca', (_req, res) => {
  const configPath = path.join(uploadRoot, 'brand', 'config.json');
  const DEFAULT = [
    { slot: 1, name: 'Pr. Marcondes Gomes', objectPosition: 'center center' },
    { slot: 2, name: 'Pra. Allana Marques', objectPosition: 'center 45%' },
    { slot: 3, name: 'Pr. Ralfer Fernandes', objectPosition: 'center 40%' }
  ];
  let config = DEFAULT;
  try { config = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch { /* use defaults */ }
  const slides = config.map((entry) => {
    const filePath = path.join(uploadRoot, 'brand', `lideranca-${entry.slot}.jpg`);
    const hasUpload = fs.existsSync(filePath);
    return { ...entry, url: hasUpload ? `/api/uploads/brand/lideranca-${entry.slot}.jpg` : `/brand/${entry.slot}.jpg` };
  });
  res.json(slides);
});

const prisma = new PrismaClient();

// GET /api/metrics — admin-only runtime metrics
app.get('/api/metrics', authMiddleware, adminMiddleware, (_req, res) => {
  res.json(getMetrics());
});

app.get('/api/health', async (_req, res) => {
  let dbStatus: 'ok' | 'degraded' = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'degraded';
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    db: dbStatus,
    ai: getAIConfig()
  });
});

async function startServer() {
  await ensureSystemAccounts();

  app.listen(PORT, () => {
    logger.info(`IBVN API running on http://localhost:${PORT}`);
  });
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

startServer().catch((error) => {
  logger.error('Erro ao iniciar servidor:', error);
  process.exit(1);
});
