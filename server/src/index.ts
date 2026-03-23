import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { loadEnvFiles } from './config/env.js';
import authRoutes from './routes/auth.js';
import alunoRoutes from './routes/alunos.js';
import adminRoutes from './routes/admin.js';
import { getAIConfig } from './services/ai-mock.js';
import { ensureSystemAccounts } from './services/system-accounts.js';

loadEnvFiles();

const app = express();
const PORT = process.env.PORT || 3001;
const uploadRoot = path.resolve('uploads');
app.disable('x-powered-by');
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

for (const dir of ['materials', 'thumbnails', 'videos', 'submissions', 'avatars', 'brand']) {
  fs.mkdirSync(path.join(uploadRoot, dir), { recursive: true });
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin nao permitida pelo CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
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

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ai: getAIConfig()
  });
});

const prisma = new PrismaClient();

async function startServer() {
  await ensureSystemAccounts();

  app.listen(PORT, () => {
    console.log(`IBVN API running on http://localhost:${PORT}`);
  });
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

startServer().catch((error) => {
  console.error('Erro ao iniciar servidor:', error);
  process.exit(1);
});
