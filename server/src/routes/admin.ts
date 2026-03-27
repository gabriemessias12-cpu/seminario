import { Router, Response } from 'express';
import { PrismaClient, StatusEntrega } from '@prisma/client';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { buildBulletinByModule, buildDeliverySummary, buildModuleFrequencyReport } from '../services/academic-report.js';
import { processAIPipeline, processIAFromTranscript } from '../services/ai-mock.js';
import { logContentChange } from '../services/content-change-log.js';
import { buildStudentProgressDashboard, buildStudentProgressDashboardIndex, normalizeLessonPercentual } from '../services/progress-metrics.js';
import { parseObjectiveQuestions, serializeObjectiveQuestions } from '../utils/objective-assessment.js';
import { sendStoredUpload } from '../utils/stored-file.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, rm, stat, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import crypto from 'crypto';
import { extractYouTubeVideoId, getLessonVideoKind, normalizeLessonVideoUrl } from '../utils/video-source.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

// Validates YouTube video IDs to prevent command injection
function isValidYouTubeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,20}$/.test(id);
}

// Fetch YouTube auto-generated transcript via InnerTube API (no yt-dlp, no Whisper)
// Returns plain text or null if unavailable
async function fetchYoutubeTranscript(videoId: string, preferLang = 'pt'): Promise<string | null> {
  try {
    const playerController = new AbortController();
    const playerTimeout = setTimeout(() => playerController.abort(), 15000);
    let playerRes: globalThis.Response;
    try {
      playerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
        },
        body: JSON.stringify({
          context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
          videoId
        }),
        signal: playerController.signal
      });
    } finally {
      clearTimeout(playerTimeout);
    }
    if (!playerRes.ok) return null;
    const data = await playerRes.json() as any;
    const tracks: any[] = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) return null;
    const track = tracks.find((t) => t.languageCode === preferLang) ?? tracks[0];
    const xmlController = new AbortController();
    const xmlTimeout = setTimeout(() => xmlController.abort(), 15000);
    let xmlRes: globalThis.Response;
    try {
      xmlRes = await fetch(track.baseUrl as string, { signal: xmlController.signal });
    } finally {
      clearTimeout(xmlTimeout);
    }
    if (!xmlRes.ok) return null;
    const xml = await xmlRes.text();
    // Parse <p t="..."><s>word</s><s t="..."> word</s></p> format
    const segments: string[] = [];
    const pMatches = xml.matchAll(/<p\s[^>]*>(<s[^>]*>[^<]*<\/s>)+<\/p>/g);
    for (const pm of pMatches) {
      const words: string[] = [];
      for (const sm of pm[0].matchAll(/<s[^>]*>([^<]*)<\/s>/g)) {
        words.push(sm[1]);
      }
      const line = words.join('').trim();
      if (line) segments.push(line);
    }
    if (segments.length === 0) return null;
    return segments.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return null;
  }
}

// Auto-detect YouTube video duration using yt-dlp (returns seconds, 0 on failure)
async function getYoutubeDuration(videoId: string): Promise<number> {
  if (!isValidYouTubeId(videoId)) return 0;
  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      '--print', 'duration', '--no-playlist', '-q',
      '--extractor-args', 'youtube:player_client=ios,mweb',
      `https://www.youtube.com/watch?v=${videoId}`
    ], { timeout: 30000 });
    const secs = Number(stdout.trim());
    return Number.isFinite(secs) && secs > 0 ? Math.round(secs) : 0;
  } catch {
    return 0;
  }
}

// Auto-detect local file duration using ffprobe (returns seconds, 0 on failure)
async function getFileDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], { timeout: 15000 });
    const secs = Number(stdout.trim());
    return Number.isFinite(secs) && secs > 0 ? Math.round(secs) : 0;
  } catch {
    return 0;
  }
}

const router = Router();
const prisma = new PrismaClient();

function readString(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value === 'true';
  }

  return fallback;
}

function parseStoredDetails(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseStringArray(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : String(item)))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item : String(item)))
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      }
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
  }

  return [];
}

// Multer setup for video uploads
const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.resolve('uploads/videos')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const uploadVideo = multer({ storage: videoStorage, limits: { fileSize: 20 * 1024 * 1024 * 1024 } }); // 20 GB

const materialStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.resolve('uploads/materials')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const uploadMaterial = multer({ storage: materialStorage, limits: { fileSize: 100 * 1024 * 1024 } });

const thumbnailStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.resolve('uploads/thumbnails')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  }
});
const uploadThumbnail = multer({
  storage: thumbnailStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Apenas imagens sao permitidas.'));
    cb(null, true);
  }
});

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.resolve('uploads/avatars')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  }
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas imagens sao permitidas.'));
    }
    cb(null, true);
  }
});

const brandStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.resolve('uploads/brand')),
  filename: (req: any, _file, cb) => {
    const slot = String(req.params?.slot ?? '1').replace(/[^0-9]/g, '').substring(0, 2);
    if (!['1', '2', '3'].includes(slot)) {
      cb(new Error('Slot invalido'), '');
      return;
    }
    cb(null, `lideranca-${slot}.jpg`);
  }
});
const uploadBrand = multer({
  storage: brandStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Apenas imagens sao permitidas.'));
    cb(null, true);
  }
});

const BRAND_CONFIG_PATH = path.resolve('uploads/brand/config.json');
const DEFAULT_LEADERSHIP = [
  { slot: 1, name: 'Pr. Marcondes Gomes', objectPosition: 'center center' },
  { slot: 2, name: 'Pra. Allana Marques', objectPosition: 'center 45%' },
  { slot: 3, name: 'Pr. Ralfer Fernandes', objectPosition: 'center 40%' }
];

function readBrandConfig(): typeof DEFAULT_LEADERSHIP {
  try {
    const raw = fs.readFileSync(BRAND_CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return DEFAULT_LEADERSHIP.map(d => ({ ...d }));
  }
}

function writeBrandConfig(config: typeof DEFAULT_LEADERSHIP) {
  fs.writeFileSync(BRAND_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

// All admin routes require auth + admin role
router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/admin/dashboard
router.get('/dashboard', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const [
      alunos,
      aulasObrigatorias,
      aulasPublicadasBase,
      progressosPublicados,
      avaliacoesPublicadas,
      entregasPublicadas,
      atividadeRecente,
      totalAlunos
    ] = await Promise.all([
      prisma.user.findMany({
        where: { papel: 'aluno' },
        select: {
          id: true,
          nome: true,
          email: true,
          foto: true,
          ultimoAcesso: true
        }
      }),
      prisma.aula.findMany({
        where: {
          publicado: true,
          modulo: { obrigatorio: true }
        },
        select: {
          id: true,
          titulo: true,
          dataPublicacao: true,
          criadoEm: true,
          modulo: {
            select: {
              titulo: true,
              ordem: true
            }
          }
        },
        orderBy: [{ modulo: { ordem: 'asc' } }, { criadoEm: 'asc' }]
      }),
      prisma.aula.findMany({
        where: { publicado: true },
        select: { id: true, titulo: true },
        orderBy: { criadoEm: 'asc' }
      }),
      prisma.progressoAluno.findMany({
        where: { aula: { publicado: true } },
        select: {
          alunoId: true,
          aulaId: true,
          percentualAssistido: true,
          concluido: true
        }
      }),
      prisma.avaliacao.findMany({
        where: { publicado: true },
        select: {
          id: true,
          titulo: true,
          tipo: true,
          dataLimite: true,
          criadoEm: true,
          modulo: { select: { titulo: true } },
          aula: {
            select: {
              titulo: true,
              modulo: { select: { titulo: true } }
            }
          }
        },
        orderBy: [{ dataLimite: 'asc' }, { criadoEm: 'desc' }]
      }),
      prisma.entregaAvaliacao.findMany({
        where: { avaliacao: { publicado: true } },
        select: {
          alunoId: true,
          avaliacaoId: true,
          status: true
        }
      }),
      prisma.loginHistorico.findMany({
        include: { usuario: { select: { nome: true, email: true } } },
        orderBy: { dataHora: 'desc' },
        take: 10
      }),
      prisma.user.count({ where: { papel: 'aluno' } })
    ]);

    const aulasObrigatoriasIds = new Set(aulasObrigatorias.map((aula) => aula.id));
    const progressosObrigatorios = progressosPublicados.filter((progresso) => aulasObrigatoriasIds.has(progresso.aulaId));
    const dashboards = buildStudentProgressDashboardIndex({
      studentIds: alunos.map((aluno) => aluno.id),
      aulasPublicadas: aulasObrigatorias,
      progressos: progressosObrigatorios,
      avaliacoesPublicadas,
      entregas: entregasPublicadas,
      now
    });

    const alunosResumo = alunos.map((aluno) => {
      const painel = dashboards.get(aluno.id) ?? buildStudentProgressDashboard({
        aulasPublicadas: aulasObrigatorias,
        progressos: [],
        avaliacoesPublicadas,
        entregas: [],
        now
      });

      return {
        ...aluno,
        painel
      };
    });

    const alunosAtivos = alunosResumo.filter((aluno) => (
      aluno.ultimoAcesso ? new Date(aluno.ultimoAcesso).getTime() >= seteDiasAtras.getTime() : false
    )).length;

    const progressoMedioAulas = totalAlunos > 0
      ? Math.round(alunosResumo.reduce((sum, aluno) => sum + aluno.painel.progressoAulas.percentual, 0) / totalAlunos)
      : 0;
    const progressoMedioAvaliacoes = totalAlunos > 0
      ? Math.round(alunosResumo.reduce((sum, aluno) => sum + aluno.painel.progressoAvaliacoes.percentual, 0) / totalAlunos)
      : 0;
    const progressoMedioGeral = totalAlunos > 0
      ? Math.round(alunosResumo.reduce((sum, aluno) => sum + aluno.painel.progressoGeral, 0) / totalAlunos)
      : 0;
    const alertasAulasAtrasadas = alunosResumo.reduce((sum, aluno) => sum + aluno.painel.aulasAtrasadas.length, 0);
    const alertasAvaliacoesAtrasadas = alunosResumo.reduce((sum, aluno) => sum + aluno.painel.avaliacoesPendentesAtrasadas.length, 0);

    const alunosAtencao = alunosResumo
      .filter((aluno) => aluno.painel.totalAlertasAtraso > 0 || aluno.painel.progressoGeral < 60)
      .sort((a, b) => {
        if (b.painel.avaliacoesPendentesAtrasadas.length !== a.painel.avaliacoesPendentesAtrasadas.length) {
          return b.painel.avaliacoesPendentesAtrasadas.length - a.painel.avaliacoesPendentesAtrasadas.length;
        }

        if (b.painel.aulasAtrasadas.length !== a.painel.aulasAtrasadas.length) {
          return b.painel.aulasAtrasadas.length - a.painel.aulasAtrasadas.length;
        }

        return a.painel.progressoGeral - b.painel.progressoGeral;
      })
      .slice(0, 10)
      .map((aluno) => ({
        id: aluno.id,
        nome: aluno.nome,
        email: aluno.email,
        foto: aluno.foto,
        progressoAulas: aluno.painel.progressoAulas.percentual,
        progressoAvaliacoes: aluno.painel.progressoAvaliacoes.percentual,
        progressoGeral: aluno.painel.progressoGeral,
        aulasAtrasadas: aluno.painel.aulasAtrasadas.length,
        avaliacoesAtrasadas: aluno.painel.avaliacoesPendentesAtrasadas.length
      }));

    const progressosPorAula = new Map<string, number[]>();

    for (const progresso of progressosPublicados) {
      const current = progressosPorAula.get(progresso.aulaId) || [];
      current.push(normalizeLessonPercentual(progresso.percentualAssistido, progresso.concluido));
      progressosPorAula.set(progresso.aulaId, current);
    }

    const aulasStats = aulasPublicadasBase
      .map((aula) => {
        const percentuais = progressosPorAula.get(aula.id) || [];
        const mediaConclusao = percentuais.length
          ? Math.round(percentuais.reduce((sum, percentual) => sum + percentual, 0) / percentuais.length)
          : 0;

        return {
          id: aula.id,
          titulo: aula.titulo,
          totalAlunos: percentuais.length,
          mediaConclusao
        };
      })
      .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));

    res.json({
      totalAlunos,
      alunosAtivos,
      aulasPublicadas: aulasPublicadasBase.length,
      taxaConclusao: progressoMedioGeral,
      progressoMedioAulas,
      progressoMedioAvaliacoes,
      progressoMedioGeral,
      alertasAulasAtrasadas,
      alertasAvaliacoesAtrasadas,
      alunosAtencao,
      atividadeRecente,
      aulasStats
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar dashboard admin' });
  }
});

// GET /api/admin/alunos
router.get('/alunos', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const [alunos, aulasObrigatorias, progressosPublicados, avaliacoesPublicadas, entregasPublicadas] = await Promise.all([
      prisma.user.findMany({
        where: { papel: 'aluno' },
        select: { id: true, nome: true, email: true, foto: true, telefone: true, ativo: true, criadoEm: true, ultimoAcesso: true },
        orderBy: { criadoEm: 'desc' }
      }),
      prisma.aula.findMany({
        where: {
          publicado: true,
          modulo: { obrigatorio: true }
        },
        select: {
          id: true,
          titulo: true,
          dataPublicacao: true,
          criadoEm: true,
          modulo: { select: { titulo: true, ordem: true } }
        },
        orderBy: [{ modulo: { ordem: 'asc' } }, { criadoEm: 'asc' }]
      }),
      prisma.progressoAluno.findMany({
        where: { aula: { publicado: true } },
        select: {
          alunoId: true,
          aulaId: true,
          percentualAssistido: true,
          concluido: true
        }
      }),
      prisma.avaliacao.findMany({
        where: { publicado: true },
        select: {
          id: true,
          titulo: true,
          tipo: true,
          dataLimite: true,
          criadoEm: true,
          modulo: { select: { titulo: true } },
          aula: {
            select: {
              titulo: true,
              modulo: { select: { titulo: true } }
            }
          }
        }
      }),
      prisma.entregaAvaliacao.findMany({
        where: { avaliacao: { publicado: true } },
        select: {
          alunoId: true,
          avaliacaoId: true,
          status: true
        }
      })
    ]);

    const aulasObrigatoriasIds = new Set(aulasObrigatorias.map((aula) => aula.id));
    const progressosObrigatorios = progressosPublicados.filter((progresso) => aulasObrigatoriasIds.has(progresso.aulaId));
    const dashboards = buildStudentProgressDashboardIndex({
      studentIds: alunos.map((aluno) => aluno.id),
      aulasPublicadas: aulasObrigatorias,
      progressos: progressosObrigatorios,
      avaliacoesPublicadas,
      entregas: entregasPublicadas,
      now
    });

    const result = alunos.map((a) => {
      const painel = dashboards.get(a.id) ?? buildStudentProgressDashboard({
        aulasPublicadas: aulasObrigatorias,
        progressos: [],
        avaliacoesPublicadas,
        entregas: [],
        now
      });

      return {
        id: a.id,
        nome: a.nome,
        email: a.email,
        foto: a.foto,
        telefone: a.telefone,
        ativo: a.ativo,
        criadoEm: a.criadoEm,
        ultimoAcesso: a.ultimoAcesso,
        progressoAulas: painel.progressoAulas.percentual,
        progressoAvaliacoes: painel.progressoAvaliacoes.percentual,
        progressoGeral: painel.progressoGeral,
        aulasConcluidas: painel.progressoAulas.concluidas,
        totalAulasAcessadas: progressosObrigatorios.filter((progresso) => progresso.alunoId === a.id).length,
        aulasAtrasadas: painel.aulasAtrasadas.length,
        avaliacoesAtrasadas: painel.avaliacoesPendentesAtrasadas.length
      };
    });

    res.json(result);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar alunos' });
  }
});

// GET /api/admin/aluno/:id
router.get('/aluno/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alunoId = readString(req.params.id);
    if (!alunoId) {
      res.status(400).json({ error: 'Aluno invalido' });
      return;
    }

    const now = new Date();
    const [aluno, modulos, aulasObrigatorias, avaliacoesPublicadas] = await Promise.all([
      prisma.user.findUnique({
        where: { id: alunoId },
        include: {
          progressos: {
            include: { aula: { select: { titulo: true, duracaoSegundos: true, modulo: { select: { titulo: true } } } } }
          },
          resultadosQuiz: {
            include: { aula: { select: { titulo: true } } },
            orderBy: { feitoEm: 'desc' }
          },
          presencas: {
            include: { aula: { select: { titulo: true } } }
          },
          entregasAvaliacao: {
            include: {
              avaliacao: {
                select: {
                  id: true,
                  titulo: true,
                  tipo: true,
                  formato: true,
                  resultadoImediato: true,
                  questoesObjetivas: true,
                  notaMaxima: true,
                  modulo: { select: { titulo: true } },
                  aula: { select: { titulo: true } }
                }
              }
            },
            orderBy: { atualizadoEm: 'desc' }
          },
          loginHistorico: {
            orderBy: { dataHora: 'desc' },
            take: 20
          }
        }
      }),
      prisma.modulo.findMany({
        where: { ativo: true },
        include: {
          aulas: {
            where: { publicado: true },
            include: {
              presencas: {
                where: { alunoId },
                select: { status: true }
              }
            }
          }
        },
        orderBy: { ordem: 'asc' }
      }),
      prisma.aula.findMany({
        where: {
          publicado: true,
          modulo: { obrigatorio: true }
        },
        select: {
          id: true,
          titulo: true,
          dataPublicacao: true,
          criadoEm: true,
          modulo: { select: { titulo: true, ordem: true } }
        },
        orderBy: [{ modulo: { ordem: 'asc' } }, { criadoEm: 'asc' }]
      }),
      prisma.avaliacao.findMany({
        where: { publicado: true },
        select: {
          id: true,
          titulo: true,
          tipo: true,
          dataLimite: true,
          criadoEm: true,
          modulo: { select: { titulo: true } },
          aula: {
            select: {
              titulo: true,
              modulo: { select: { titulo: true } }
            }
          }
        },
        orderBy: [{ dataLimite: 'asc' }, { criadoEm: 'desc' }]
      })
    ]);

    if (!aluno) {
      res.status(404).json({ error: 'Aluno não encontrado' });
      return;
    }

    const progressosNormalizados = aluno.progressos.map((progresso) => ({
      ...progresso,
      percentualAssistido: normalizeLessonPercentual(progresso.percentualAssistido, progresso.concluido),
      concluido: normalizeLessonPercentual(progresso.percentualAssistido, progresso.concluido) >= 100
    }));

    const painelProgresso = buildStudentProgressDashboard({
      aulasPublicadas: aulasObrigatorias,
      progressos: progressosNormalizados,
      avaliacoesPublicadas,
      entregas: aluno.entregasAvaliacao,
      now
    });

    res.json({
      ...aluno,
      progressos: progressosNormalizados,
      painelProgresso,
      relatorioAcademico: {
        frequenciaPorModulo: buildModuleFrequencyReport(modulos),
        entregasResumo: buildDeliverySummary(aluno.entregasAvaliacao),
        boletimPorModulo: buildBulletinByModule(aluno.entregasAvaliacao)
      }
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar aluno' });
  }
});

const createAlunoSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(255).trim(),
  email: z.string().email('Email invalido').max(255),
  senha: z.string().min(6, 'Senha deve ter no minimo 6 caracteres').max(128).optional(),
  telefone: z.string().max(30).optional()
});

const updateAlunoSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(255).trim().optional(),
  email: z.string().email('Email invalido').max(255).optional(),
  senha: z.string().min(6, 'Senha deve ter no minimo 6 caracteres').max(128).optional(),
  telefone: z.string().max(30).nullable().optional()
}).refine(
  (payload) => (
    payload.nome !== undefined ||
    payload.email !== undefined ||
    payload.senha !== undefined ||
    payload.telefone !== undefined
  ),
  { message: 'Informe ao menos um campo para atualizar' }
);

// POST /api/admin/aluno - create student
router.post('/aluno', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = createAlunoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { nome, email, senha, telefone } = parsed.data;
    const emailNormalizado = email.trim().toLowerCase();
    const existente = await prisma.user.findUnique({ where: { email: emailNormalizado } });
    if (existente) {
      res.status(409).json({ error: 'Ja existe um usuario com esse email' });
      return;
    }

    const senhaGerada = senha ?? crypto.randomBytes(8).toString('hex');
    const senhaHash = await bcrypt.hash(senhaGerada, 10);

    const aluno = await prisma.user.create({
      data: {
        nome: nome.trim(),
        email: emailNormalizado,
        senhaHash,
        telefone: telefone?.trim() || null,
        papel: 'aluno'
      }
    });

    // Return temporary password only when auto-generated (admin must share it securely)
    const response: Record<string, unknown> = { ...aluno };
    if (!senha) response.senhaTemporaria = senhaGerada;
    res.json(response);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao criar aluno' });
  }
});

// PUT /api/admin/aluno/:id - update student profile (name/email/phone/password)
router.put('/aluno/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alunoId = readString(req.params.id);
    if (!alunoId) {
      res.status(400).json({ error: 'Aluno invalido' });
      return;
    }

    const parsed = updateAlunoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const aluno = await prisma.user.findUnique({
      where: { id: alunoId },
      select: { id: true, papel: true, email: true }
    });

    if (!aluno) {
      res.status(404).json({ error: 'Aluno nao encontrado' });
      return;
    }

    if (aluno.papel !== 'aluno') {
      res.status(400).json({ error: 'Somente usuarios do tipo aluno podem ser atualizados por esta rota.' });
      return;
    }

    const { nome, email, senha, telefone } = parsed.data;
    const updateData: {
      nome?: string;
      email?: string;
      telefone?: string | null;
      senhaHash?: string;
    } = {};

    if (nome !== undefined) {
      updateData.nome = nome.trim();
    }

    if (email !== undefined) {
      const emailNormalizado = email.trim().toLowerCase();
      if (emailNormalizado !== aluno.email) {
        const existente = await prisma.user.findUnique({ where: { email: emailNormalizado }, select: { id: true } });
        if (existente && existente.id !== aluno.id) {
          res.status(409).json({ error: 'Ja existe um usuario com esse email' });
          return;
        }
      }
      updateData.email = emailNormalizado;
    }

    if (telefone !== undefined) {
      const telefoneNormalizado = telefone?.trim() ?? '';
      updateData.telefone = telefoneNormalizado || null;
    }

    if (senha !== undefined) {
      updateData.senhaHash = await bcrypt.hash(senha, 10);
    }

    const atualizado = await prisma.user.update({
      where: { id: alunoId },
      data: updateData,
      select: {
        id: true,
        nome: true,
        email: true,
        foto: true,
        telefone: true,
        papel: true,
        ativo: true
      }
    });

    res.json(atualizado);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao atualizar aluno' });
  }
});

// PUT /api/admin/aluno/:id/toggle
router.put('/aluno/:id/toggle', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alunoId = readString(req.params.id);
    if (!alunoId) {
      res.status(400).json({ error: 'Aluno invalido' });
      return;
    }

    const aluno = await prisma.user.findUnique({ where: { id: alunoId } });
    if (!aluno) { res.status(404).json({ error: 'Não encontrado' }); return; }

    await prisma.user.update({
      where: { id: alunoId },
      data: { ativo: !aluno.ativo }
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro' });
  }
});

// DELETE /api/admin/aluno/:id
router.delete('/aluno/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alunoId = readString(req.params.id);
    if (!alunoId) {
      res.status(400).json({ error: 'Aluno inválido' });
      return;
    }

    const aluno = await prisma.user.findUnique({
      where: { id: alunoId },
      select: { id: true, papel: true, foto: true, nome: true }
    });

    if (!aluno) {
      res.status(404).json({ error: 'Aluno não encontrado' });
      return;
    }

    if (aluno.papel !== 'aluno') {
      res.status(400).json({ error: 'Somente usuários do tipo aluno podem ser excluídos por esta rota.' });
      return;
    }

    if (aluno.foto) {
      const oldPath = path.resolve(aluno.foto.replace(/^\//, ''));
      fs.unlink(oldPath, () => {});
    }

    await prisma.$transaction(async (tx) => {
      await tx.interacaoIA.deleteMany({ where: { alunoId } });
      await tx.loginHistorico.deleteMany({ where: { usuarioId: alunoId } });
      await tx.alertaSeguranca.deleteMany({ where: { usuarioId: alunoId } });
      await tx.notificacao.deleteMany({ where: { alunoId } });
      await tx.anotacaoAluno.deleteMany({ where: { alunoId } });
      await tx.presenca.deleteMany({ where: { alunoId } });
      await tx.entregaAvaliacao.deleteMany({ where: { alunoId } });
      await tx.resultadoQuiz.deleteMany({ where: { alunoId } });
      await tx.progressoAluno.deleteMany({ where: { alunoId } });
      await tx.registroMudancaConteudo.updateMany({
        where: { usuarioId: alunoId },
        data: { usuarioId: null }
      });
      await tx.user.delete({ where: { id: alunoId } });
    });

    res.json({ ok: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao excluir aluno' });
  }
});

// PUT /api/admin/aluno/:id/foto
router.put('/aluno/:id/foto', uploadAvatar.single('foto'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alunoId = readString(req.params.id);
    if (!alunoId) { res.status(400).json({ error: 'ID invalido' }); return; }
    if (!req.file) { res.status(400).json({ error: 'Nenhum arquivo enviado.' }); return; }

    const user = await prisma.user.findUnique({ where: { id: alunoId }, select: { foto: true } });
    if (!user) { res.status(404).json({ error: 'Aluno nao encontrado.' }); return; }

    if (user.foto) {
      const oldPath = path.resolve(user.foto.replace(/^\//, ''));
      fs.unlink(oldPath, () => {});
    }

    const fotoUrl = `/api/uploads/avatars/${req.file.filename}`;
    await prisma.user.update({ where: { id: alunoId }, data: { foto: fotoUrl } });
    res.json({ foto: fotoUrl });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao salvar foto.' });
  }
});

// GET /api/admin/aulas
router.get('/aulas', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const modulos = await prisma.modulo.findMany({
      include: {
        aulas: {
          include: {
            progressos: true,
            resultadosQuiz: true
          },
          orderBy: { criadoEm: 'asc' }
        }
      },
      orderBy: { ordem: 'asc' }
    });

    res.json(modulos);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar aulas' });
  }
});

// GET /api/admin/aula/:id
router.get('/aula/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const aulaId = readString(req.params.id);
    if (!aulaId) {
      res.status(400).json({ error: 'Aula invalida' });
      return;
    }

    const aula = await prisma.aula.findUnique({
      where: { id: aulaId },
      include: {
        modulo: true,
        quizzes: true,
        materiaisAula: { include: { material: true } },
        progressos: true,
        resultadosQuiz: true
      }
    });
    if (!aula) { res.status(404).json({ error: 'Aula não encontrada' }); return; }
    const videoTipo = getLessonVideoKind(aula.urlVideo);
    res.json({
      ...aula,
      videoTipo,
      youtubeUrl: videoTipo === 'youtube' ? aula.urlVideo : null
    });
  } catch {
    res.status(500).json({ error: 'Erro' });
  }
});

// POST /api/admin/aula - create lesson with video upload
router.post('/aula', uploadVideo.single('video'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const titulo = readString(req.body.titulo);
    const descricao = readString(req.body.descricao);
    const moduloId = readString(req.body.moduloId);
    const shouldPublish = readBoolean(req.body.publicado, true);
    const dataPublicacao = readString(req.body.dataPublicacao);
    const videoFile = req.file;
    const youtubeUrl = normalizeLessonVideoUrl(readString(req.body.youtubeUrl));

    if (!titulo || !moduloId) {
      res.status(400).json({ error: 'Titulo e modulo sao obrigatorios.' });
      return;
    }

    if (videoFile && youtubeUrl) {
      res.status(400).json({ error: 'Escolha upload de arquivo ou link do YouTube, nao os dois.' });
      return;
    }

    if (readString(req.body.youtubeUrl) && !youtubeUrl) {
      res.status(400).json({ error: 'O link do YouTube informado e invalido.' });
      return;
    }

    const modulo = await prisma.modulo.findUnique({
      where: { id: moduloId },
      select: { titulo: true }
    });

    // Auto-detect duration from video source
    let duracaoSegundos = 1800; // default 30min fallback
    if (videoFile) {
      const detected = await getFileDuration(path.join('uploads', 'videos', videoFile.filename));
      if (detected > 0) duracaoSegundos = detected;
    } else if (youtubeUrl) {
      const ytId = extractYouTubeVideoId(youtubeUrl);
      if (ytId) {
        const detected = await getYoutubeDuration(ytId);
        if (detected > 0) duracaoSegundos = detected;
      }
    }

    const aula = await prisma.aula.create({
      data: {
        titulo,
        descricao,
        moduloId,
        urlVideo: videoFile ? `/uploads/videos/${videoFile.filename}` : youtubeUrl,
        publicado: shouldPublish,
        dataPublicacao: dataPublicacao ? new Date(dataPublicacao) : (shouldPublish ? new Date() : null),
        duracaoSegundos,
        statusIA: 'processando'
      }
    });

    await logContentChange(prisma, req, {
      entity: 'aula',
      action: 'criado',
      entityId: aula.id,
      title: aula.titulo,
      details: {
        moduloId,
        moduloTitulo: modulo?.titulo || null,
        publicado: shouldPublish,
        videoTipo: getLessonVideoKind(aula.urlVideo),
        origem: videoFile ? 'upload' : youtubeUrl ? 'youtube' : 'sem-video',
      },
    });

    // Fire AI pipeline asynchronously
    processAIPipeline(aula.id, titulo, descricao || '', { modulo: modulo?.titulo }).then(async (aiResult) => {
      await prisma.aula.update({
        where: { id: aula.id },
        data: {
          transcricao: aiResult.transcricao,
          resumo: aiResult.resumo,
          pontosChave: aiResult.pontosChave,
          versiculos: aiResult.versiculos,
          glossario: aiResult.glossario,
          statusIA: 'concluido'
        }
      });

      // Create quiz
      await prisma.quiz.create({
        data: {
          aulaId: aula.id,
          questoes: aiResult.quiz
        }
      });

      logger.info(`AI pipeline completed for lesson: ${titulo}`);
    }).catch(async (err) => {
      logger.error('AI pipeline error:', err);
      await prisma.aula.update({
        where: { id: aula.id },
        data: { statusIA: 'erro' }
      });
    });

    res.json(aula);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao criar aula' });
  }
});

// PUT /api/admin/aula/:id
router.put('/aula/:id', uploadVideo.single('video'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const aulaId = readString(req.params.id);
    if (!aulaId) {
      res.status(400).json({ error: 'Aula invalida' });
      return;
    }

    const titulo = readString(req.body.titulo);
    const descricao = readString(req.body.descricao);
    const moduloId = readString(req.body.moduloId);
    const shouldPublish = readBoolean(req.body.publicado);
    const dataPublicacao = readString(req.body.dataPublicacao);
    const videoFile = req.file;
    const youtubeUrlInput = readString(req.body.youtubeUrl);
    const youtubeUrl = youtubeUrlInput ? normalizeLessonVideoUrl(youtubeUrlInput) : null;

    if (!titulo || !moduloId) {
      res.status(400).json({ error: 'Titulo e modulo sao obrigatorios.' });
      return;
    }

    if (videoFile && youtubeUrl) {
      res.status(400).json({ error: 'Escolha upload de arquivo ou link do YouTube, nao os dois.' });
      return;
    }

    if (youtubeUrlInput && !youtubeUrl) {
      res.status(400).json({ error: 'O link do YouTube informado e invalido.' });
      return;
    }

    const aulaAtual = await prisma.aula.findUnique({
      where: { id: aulaId },
      select: {
        titulo: true,
        moduloId: true,
        publicado: true,
        urlVideo: true,
        duracaoSegundos: true,
      }
    });

    if (!aulaAtual) {
      res.status(404).json({ error: 'Aula nao encontrada' });
      return;
    }

    const clearVideo = readString(req.body.clearVideo) === 'true';
    const nextVideoUrl = videoFile
      ? `/uploads/videos/${videoFile.filename}`
      : youtubeUrlInput
        ? youtubeUrl
        : clearVideo
          ? null
          : aulaAtual.urlVideo;

    // Auto-detect duration only when video source changes
    let duracaoSegundos = aulaAtual.duracaoSegundos;
    if (videoFile) {
      const detected = await getFileDuration(path.join('uploads', 'videos', videoFile.filename));
      if (detected > 0) duracaoSegundos = detected;
    } else if (youtubeUrlInput && youtubeUrl) {
      const ytId = extractYouTubeVideoId(youtubeUrl);
      if (ytId) {
        const detected = await getYoutubeDuration(ytId);
        if (detected > 0) duracaoSegundos = detected;
      }
    }

    const aula = await prisma.aula.update({
      where: { id: aulaId },
      data: {
        titulo,
        descricao,
        moduloId,
        publicado: shouldPublish,
        dataPublicacao: dataPublicacao ? new Date(dataPublicacao) : undefined,
        urlVideo: nextVideoUrl,
        duracaoSegundos
      }
    });

    await logContentChange(prisma, req, {
      entity: 'aula',
      action: 'atualizado',
      entityId: aula.id,
      title: aula.titulo,
      details: {
        antes: {
          titulo: aulaAtual.titulo,
          moduloId: aulaAtual.moduloId,
          publicado: aulaAtual.publicado,
          videoTipo: getLessonVideoKind(aulaAtual.urlVideo),
        },
        depois: {
          titulo: aula.titulo,
          moduloId: aula.moduloId,
          publicado: aula.publicado,
          videoTipo: getLessonVideoKind(aula.urlVideo),
        },
      },
    });

    res.json(aula);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar aula' });
  }
});

// DELETE /api/admin/aula/:id
router.delete('/aula/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const aulaId = readString(req.params.id);
    if (!aulaId) {
      res.status(400).json({ error: 'Aula invalida' });
      return;
    }

    const aulaAtual = await prisma.aula.findUnique({
      where: { id: aulaId },
      select: {
        id: true,
        titulo: true,
        moduloId: true,
        modulo: { select: { titulo: true } },
      },
    });

    if (!aulaAtual) {
      res.status(404).json({ error: 'Aula nao encontrada' });
      return;
    }

    await prisma.aula.delete({ where: { id: aulaId } });

    await logContentChange(prisma, req, {
      entity: 'aula',
      action: 'excluido',
      entityId: aulaAtual.id,
      title: aulaAtual.titulo,
      details: {
        moduloId: aulaAtual.moduloId,
        moduloTitulo: aulaAtual.modulo?.titulo || null,
      },
    });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir aula' });
  }
});

// POST /api/admin/modulo
router.post('/modulo', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { titulo, descricao, capaUrl, ordem } = req.body;
    const obrigatorio = readBoolean(req.body.obrigatorio, true);
    const modulo = await prisma.modulo.create({
      data: {
        titulo,
        descricao,
        capaUrl,
        ordem: parseInt(ordem || '0'),
        obrigatorio
      }
    });

    await logContentChange(prisma, req, {
      entity: 'modulo',
      action: 'criado',
      entityId: modulo.id,
      title: modulo.titulo,
      details: {
        descricao: modulo.descricao,
        capaUrl: modulo.capaUrl,
        ordem: modulo.ordem,
        obrigatorio: modulo.obrigatorio
      },
    });

    res.json(modulo);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao criar modulo' });
  }
});

// PUT /api/admin/modulo/:id
router.put('/modulo/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const moduloId = readString(req.params.id);
    const { titulo, descricao, capaUrl, ordem } = req.body;
    const obrigatorio = typeof req.body.obrigatorio === 'undefined'
      ? undefined
      : readBoolean(req.body.obrigatorio, true);
    if (!moduloId) {
      res.status(400).json({ error: 'Modulo invalido' });
      return;
    }

    const moduloAtual = await prisma.modulo.findUnique({
      where: { id: moduloId },
      select: {
        titulo: true,
        descricao: true,
        capaUrl: true,
        ordem: true,
        obrigatorio: true
      },
    });

    if (!moduloAtual) {
      res.status(404).json({ error: 'Modulo nao encontrado' });
      return;
    }

    const modulo = await prisma.modulo.update({
      where: { id: moduloId },
      data: {
        titulo,
        descricao,
        capaUrl,
        ordem: ordem ? parseInt(ordem) : undefined,
        obrigatorio
      }
    });

    await logContentChange(prisma, req, {
      entity: 'modulo',
      action: 'atualizado',
      entityId: modulo.id,
      title: modulo.titulo,
      details: {
        antes: moduloAtual,
        depois: {
          titulo: modulo.titulo,
          descricao: modulo.descricao,
          capaUrl: modulo.capaUrl,
          ordem: modulo.ordem,
          obrigatorio: modulo.obrigatorio
        },
      },
    });

    res.json(modulo);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao atualizar modulo' });
  }
});

// PUT /api/admin/modulo/:id/capa â€” upload cover image
router.put('/modulo/:id/capa', uploadThumbnail.single('capa'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const moduloId = readString(req.params.id);
    if (!moduloId) { res.status(400).json({ error: 'ID invalido' }); return; }
    if (!req.file) { res.status(400).json({ error: 'Nenhum arquivo enviado.' }); return; }

    const modulo = await prisma.modulo.findUnique({ where: { id: moduloId }, select: { capaUrl: true } });
    if (!modulo) { res.status(404).json({ error: 'Modulo nao encontrado.' }); return; }

    if (modulo.capaUrl) {
      const oldPath = path.resolve(modulo.capaUrl.replace(/^\/(api\/)?/, ''));
      fs.unlink(oldPath, () => {});
    }

    const capaUrl = `/api/uploads/thumbnails/${req.file.filename}`;
    await prisma.modulo.update({ where: { id: moduloId }, data: { capaUrl } });
    res.json({ capaUrl });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao salvar capa.' });
  }
});

// DELETE /api/admin/modulo/:id
router.delete('/modulo/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const moduloId = readString(req.params.id);
    if (!moduloId) {
      res.status(400).json({ error: 'Modulo invalido' });
      return;
    }

    const moduloAtual = await prisma.modulo.findUnique({
      where: { id: moduloId },
      select: {
        id: true,
        titulo: true,
        descricao: true,
        _count: { select: { aulas: true } },
      },
    });

    if (!moduloAtual) {
      res.status(404).json({ error: 'Modulo nao encontrado' });
      return;
    }

    await prisma.modulo.delete({ where: { id: moduloId } });

    await logContentChange(prisma, req, {
      entity: 'modulo',
      action: 'excluido',
      entityId: moduloAtual.id,
      title: moduloAtual.titulo,
      details: {
        descricao: moduloAtual.descricao,
        totalAulasRemovidas: moduloAtual._count.aulas,
      },
    });

    res.json({ ok: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao excluir modulo' });
  }
});

// GET /api/admin/modulos
router.get('/modulos', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const modulos = await prisma.modulo.findMany({ 
      include: { _count: { select: { aulas: true } } },
      orderBy: { ordem: 'asc' } 
    });
    res.json(modulos);
  } catch {
    res.status(500).json({ error: 'Erro' });
  }
});

// GET /api/admin/conteudo-historico
router.get('/conteudo-historico', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawLimit = Number(readString(req.query.limit as string | string[] | undefined) || '15');
    const take = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 15;

    const historico = await prisma.registroMudancaConteudo.findMany({
      orderBy: { criadoEm: 'desc' },
      take,
    });

    res.json(historico.map((item) => ({
      ...item,
      detalhes: parseStoredDetails(item.detalhes),
    })));
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar historico de conteudo' });
  }
});

// POST /api/admin/material
router.post('/material', uploadMaterial.single('arquivo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { titulo, descricao, categoria, permiteDownload, aulasRelacionadas, moduloId } = req.body;
    const moduloIdValue = readString(moduloId as string | string[] | undefined);
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Arquivo obrigatório' });
      return;
    }

    const aulaIdsDiretos = parseStringArray(aulasRelacionadas);
    const aulasSelecionadas = aulaIdsDiretos.length
      ? await prisma.aula.findMany({
        where: { id: { in: aulaIdsDiretos } },
        select: { id: true, moduloId: true }
      })
      : [];

    if (aulaIdsDiretos.length !== aulasSelecionadas.length) {
      res.status(400).json({ error: 'Uma ou mais aulas selecionadas não foram encontradas.' });
      return;
    }

    let moduloFinalId: string | null = null;
    if (moduloIdValue) {
      const modulo = await prisma.modulo.findUnique({
        where: { id: moduloIdValue },
        select: { id: true }
      });
      if (!modulo) {
        res.status(400).json({ error: 'Módulo inválido.' });
        return;
      }
      moduloFinalId = modulo.id;
    }

    if (aulasSelecionadas.length > 0) {
      const moduloDasAulas = new Set(aulasSelecionadas.map((aula) => aula.moduloId));
      if (moduloDasAulas.size > 1) {
        res.status(400).json({ error: 'Selecione aulas de um único módulo por material.' });
        return;
      }

      const moduloDaAula = aulasSelecionadas[0]?.moduloId ?? null;
      if (moduloFinalId && moduloDaAula && moduloFinalId !== moduloDaAula) {
        res.status(400).json({ error: 'A aula selecionada não pertence ao módulo informado.' });
        return;
      }
      moduloFinalId = moduloFinalId || moduloDaAula;
    }

    const material = await prisma.material.create({
      data: {
        titulo,
        descricao,
        urlArquivo: `/uploads/materials/${file.filename}`,
        tipo: path.extname(file.originalname).slice(1),
        categoria: categoria || 'geral',
        permiteDownload: permiteDownload === 'true',
        moduloId: moduloFinalId
      }
    });

    const aulaIds = Array.from(new Set(aulasSelecionadas.map((aula) => aula.id)));

    if (aulaIds.length > 0) {
      await prisma.materialAula.createMany({
        data: aulaIds.map((aulaId) => ({ materialId: material.id, aulaId })),
        skipDuplicates: true
      });
    }

    res.json(material);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao fazer upload de material' });
  }
});

// DELETE /api/admin/material/:id
router.delete('/material/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const material = await prisma.material.findUnique({ where: { id: String(req.params.id) } });
    if (!material) { res.status(404).json({ error: 'Material nao encontrado' }); return; }
    if (material.urlArquivo) {
      const filePath = path.resolve(material.urlArquivo.replace(/^\//, ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await prisma.materialAula.deleteMany({ where: { materialId: String(req.params.id) } });
    await prisma.material.delete({ where: { id: String(req.params.id) } });
    res.json({ ok: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao excluir material' });
  }
});

// PUT /api/admin/material/:id
router.put('/material/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { titulo, descricao, categoria, permiteDownload, aulaId, moduloId } = req.body;
    const moduloIdValue = readString(moduloId as string | string[] | undefined);
    const aulaIdsDiretos = parseStringArray(aulaId);
    const aulasSelecionadas = aulaIdsDiretos.length
      ? await prisma.aula.findMany({
        where: { id: { in: aulaIdsDiretos } },
        select: { id: true, moduloId: true }
      })
      : [];

    if (aulaIdsDiretos.length !== aulasSelecionadas.length) {
      res.status(400).json({ error: 'Uma ou mais aulas selecionadas não foram encontradas.' });
      return;
    }

    let moduloFinalId: string | null = null;
    if (moduloIdValue) {
      const modulo = await prisma.modulo.findUnique({
        where: { id: moduloIdValue },
        select: { id: true }
      });
      if (!modulo) {
        res.status(400).json({ error: 'Módulo inválido.' });
        return;
      }
      moduloFinalId = modulo.id;
    }

    if (aulasSelecionadas.length > 0) {
      const moduloDasAulas = new Set(aulasSelecionadas.map((aula) => aula.moduloId));
      if (moduloDasAulas.size > 1) {
        res.status(400).json({ error: 'Selecione aulas de um único módulo por material.' });
        return;
      }
      const moduloDaAula = aulasSelecionadas[0]?.moduloId ?? null;
      if (moduloFinalId && moduloDaAula && moduloFinalId !== moduloDaAula) {
        res.status(400).json({ error: 'A aula selecionada não pertence ao módulo informado.' });
        return;
      }
      moduloFinalId = moduloFinalId || moduloDaAula;
    }

    await prisma.material.update({
      where: { id: String(req.params.id) },
      data: {
        titulo,
        descricao,
        categoria,
        permiteDownload: permiteDownload === true || permiteDownload === 'true',
        moduloId: moduloFinalId
      }
    });

    // Update linked lessons: remove all then re-add explicit selections
    await prisma.materialAula.deleteMany({ where: { materialId: String(req.params.id) } });
    const aulaIds = Array.from(new Set(aulasSelecionadas.map((aula) => aula.id)));

    if (aulaIds.length > 0) {
      await prisma.materialAula.createMany({
        data: aulaIds.map((currentAulaId) => ({ materialId: String(req.params.id), aulaId: currentAulaId })),
        skipDuplicates: true
      });
    }
    res.json({ ok: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao editar material' });
  }
});

// GET /api/admin/materiais
router.get('/materiais', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);
    const skip = (page - 1) * pageSize;
    const moduloId = readString(req.query.moduloId as string | string[] | undefined);
    const where = moduloId
      ? {
        OR: [
          { moduloId },
          {
            materiaisAula: {
              some: {
                aula: { moduloId }
              }
            }
          }
        ]
      }
      : undefined;

    const [materiais, total] = await Promise.all([
      prisma.material.findMany({
        where,
        include: {
          modulo: {
            select: {
              id: true,
              titulo: true
            }
          },
          materiaisAula: {
            include: {
              aula: {
                select: {
                  id: true,
                  titulo: true,
                  modulo: { select: { id: true, titulo: true } }
                }
              }
            }
          }
        },
        orderBy: { criadoEm: 'desc' },
        take: pageSize,
        skip
      }),
      prisma.material.count({ where })
    ]);
    res.json({ data: materiais, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch {
    res.status(500).json({ error: 'Erro' });
  }
});

// GET /api/admin/avaliacoes
router.get('/avaliacoes', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usingPagination = typeof req.query.page !== 'undefined' || typeof req.query.pageSize !== 'undefined';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);
    const skip = (page - 1) * pageSize;
    const moduloId = readString(req.query.moduloId as string | string[] | undefined);
    const where = moduloId
      ? {
        OR: [
          { moduloId },
          { aula: { moduloId } }
        ]
      }
      : undefined;

    const [avaliacoes, total] = await Promise.all([
      prisma.avaliacao.findMany({
        where,
        include: {
          modulo: { select: { id: true, titulo: true } },
          aula: {
            select: {
              id: true,
              titulo: true,
              modulo: { select: { id: true, titulo: true } }
            }
          },
          entregas: { select: { id: true, status: true, nota: true } }
        },
        orderBy: [{ dataLimite: 'asc' }, { criadoEm: 'desc' }],
        take: pageSize,
        skip
      }),
      prisma.avaliacao.count({ where })
    ]);

    const mapped = avaliacoes.map((avaliacao) => ({
      ...avaliacao,
      quantidadeQuestoes: parseObjectiveQuestions(avaliacao.questoesObjetivas).length,
      resumoEntregas: buildDeliverySummary(avaliacao.entregas)
    }));

    if (!usingPagination) {
      res.json(mapped);
      return;
    }

    res.json({
      data: mapped,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar avaliacoes' });
  }
});

// POST /api/admin/avaliacao
router.post('/avaliacao', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const titulo = readString(req.body.titulo);
    const descricao = readString(req.body.descricao);
    const tipo = readString(req.body.tipo) || 'trabalho';
    const formato = readString(req.body.formato) === 'objetiva' ? 'objetiva' : 'discursiva';
    const moduloId = readString(req.body.moduloId) || null;
    const aulaId = readString(req.body.aulaId) || null;
    const dataLimite = readString(req.body.dataLimite);
    const notaMaxima = Number(readString(req.body.notaMaxima) || '10');
    const publicado = readBoolean(req.body.publicado, true);
    const permiteArquivo = readBoolean(req.body.permiteArquivo, true);
    const permiteTexto = readBoolean(req.body.permiteTexto, false);
    const resultadoImediato = readBoolean(req.body.resultadoImediato, true);
    const tempoLimiteMinutos = Number(readString(req.body.tempoLimiteMinutos));
    const questoesObjetivas = parseObjectiveQuestions(req.body.questoesObjetivas);

    if (!titulo) {
      res.status(400).json({ error: 'Titulo obrigatorio.' });
      return;
    }

    if (formato === 'objetiva' && !questoesObjetivas.length) {
      res.status(400).json({ error: 'Cadastre pelo menos uma questao objetiva valida.' });
      return;
    }

    if (formato === 'discursiva' && !permiteArquivo && !permiteTexto) {
      res.status(400).json({ error: 'Ative arquivo, texto ou ambos para a entrega.' });
      return;
    }

    const aulaSelecionada = aulaId
      ? await prisma.aula.findUnique({
        where: { id: aulaId },
        select: { id: true, moduloId: true }
      })
      : null;

    if (aulaId && !aulaSelecionada) {
      res.status(400).json({ error: 'A aula selecionada não foi encontrada.' });
      return;
    }

    if (moduloId && aulaSelecionada && aulaSelecionada.moduloId !== moduloId) {
      res.status(400).json({ error: 'A aula selecionada não pertence ao módulo informado.' });
      return;
    }

    const moduloFinalId = moduloId || aulaSelecionada?.moduloId || null;

    const avaliacao = await prisma.avaliacao.create({
      data: {
        titulo,
        descricao,
        tipo,
        formato,
        moduloId: moduloFinalId,
        aulaId,
        dataLimite: dataLimite ? new Date(dataLimite) : null,
        notaMaxima: Number.isFinite(notaMaxima) && notaMaxima > 0 ? notaMaxima : 10,
        publicado,
        permiteArquivo: formato === 'objetiva' ? false : permiteArquivo,
        permiteTexto: formato === 'objetiva' ? false : permiteTexto,
        questoesObjetivas: formato === 'objetiva' ? serializeObjectiveQuestions(questoesObjetivas) : null,
        resultadoImediato: formato === 'objetiva' ? resultadoImediato : true,
        tempoLimiteMinutos: formato === 'objetiva' && Number.isFinite(tempoLimiteMinutos) && tempoLimiteMinutos > 0
          ? Math.round(tempoLimiteMinutos)
          : null
      }
    });

    res.json(avaliacao);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao criar avaliacao' });
  }
});

// PUT /api/admin/avaliacao/:id
router.put('/avaliacao/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const avaliacaoId = readString(req.params.id);
    if (!avaliacaoId) {
      res.status(400).json({ error: 'Avaliacao invalida.' });
      return;
    }

    const titulo = readString(req.body.titulo);
    const descricao = readString(req.body.descricao);
    const tipo = readString(req.body.tipo) || 'trabalho';
    const formato = readString(req.body.formato) === 'objetiva' ? 'objetiva' : 'discursiva';
    const moduloId = readString(req.body.moduloId) || null;
    const aulaId = readString(req.body.aulaId) || null;
    const dataLimite = readString(req.body.dataLimite);
    const notaMaxima = Number(readString(req.body.notaMaxima) || '10');
    const publicado = readBoolean(req.body.publicado, true);
    const permiteArquivo = readBoolean(req.body.permiteArquivo, true);
    const permiteTexto = readBoolean(req.body.permiteTexto, false);
    const resultadoImediato = readBoolean(req.body.resultadoImediato, true);
    const tempoLimiteMinutos = Number(readString(req.body.tempoLimiteMinutos));
    const questoesObjetivas = parseObjectiveQuestions(req.body.questoesObjetivas);

    if (!titulo) {
      res.status(400).json({ error: 'Titulo obrigatorio.' });
      return;
    }

    if (formato === 'objetiva' && !questoesObjetivas.length) {
      res.status(400).json({ error: 'Cadastre pelo menos uma questao objetiva valida.' });
      return;
    }

    if (formato === 'discursiva' && !permiteArquivo && !permiteTexto) {
      res.status(400).json({ error: 'Ative arquivo, texto ou ambos para a entrega.' });
      return;
    }

    const aulaSelecionada = aulaId
      ? await prisma.aula.findUnique({
        where: { id: aulaId },
        select: { id: true, moduloId: true }
      })
      : null;

    if (aulaId && !aulaSelecionada) {
      res.status(400).json({ error: 'A aula selecionada não foi encontrada.' });
      return;
    }

    if (moduloId && aulaSelecionada && aulaSelecionada.moduloId !== moduloId) {
      res.status(400).json({ error: 'A aula selecionada não pertence ao módulo informado.' });
      return;
    }

    const moduloFinalId = moduloId || aulaSelecionada?.moduloId || null;

    const avaliacao = await prisma.avaliacao.update({
      where: { id: avaliacaoId },
      data: {
        titulo,
        descricao,
        tipo,
        formato,
        moduloId: moduloFinalId,
        aulaId,
        dataLimite: dataLimite ? new Date(dataLimite) : null,
        notaMaxima: Number.isFinite(notaMaxima) && notaMaxima > 0 ? notaMaxima : 10,
        publicado,
        permiteArquivo: formato === 'objetiva' ? false : permiteArquivo,
        permiteTexto: formato === 'objetiva' ? false : permiteTexto,
        questoesObjetivas: formato === 'objetiva' ? serializeObjectiveQuestions(questoesObjetivas) : null,
        resultadoImediato: formato === 'objetiva' ? resultadoImediato : true,
        tempoLimiteMinutos: formato === 'objetiva' && Number.isFinite(tempoLimiteMinutos) && tempoLimiteMinutos > 0
          ? Math.round(tempoLimiteMinutos)
          : null
      }
    });

    res.json(avaliacao);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao atualizar avaliacao' });
  }
});

// DELETE /api/admin/avaliacao/:id
router.delete('/avaliacao/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const avaliacaoId = readString(req.params.id);
    if (!avaliacaoId) {
      res.status(400).json({ error: 'Avaliacao invalida.' });
      return;
    }

    const entregaArquivos = await prisma.entregaAvaliacao.findMany({
      where: { avaliacaoId },
      select: { arquivoUrl: true }
    });

    await prisma.avaliacao.delete({
      where: { id: avaliacaoId }
    });

    for (const entrega of entregaArquivos) {
      if (!entrega.arquivoUrl) {
        continue;
      }

      const filePath = path.resolve('uploads/submissions', path.basename(entrega.arquivoUrl));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({ ok: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao excluir avaliacao' });
  }
});

// GET /api/admin/avaliacao/:id
router.get('/avaliacao/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const avaliacaoId = readString(req.params.id);
    if (!avaliacaoId) {
      res.status(400).json({ error: 'Avaliacao invalida.' });
      return;
    }

    const avaliacao = await prisma.avaliacao.findUnique({
      where: { id: avaliacaoId },
      include: {
        modulo: { select: { id: true, titulo: true } },
        aula: {
          select: {
            id: true,
            titulo: true,
            modulo: { select: { id: true, titulo: true } }
          }
        },
        entregas: {
          include: {
            aluno: {
              select: {
                id: true,
                nome: true,
                email: true
              }
            }
          },
          orderBy: [
            { status: 'asc' },
            { enviadoEm: 'desc' }
          ]
        }
      }
    });

    if (!avaliacao) {
      res.status(404).json({ error: 'Avaliacao nao encontrada.' });
      return;
    }

    const questoes = parseObjectiveQuestions(avaliacao.questoesObjetivas);
    res.json({
      ...avaliacao,
      questoesObjetivas: questoes,
      quantidadeQuestoes: questoes.length,
      resumoEntregas: buildDeliverySummary(avaliacao.entregas)
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar avaliacao' });
  }
});

// PUT /api/admin/entrega-avaliacao/:id/correcao
router.put('/entrega-avaliacao/:id/correcao', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entregaId = readString(req.params.id);
    const comentarioCorrecao = readString(req.body.comentarioCorrecao);
    const status = (readString(req.body.status) || 'corrigido') as StatusEntrega;
    const nota = Number(readString(req.body.nota));

    if (!entregaId) {
      res.status(400).json({ error: 'Entrega invalida.' });
      return;
    }

    if (!Number.isFinite(nota)) {
      res.status(400).json({ error: 'Informe uma nota valida.' });
      return;
    }

    const entrega = await prisma.entregaAvaliacao.update({
      where: { id: entregaId },
      data: {
        nota,
        comentarioCorrecao,
        status,
        corrigidoEm: new Date()
      },
      include: {
        aluno: {
          select: {
            id: true,
            nome: true,
            email: true
          }
        },
        avaliacao: {
          select: {
            id: true,
            titulo: true,
            notaMaxima: true
          }
        }
      }
    });

    const entregaWithRels = entrega as typeof entrega & { avaliacao: { titulo: string }; aluno: { id: string } };
    await logContentChange(prisma, req, {
      entity: 'entrega_avaliacao',
      entityId: entregaId,
      title: entregaWithRels.avaliacao.titulo,
      action: 'atualizado',
      details: { alunoId: entregaWithRels.aluno.id, nota, status },
    });

    res.json(entrega);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao salvar correcao' });
  }
});

// GET /api/admin/entrega-avaliacao/:id/arquivo
router.get('/entrega-avaliacao/:id/arquivo', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entregaId = readString(req.params.id);
    if (!entregaId) {
      res.status(400).json({ error: 'Entrega invalida.' });
      return;
    }

    const entrega = await prisma.entregaAvaliacao.findUnique({
      where: { id: entregaId },
      select: { arquivoUrl: true }
    });

    if (!entrega?.arquivoUrl) {
      res.status(404).json({ error: 'Arquivo da entrega nao encontrado.' });
      return;
    }

    sendStoredUpload(res, entrega.arquivoUrl, 'uploads/submissions');
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao baixar arquivo da entrega' });
  }
});

// GET /api/admin/chamada
router.get('/chamada', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const moduloId = readString(req.query.moduloId as string | string[] | undefined);
    const aulaId = readString(req.query.aulaId as string | string[] | undefined);

    const where = aulaId
      ? { aulaId }
      : moduloId
        ? { aula: { moduloId } }
        : undefined;

    const presencas = await prisma.presenca.findMany({
      where,
      include: {
        aluno: {
          select: {
            id: true,
            nome: true,
            email: true,
            foto: true
          }
        },
        aula: {
          select: {
            id: true,
            titulo: true,
            moduloId: true
          }
        }
      },
      orderBy: [
        { aula: { criadoEm: 'asc' } },
        { aluno: { nome: 'asc' } }
      ]
    });

    res.json(presencas);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar chamada' });
  }
});

// POST /api/admin/chamada
router.post('/chamada', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { aulaId, presencas } = req.body; // Array of { alunoId, status, metodo }
    if (!aulaId || !Array.isArray(presencas)) {
      res.status(400).json({ error: 'Dados invalidos' });
      return;
    }

    // Fetch lesson duration once (same aulaId for all entries)
    const aulaData = await prisma.aula.findUnique({
      where: { id: aulaId },
      select: { duracaoSegundos: true }
    });

    for (const item of presencas) {
      await prisma.presenca.upsert({
        where: { alunoId_aulaId: { alunoId: item.alunoId, aulaId: aulaId } },
        update: {
          status: item.status,
          metodo: item.metodo,
          percentual: item.status === 'presente' ? 100 : item.status === 'parcial' ? 50 : 0,
          registradoEm: new Date()
        },
        create: {
          alunoId: item.alunoId,
          aulaId: aulaId,
          status: item.status,
          metodo: item.metodo,
          percentual: item.status === 'presente' ? 100 : 0
        }
      });

      // When marked as present → auto-complete the lesson in ProgressoAluno
      if (item.status === 'presente') {
        await prisma.progressoAluno.upsert({
          where: { alunoId_aulaId: { alunoId: item.alunoId, aulaId } },
          update: {
            percentualAssistido: 100,
            concluido: true,
            dataConclusao: new Date(),
            posicaoAtualSegundos: aulaData?.duracaoSegundos || 0
          },
          create: {
            alunoId: item.alunoId,
            aulaId,
            percentualAssistido: 100,
            posicaoAtualSegundos: aulaData?.duracaoSegundos || 0,
            tempoTotalSegundos: 0,
            concluido: true,
            dataConclusao: new Date(),
            sessoes: 0
          }
        });
      }
    }

    logger.info('chamada registrada', {
      aulaId,
      totalPresencas: presencas.length,
      adminId: req.user?.userId,
    });

    res.json({ ok: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao salvar chamada' });
  }
});

// POST /api/admin/notificacao
router.post('/notificacao', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { titulo, mensagem, alunoId } = req.body;
    if (!titulo || !mensagem) {
      res.status(400).json({ error: 'Titulo e mensagem obrigatorios' });
      return;
    }

    if (alunoId) {
      // Individual
      await prisma.notificacao.create({
        data: { alunoId, titulo, mensagem }
      });
    } else {
      // All students
      const alunos = await prisma.user.findMany({ where: { papel: 'aluno' }, select: { id: true } });
      const data = alunos.map((a: { id: string }) => ({ alunoId: a.id, titulo, mensagem }));
      await prisma.notificacao.createMany({ data });
    }

    res.json({ ok: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao enviar notificacao' });
  }
});

// GET /api/admin/relatorios
router.get('/relatorios', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    // Engagement report
    const [aulas, logins, alunos, avaliacoes, aulasObrigatorias] = await Promise.all([
      prisma.aula.findMany({
        where: { publicado: true },
        include: {
          progressos: {
            select: {
              percentualAssistido: true,
              concluido: true
            }
          },
          resultadosQuiz: true
        },
        orderBy: { criadoEm: 'asc' }
      }),
      prisma.loginHistorico.findMany({
        orderBy: { dataHora: 'desc' },
        take: 100,
        include: { usuario: { select: { nome: true, email: true } } }
      }),
      prisma.user.findMany({
        where: { papel: 'aluno' },
        include: {
          entregasAvaliacao: {
            select: {
              alunoId: true,
              avaliacaoId: true,
              status: true,
              nota: true
            }
          },
          progressos: {
            select: {
              alunoId: true,
              aulaId: true,
              percentualAssistido: true,
              concluido: true
            }
          },
          presencas: {
            select: {
              status: true
            }
          }
        },
        orderBy: { nome: 'asc' }
      }),
      prisma.avaliacao.findMany({
        where: { publicado: true },
        include: {
          modulo: { select: { titulo: true } },
          aula: { select: { titulo: true, modulo: { select: { titulo: true } } } },
          entregas: {
            select: {
              status: true,
              nota: true,
              percentualObjetivo: true
            }
          }
        },
        orderBy: [
          { dataLimite: 'asc' },
          { criadoEm: 'desc' }
        ]
      }),
      prisma.aula.findMany({
        where: {
          publicado: true,
          modulo: { obrigatorio: true }
        },
        select: {
          id: true,
          titulo: true,
          dataPublicacao: true,
          criadoEm: true,
          modulo: { select: { titulo: true, ordem: true } }
        },
        orderBy: [{ modulo: { ordem: 'asc' } }, { criadoEm: 'asc' }]
      })
    ]);

    const engajamento = aulas.map((a: {
      id: string;
      titulo: string;
      progressos: Array<{ percentualAssistido: number; concluido: boolean }>;
      resultadosQuiz: Array<{ pontuacao: number; totalQuestoes: number }>;
    }) => ({
      id: a.id,
      titulo: a.titulo,
      totalVisualizacoes: a.progressos.length,
      mediaConclusao: a.progressos.length > 0
        ? Math.round(
            a.progressos.reduce(
              (sum: number, progresso: { percentualAssistido: number; concluido: boolean }) => (
                sum + normalizeLessonPercentual(progresso.percentualAssistido, progresso.concluido)
              ),
              0
            ) / a.progressos.length
          )
        : 0,
      mediaQuiz: a.resultadosQuiz.length > 0
        ? Math.round(a.resultadosQuiz.reduce((s: number, r: { pontuacao: number; totalQuestoes: number }) => s + (r.pontuacao / r.totalQuestoes * 100), 0) / a.resultadosQuiz.length)
        : 0,
      totalQuizzes: a.resultadosQuiz.length
    }));

    const aulasObrigatoriasIds = new Set(aulasObrigatorias.map((aula) => aula.id));

    const academicByStudent = alunos.map((aluno) => {
      const totalPresencas = aluno.presencas.length;
      const attendanceScore = aluno.presencas.reduce((sum, presenca) => {
        if (presenca.status === 'presente') return sum + 1;
        if (presenca.status === 'parcial') return sum + 0.5;
        return sum;
      }, 0);
      const painelProgresso = buildStudentProgressDashboard({
        aulasPublicadas: aulasObrigatorias,
        progressos: aluno.progressos.filter((progresso) => aulasObrigatoriasIds.has(progresso.aulaId)),
        avaliacoesPublicadas: avaliacoes.map((avaliacao) => ({
          id: avaliacao.id,
          titulo: avaliacao.titulo,
          tipo: avaliacao.tipo,
          dataLimite: avaliacao.dataLimite,
          criadoEm: avaliacao.criadoEm,
          modulo: avaliacao.modulo,
          aula: avaliacao.aula
        })),
        entregas: aluno.entregasAvaliacao,
        now
      });

      return {
        alunoId: aluno.id,
        nome: aluno.nome,
        email: aluno.email,
        aulasConcluidas: painelProgresso.progressoAulas.concluidas,
        progressoAulas: painelProgresso.progressoAulas.percentual,
        progressoAvaliacoes: painelProgresso.progressoAvaliacoes.percentual,
        progressoGeral: painelProgresso.progressoGeral,
        aulasAtrasadas: painelProgresso.aulasAtrasadas.length,
        avaliacoesAtrasadas: painelProgresso.avaliacoesPendentesAtrasadas.length,
        frequenciaGeral: totalPresencas > 0 ? Math.round((attendanceScore / totalPresencas) * 100) : 0,
        ...buildDeliverySummary(aluno.entregasAvaliacao)
      };
    });

    const performanceByAssessment = avaliacoes.map((avaliacao) => {
      const notas = avaliacao.entregas
        .map((entrega) => entrega.nota)
        .filter((nota): nota is number => typeof nota === 'number');
      const percentuaisObjetivos = avaliacao.entregas
        .map((entrega) => entrega.percentualObjetivo)
        .filter((percentual): percentual is number => typeof percentual === 'number');

      return {
        id: avaliacao.id,
        titulo: avaliacao.titulo,
        tipo: avaliacao.tipo,
        formato: avaliacao.formato,
        modulo: avaliacao.modulo?.titulo || avaliacao.aula?.titulo || 'Sem vinculo',
        totalEntregas: avaliacao.entregas.filter((entrega) => entrega.status === 'enviado' || entrega.status === 'corrigido').length,
        corrigidas: avaliacao.entregas.filter((entrega) => entrega.status === 'corrigido').length,
        mediaNotas: notas.length ? Math.round((notas.reduce((sum, nota) => sum + nota, 0) / notas.length) * 10) / 10 : null,
        mediaAcertoObjetivo: percentuaisObjetivos.length
          ? Math.round(percentuaisObjetivos.reduce((sum, percentual) => sum + percentual, 0) / percentuaisObjetivos.length)
          : null
      };
    });

    res.json({ engajamento, logins, academicByStudent, performanceByAssessment });
  } catch {
    res.status(500).json({ error: 'Erro' });
  }
});

// GET /api/admin/aula/:id/status-ia
router.get('/aula/:id/status-ia', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const aulaId = readString(req.params.id);
    if (!aulaId) {
      res.status(400).json({ error: 'Aula invalida' });
      return;
    }

    const aula = await prisma.aula.findUnique({
      where: { id: aulaId },
      select: { statusIA: true }
    });
    res.json(aula);
  } catch {
    res.status(500).json({ error: 'Erro' });
  }
});

// Transcribe audio using local faster-whisper (preferred â€” $0, no limits)
async function transcribeLocal(audioFile: string): Promise<string> {
  const scriptPath = path.join(process.cwd(), 'whisper_transcribe.py');
  const { stdout } = await execFileAsync('python3', [scriptPath, audioFile], {
    timeout: 10800000, maxBuffer: 10 * 1024 * 1024 // 3h timeout, 10MB buffer
  });
  return stdout.trim();
}

// Splits audio file into 20-min chunks for API fallback (Groq 25MB limit)
async function splitAudioIntoChunks(audioFile: string, tempDir: string, chunkSecs = 1200): Promise<string[]> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioFile
  ]);
  const totalSecs = parseFloat(stdout.trim());
  if (!totalSecs || Number.isNaN(totalSecs)) throw new Error('Nao foi possivel determinar a duracao do audio.');

  const numChunks = Math.ceil(totalSecs / chunkSecs);
  const chunks: string[] = [];

  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSecs;
    const chunkFile = path.join(tempDir, `chunk-${String(i).padStart(3, '0')}.mp3`);
    await execFileAsync('ffmpeg', [
      '-y', '-i', audioFile,
      '-ss', String(start), '-t', String(chunkSecs),
      '-ar', '16000', '-ac', '1', '-b:a', '32k', '-f', 'mp3', chunkFile
    ], { timeout: 120000 });
    chunks.push(chunkFile);
  }

  return chunks;
}

function getApiTranscriptionProvider(): { endpoint: string; apiKey: string; model: string; provider: string } | null {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    return {
      endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
      apiKey: groqKey,
      model: 'whisper-large-v3-turbo',
      provider: 'Groq'
    };
  }
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    return {
      endpoint: 'https://api.openai.com/v1/audio/transcriptions',
      apiKey: openaiKey,
      model: 'whisper-1',
      provider: 'OpenAI'
    };
  }
  return null;
}

async function transcribeChunk(chunkFile: string, provider: NonNullable<ReturnType<typeof getApiTranscriptionProvider>>): Promise<string> {
  const audioBuffer = await readFile(chunkFile);
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  const formData = new FormData();
  formData.append('file', blob, path.basename(chunkFile));
  formData.append('model', provider.model);
  formData.append('language', 'pt');

  const res = await fetch(provider.endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${provider.apiKey}` },
    body: formData
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) throw new Error(`RATE_LIMIT: ${err}`);
    throw new Error(`Whisper HTTP ${res.status}: ${err}`);
  }

  const data = await res.json() as { text: string };
  return data.text?.trim() ?? '';
}

// POST /api/admin/aula/:id/processar-ia â€” save transcript and generate IA content via OpenAI
router.post('/aula/:id/processar-ia', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const aulaId = readString(req.params.id);
    if (!aulaId) { res.status(400).json({ error: 'ID invalido' }); return; }

    const transcricao = (req.body?.transcricao ?? '').toString().trim();
    if (!transcricao) { res.status(400).json({ error: 'Transcricao e obrigatoria.' }); return; }

    const aula = await prisma.aula.findUnique({
      where: { id: aulaId },
      include: { modulo: true }
    });
    if (!aula) { res.status(404).json({ error: 'Aula nao encontrada' }); return; }

    // Save transcript and mark as processing
    await prisma.aula.update({ where: { id: aulaId }, data: { transcricao, statusIA: 'processando' } });

    // Generate enrichment content from transcript
    const result = await processIAFromTranscript(aulaId, aula.titulo, transcricao, { modulo: aula.modulo?.titulo });

    await prisma.aula.update({
      where: { id: aulaId },
      data: {
        resumo: result.resumo,
        pontosChave: result.pontosChave,
        versiculos: result.versiculos,
        glossario: result.glossario,
        statusIA: 'concluido'
      }
    });

    // Create or update quiz
    const existingQuiz = await prisma.quiz.findFirst({ where: { aulaId } });
    if (existingQuiz) {
      await prisma.quiz.update({ where: { id: existingQuiz.id }, data: { questoes: result.quiz } });
    } else {
      await prisma.quiz.create({ data: { aulaId, questoes: result.quiz } });
    }

    res.json({ ok: true, provider: result.provider });
  } catch (error) {
    logger.error('Processar IA error:', error);
    res.status(500).json({ error: 'Erro ao processar IA.' });
  }
});

// POST /api/admin/aula/:id/gerar-transcricao â€” local Whisper (free) with API fallback
router.post('/aula/:id/gerar-transcricao', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const aulaId = readString(req.params.id);
  if (!aulaId) {
    res.status(400).json({ error: 'ID invalido' });
    return;
  }

  const aula = await prisma.aula.findUnique({
    where: { id: aulaId },
    select: { id: true, urlVideo: true }
  });

  if (!aula) {
    res.status(404).json({ error: 'Aula nao encontrada' });
    return;
  }

  const videoId = extractYouTubeVideoId(aula.urlVideo);
  if (!videoId) {
    res.status(400).json({ error: 'Esta aula nao tem video do YouTube' });
    return;
  }

  try {
    // 1. Try YouTube auto-generated transcript (instant, no audio download needed)
    const ytTranscript = await fetchYoutubeTranscript(videoId);
    if (ytTranscript) {
      await prisma.aula.update({ where: { id: aulaId }, data: { transcricao: ytTranscript } });
      res.json({ ok: true, chars: ytTranscript.length, chunks: 1, provider: 'YouTube Transcript' });
      return;
    }

    // 2. Fallback: download audio and transcribe with local Whisper
    const tempDir = await mkdtemp(path.join(tmpdir(), 'yt-audio-'));
    const rawAudio = path.join(tempDir, 'audio.mp3');

    try {
      if (!isValidYouTubeId(videoId)) throw new Error('ID de video invalido.');
      await execFileAsync('yt-dlp', [
        '-x', '--audio-format', 'mp3', '--audio-quality', '0', '--no-playlist',
        '--extractor-args', 'youtube:player_client=ios,mweb',
        '-P', tempDir, '-o', 'audio.%(ext)s',
        `https://www.youtube.com/watch?v=${videoId}`
      ], { timeout: 600000 });

      const processedAudio = path.join(tempDir, 'audio.wav');
      await execFileAsync('ffmpeg', [
        '-y', '-i', rawAudio, '-ar', '16000', '-ac', '1', processedAudio
      ], { timeout: 300000 });

      let transcricao = '';
      let provider = 'Whisper local';

      try {
        transcricao = await transcribeLocal(processedAudio);
      } catch (localError) {
        logger.warn('Local whisper unavailable, falling back to API:', localError instanceof Error ? localError.message : localError);

        const apiProvider = getApiTranscriptionProvider();
        if (!apiProvider) {
          throw new Error('Legendas do YouTube indisponiveis, Whisper local nao disponivel e nenhuma API configurada (GROQ_API_KEY ou OPENAI_API_KEY).');
        }

        const chunks = await splitAudioIntoChunks(rawAudio, tempDir, 1200);
        const parts: string[] = [];
        let rateLimited = false;
        let completedChunks = 0;

        for (const chunk of chunks) {
          try {
            const part = await transcribeChunk(chunk, apiProvider);
            if (part) parts.push(part);
            completedChunks++;
          } catch (chunkError) {
            const msg = chunkError instanceof Error ? chunkError.message : '';
            if (msg.startsWith('RATE_LIMIT')) { rateLimited = true; break; }
            throw chunkError;
          }
        }

        transcricao = parts.join(' ').replace(/\s+/g, ' ').trim();
        provider = apiProvider.provider;

        if (transcricao) {
          await prisma.aula.update({ where: { id: aulaId }, data: { transcricao } });
        }

        if (rateLimited) {
          const minutesDone = completedChunks * 20;
          const minutesTotal = chunks.length * 20;
          res.status(206).json({
            ok: false, partial: true, chars: transcricao.length,
            completedChunks, totalChunks: chunks.length, provider: apiProvider.provider,
            error: `Limite diario do Groq atingido apos ${minutesDone} min (de ${minutesTotal} min). Transcricao parcial salva. Tente novamente amanha.`
          });
          return;
        }

        res.json({ ok: true, chars: transcricao.length, chunks: chunks.length, provider });
        return;
      }

      transcricao = transcricao.replace(/\s+/g, ' ').trim();
      if (transcricao) {
        await prisma.aula.update({ where: { id: aulaId }, data: { transcricao } });
      }

      res.json({ ok: true, chars: transcricao.length, chunks: 1, provider });
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (error) {
    logger.error('Transcricao error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Whisper HTTP')) {
      res.status(502).json({ error: `Erro na API de transcricao. Detalhe: ${msg}` });
    } else {
      res.status(500).json({ error: msg || 'Erro ao gerar transcricao.' });
    }
  }
});

// GET /api/admin/alertas-seguranca â€” list security alerts (unread first)
router.get('/alertas-seguranca', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alertas = await prisma.alertaSeguranca.findMany({
      orderBy: [{ lido: 'asc' }, { criadoEm: 'desc' }],
      include: { usuario: { select: { id: true, nome: true, email: true } } },
      take: 100
    });
    res.json(alertas);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erro' });
  }
});

// PUT /api/admin/alerta-seguranca/:id/ler â€” mark alert as read
router.put('/alerta-seguranca/:id/ler', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.alertaSeguranca.update({ where: { id: String(req.params.id) }, data: { lido: true } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Alerta nao encontrado.' });
  }
});

// GET /api/admin/brand/lideranca â€” returns current leadership slides config
router.get('/brand/lideranca', (_req: AuthRequest, res: Response): void => {
  const config = readBrandConfig();
  const slides = config.map((entry) => {
    const filePath = path.resolve(`uploads/brand/lideranca-${entry.slot}.jpg`);
    const hasUpload = fs.existsSync(filePath);
    return {
      slot: entry.slot,
      name: entry.name,
      objectPosition: entry.objectPosition,
      url: hasUpload ? `/api/uploads/brand/lideranca-${entry.slot}.jpg` : `/brand/${entry.slot}.jpg`
    };
  });
  res.json(slides);
});

// PUT /api/admin/brand/lideranca/:slot â€” upload photo and/or update name
router.put('/brand/lideranca/:slot', uploadBrand.single('foto'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const slot = Number(req.params.slot);
    if (![1, 2, 3].includes(slot)) { res.status(400).json({ error: 'Slot invalido. Use 1, 2 ou 3.' }); return; }

    const config = readBrandConfig();
    const entry = config.find(e => e.slot === slot);
    if (!entry) { res.status(404).json({ error: 'Slot nao encontrado.' }); return; }

    if (req.body?.name) entry.name = String(req.body.name).trim();
    if (req.body?.objectPosition) entry.objectPosition = String(req.body.objectPosition).trim();
    writeBrandConfig(config);

    const filePath = path.resolve(`uploads/brand/lideranca-${slot}.jpg`);
    const hasUpload = fs.existsSync(filePath);
    res.json({
      slot: entry.slot,
      name: entry.name,
      objectPosition: entry.objectPosition,
      url: hasUpload ? `/api/uploads/brand/lideranca-${slot}.jpg` : `/brand/${slot}.jpg`
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erro ao salvar.' });
  }
});

export default router;
