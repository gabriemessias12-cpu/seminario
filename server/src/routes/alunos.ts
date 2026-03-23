import fs from 'fs';
import path from 'path';
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest, generateVideoToken, verifyVideoToken } from '../middleware/auth.js';
import { buildBulletinByModule, buildDeliverySummary, buildModuleFrequencyReport } from '../services/academic-report.js';
import { askLessonAssistant, getAIConfig } from '../services/ai-mock.js';
import { aiCreditSettings, consumeAICredit, syncDailyAICredits, updateAIConsent } from '../services/ai-credits.js';
import {
  gradeObjectiveAnswers,
  parseObjectiveAnswers,
  parseObjectiveQuestions,
  sanitizeObjectiveQuestions
} from '../utils/objective-assessment.js';
import { sendStoredUpload } from '../utils/stored-file.js';
import { extractYouTubeVideoId, getLessonVideoKind, getYouTubeEmbedUrl } from '../utils/video-source.js';
import { logger } from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

const submissionStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.resolve('uploads/submissions')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const uploadSubmission = multer({ storage: submissionStorage, limits: { fileSize: 1024 * 1024 * 1024 } });

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

type ModuloComAulas = {
  aulas: Array<{
    presencas: Array<{ status: string; metodo: string; percentual: number }>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

function readString(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function parseJSONArray<T>(value: string | null | undefined): T[] {
  if (!value) {
    return [];
  }

  try {
    return JSON.parse(value) as T[];
  } catch {
    return [];
  }
}

function formatAIStatus(status: Awaited<ReturnType<typeof syncDailyAICredits>>) {
  const config = getAIConfig();

  return {
    provider: config.provider,
    model: config.model,
    configured: config.configured,
    compartilhaDadosIA: status.compartilhaDadosIA,
    creditosDisponiveis: status.aiCreditosDisponiveis,
    limiteDiario: status.limiteDiario,
    bonusCompartilhamento: aiCreditSettings.bonusCompartilhamento,
    creditosBase: aiCreditSettings.creditosBase,
    ultimaRecarga: status.aiCreditosUltimaRecarga
  };
}

function parseInteractionRecord<T>(value: T) {
  const interaction = value as T & { resposta?: string };
  if (!interaction.resposta) {
    return interaction;
  }

  try {
    const parsed = JSON.parse(interaction.resposta);
    return {
      ...interaction,
      resposta: parsed.resposta || interaction.resposta,
      detalhes: parsed
    };
  } catch {
    return interaction;
  }
}

function hasAttendanceUnlock(presenca?: { status?: string | null; metodo?: string | null } | null) {
  return presenca?.status === 'presente' && (presenca.metodo === 'meet' || presenca.metodo === 'presencial');
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeSequentialProgress(params: {
  requestedPercentual: number;
  requestedPosicao: number;
  existingPercentual?: number;
  existingPosicao?: number;
  duracaoSegundos?: number | null;
  allowFreeSeek?: boolean;
}) {
  const requestedPercentual = clamp(params.requestedPercentual, 0, 100);
  const requestedPosicao = Math.max(0, params.requestedPosicao);
  const existingPercentual = Math.max(0, params.existingPercentual ?? 0);
  const existingPosicao = Math.max(0, params.existingPosicao ?? 0);
  const duracaoSegundos = Math.max(0, params.duracaoSegundos ?? 0);

  if (params.allowFreeSeek) {
    return {
      percentualAssistido: Math.max(existingPercentual, requestedPercentual),
      posicaoAtualSegundos: requestedPosicao
    };
  }

  const allowedAdvanceSeconds = 15;
  const maxAllowedPosition = duracaoSegundos > 0
    ? Math.min(duracaoSegundos, existingPosicao + allowedAdvanceSeconds)
    : existingPosicao + allowedAdvanceSeconds;
  const safePosition = clamp(requestedPosicao, existingPosicao, maxAllowedPosition);
  const derivedPercentual = duracaoSegundos > 0
    ? Math.round((safePosition / duracaoSegundos) * 100)
    : existingPercentual + 4;

  return {
    percentualAssistido: Math.max(existingPercentual, Math.min(requestedPercentual, derivedPercentual)),
    posicaoAtualSegundos: safePosition
  };
}

function buildPresenceUpdate(percentual: number, presencaAtual?: { status: string; metodo: string; percentual: number } | null) {
  if (hasAttendanceUnlock(presencaAtual)) {
    return {
      status: presencaAtual!.status,
      metodo: presencaAtual!.metodo,
      percentual: Math.max(presencaAtual!.percentual, percentual),
      registradoEm: new Date()
    };
  }

  const status = percentual >= 70 ? 'presente' : percentual >= 30 ? 'parcial' : 'ausente';
  return {
    status,
    metodo: presencaAtual?.metodo || 'digital',
    percentual,
    registradoEm: new Date()
  };
}

// All routes require auth
router.use(authMiddleware);

// GET /api/aluno/dashboard
router.get('/dashboard', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const iaStatus = formatAIStatus(await syncDailyAICredits(prisma, userId));

    const totalAulas = await prisma.aula.count({ where: { publicado: true } });
    const progressos = await prisma.progressoAluno.findMany({ where: { alunoId: userId } });
    const aulasConc = progressos.filter((p: { concluido: boolean }) => p.concluido).length;
    const resultados = await prisma.resultadoQuiz.findMany({ where: { alunoId: userId } });
    const mediaQuiz = resultados.length > 0
      ? Math.round(resultados.reduce((s: number, r: { pontuacao: number; totalQuestoes: number }) => s + (r.pontuacao / r.totalQuestoes * 100), 0) / resultados.length)
      : 0;

    const notificacoes = await prisma.notificacao.findMany({
      where: { alunoId: userId, lida: false },
      orderBy: { criadaEm: 'desc' },
      take: 5
    });

    // Next lesson: first published lesson not completed
    const completedIds = progressos
      .filter((p: { concluido: boolean }) => p.concluido)
      .map((p: { aulaId: string }) => p.aulaId);
    const proximaAula = await prisma.aula.findFirst({
      where: { publicado: true, id: { notIn: completedIds } },
      include: { modulo: true },
      orderBy: [{ modulo: { ordem: 'asc' } }, { criadoEm: 'asc' }]
    });

    // Recent activity
    const atividadeRecente = await prisma.progressoAluno.findMany({
      where: { alunoId: userId },
      include: { aula: { select: { titulo: true, thumbnail: true } } },
      orderBy: { dataInicio: 'desc' },
      take: 5
    });

    res.json({
      totalAulas,
      aulasConcluidas: aulasConc,
      percentualCurso: totalAulas > 0 ? Math.round((aulasConc / totalAulas) * 100) : 0,
      mediaQuiz,
      notificacoes,
      proximaAula,
      atividadeRecente,
      ia: iaStatus
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

// GET /api/aluno/aulas
router.get('/aulas', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const modulos = await prisma.modulo.findMany({
      where: { ativo: true },
      include: {
        aulas: {
          where: { publicado: true },
          orderBy: { criadoEm: 'asc' },
          include: {
            progressos: { where: { alunoId: userId }, take: 1 },
            presencas: {
              where: { alunoId: userId },
              take: 1,
              select: {
                status: true,
                metodo: true,
                percentual: true
              }
            }
          }
        }
      },
      orderBy: { ordem: 'asc' }
    });

    res.json(
      modulos.map((modulo: ModuloComAulas) => ({
        ...modulo,
        aulas: modulo.aulas.map((aula: ModuloComAulas['aulas'][number]) => {
          const presenca = aula.presencas[0] || null;
          return {
            ...aula,
            controleVideo: {
              liberaSeek: hasAttendanceUnlock(presenca),
              permiteConclusaoManual: hasAttendanceUnlock(presenca)
            }
          };
        })
      }))
    );
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar aulas' });
  }
});

// GET /api/aluno/aula/:id
router.get('/aula/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const aulaId = readString(req.params.id);
    const iaStatus = formatAIStatus(await syncDailyAICredits(prisma, userId));
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
        progressos: { where: { alunoId: userId }, take: 1 },
        anotacoes: { where: { alunoId: userId }, take: 1 },
        presencas: {
          where: { alunoId: userId },
          take: 1,
          select: {
            status: true,
            metodo: true,
            percentual: true
          }
        }
      }
    });

    if (!aula) {
      res.status(404).json({ error: 'Aula não encontrada' });
      return;
    }

    // Get quiz result if exists
    const melhorResultado = await prisma.resultadoQuiz.findFirst({
      where: { alunoId: userId, aulaId },
      orderBy: { pontuacao: 'desc' }
    });

    const interacoesIA = await prisma.interacaoIA.findMany({
      where: { alunoId: userId, aulaId },
      orderBy: { criadoEm: 'desc' },
      take: 6
    });

    const presenca = aula.presencas[0] || null;
    const podeControlarLivremente = hasAttendanceUnlock(presenca);
    const videoTipo = getLessonVideoKind(aula.urlVideo);
    const videoStreamUrl = videoTipo === 'upload'
      ? `/api/aluno/aula/${aula.id}/video?token=${generateVideoToken({ userId, aulaId: aula.id })}`
      : null;
    res.json({
      ...aula,
      urlVideo: null,
      videoTipo,
      videoStreamUrl,
      presenca,
      controleVideo: {
        liberaSeek: podeControlarLivremente,
        permiteConclusaoManual: podeControlarLivremente,
        origem: podeControlarLivremente ? presenca?.metodo : 'restrito'
      },
      // Quiz only available when transcript exists (no transcript = no quiz)
      quizzes: aula.transcricao ? aula.quizzes : [],
      melhorResultado,
      interacoesIA: interacoesIA.map(parseInteractionRecord),
      ia: iaStatus
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar aula' });
  }
});

// GET /api/aluno/aula/:id/ytk — returns obfuscated YouTube videoId for authenticated students
router.get('/aula/:id/ytk', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const aulaId = readString(req.params.id);
    const userId = req.user?.userId;
    if (!aulaId || !userId) {
      res.status(400).json({ error: 'Parametros invalidos' });
      return;
    }

    const aula = await prisma.aula.findFirst({
      where: { id: aulaId, publicado: true },
      select: { id: true, urlVideo: true }
    });

    if (!aula || getLessonVideoKind(aula.urlVideo) !== 'youtube') {
      res.status(404).json({ error: 'Aula nao encontrada ou nao e YouTube' });
      return;
    }

    const videoId = extractYouTubeVideoId(aula.urlVideo);
    if (!videoId) {
      res.status(404).json({ error: 'ID do video nao encontrado' });
      return;
    }

    // XOR each char of videoId with corresponding char of aulaId, then base64-encode
    const key = aulaId;
    const xored = videoId.split('').map((ch, i) => ch.charCodeAt(0) ^ key.charCodeAt(i % key.length));
    const encoded = Buffer.from(xored).toString('base64');

    res.json({ k: encoded });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao obter token de video' });
  }
});

// GET /api/aluno/aula/:id/video
router.get('/aula/:id/video', async (req, res: Response): Promise<void> => {
  try {
    const aulaId = readString(req.params.id);
    const token = readString(req.query.token as string | string[] | undefined);

    if (!aulaId || !token) {
      res.status(400).json({ error: 'Token ou aula invalidos' });
      return;
    }

    let payload;
    try {
      payload = verifyVideoToken(token);
    } catch {
      res.status(401).json({ error: 'Token de video invalido ou expirado' });
      return;
    }

    if (payload.aulaId !== aulaId) {
      res.status(403).json({ error: 'Acesso negado ao video' });
      return;
    }

    const aula = await prisma.aula.findFirst({
      where: {
        id: aulaId,
        publicado: true
      },
      select: {
        id: true,
        titulo: true,
        urlVideo: true
      }
    });

    if (!aula?.urlVideo) {
      res.status(404).json({ error: 'Video nao encontrado' });
      return;
    }

    if (getLessonVideoKind(aula.urlVideo) !== 'upload') {
      res.status(404).json({ error: 'Aula sem arquivo local de video' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        ativo: true,
        papel: { in: ['aluno', 'admin', 'pastor'] }
      },
      select: { id: true }
    });

    if (!user) {
      res.status(403).json({ error: 'Usuario sem acesso ao video' });
      return;
    }

    const fileName = path.basename(aula.urlVideo);
    const videoPath = path.resolve('uploads/videos', fileName);

    if (!fs.existsSync(videoPath)) {
      res.status(404).json({ error: 'Arquivo de video nao encontrado' });
      return;
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const ext = path.extname(fileName).toLowerCase();
    const contentType = ext === '.mov'
      ? 'video/quicktime'
      : ext === '.avi'
        ? 'video/x-msvideo'
        : 'video/mp4';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    if (range) {
      const [startValue, endValue] = range.replace(/bytes=/, '').split('-');
      const start = Number(startValue);
      const end = endValue ? Number(endValue) : fileSize - 1;
      const safeStart = Number.isFinite(start) ? Math.max(0, start) : 0;
      const safeEnd = Number.isFinite(end) ? Math.min(end, fileSize - 1) : fileSize - 1;

      if (safeStart >= fileSize || safeEnd < safeStart) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }

      res.status(206);
      res.setHeader('Content-Range', `bytes ${safeStart}-${safeEnd}/${fileSize}`);
      res.setHeader('Content-Length', safeEnd - safeStart + 1);
      fs.createReadStream(videoPath, { start: safeStart, end: safeEnd }).pipe(res);
      return;
    }

    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(videoPath).pipe(res);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar video' });
  }
});

// POST /api/aluno/progresso
router.post('/progresso', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { aulaId, percentualAssistido, posicaoAtualSegundos, pausou } = req.body;

    const aula = await prisma.aula.findUnique({
      where: { id: aulaId },
      select: { id: true, duracaoSegundos: true }
    });

    if (!aula) {
      res.status(404).json({ error: 'Aula nao encontrada' });
      return;
    }

    const presencaAtual = await prisma.presenca.findUnique({
      where: { alunoId_aulaId: { alunoId: userId, aulaId } }
    });
    const liberaSeek = hasAttendanceUnlock(presencaAtual);
    const requestedPercentual = toFiniteNumber(percentualAssistido, 0);
    const requestedPosicao = toFiniteNumber(posicaoAtualSegundos, 0);

    const existing = await prisma.progressoAluno.findUnique({
      where: { alunoId_aulaId: { alunoId: userId, aulaId } }
    });

    if (existing) {
      const normalized = normalizeSequentialProgress({
        requestedPercentual,
        requestedPosicao,
        existingPercentual: existing.percentualAssistido,
        existingPosicao: existing.posicaoAtualSegundos,
        duracaoSegundos: aula.duracaoSegundos,
        allowFreeSeek: liberaSeek
      });
      const newPercentual = normalized.percentualAssistido;
      const concluido = newPercentual >= 95;

      await prisma.progressoAluno.update({
        where: { id: existing.id },
        data: {
          percentualAssistido: newPercentual,
          posicaoAtualSegundos: normalized.posicaoAtualSegundos,
          tempoTotalSegundos: existing.tempoTotalSegundos + 5,
          concluido,
          dataConclusao: concluido && !existing.concluido ? new Date() : existing.dataConclusao,
          vezesQueParou: pausou ? existing.vezesQueParou + 1 : existing.vezesQueParou
        }
      });

      await prisma.presenca.upsert({
        where: { alunoId_aulaId: { alunoId: userId, aulaId } },
        update: buildPresenceUpdate(newPercentual, presencaAtual),
        create: {
          alunoId: userId,
          aulaId,
          ...buildPresenceUpdate(newPercentual, presencaAtual)
        }
      });

      res.json({ percentualAssistido: newPercentual, concluido, liberaSeek });
    } else {
      const normalized = normalizeSequentialProgress({
        requestedPercentual,
        requestedPosicao,
        duracaoSegundos: aula.duracaoSegundos,
        allowFreeSeek: liberaSeek
      });
      const concluido = normalized.percentualAssistido >= 95;

      const progresso = await prisma.progressoAluno.create({
        data: {
          alunoId: userId,
          aulaId,
          percentualAssistido: normalized.percentualAssistido,
          posicaoAtualSegundos: normalized.posicaoAtualSegundos,
          tempoTotalSegundos: 5,
          concluido,
          dataConclusao: concluido ? new Date() : null,
          sessoes: 1,
          vezesQueParou: pausou ? 1 : 0
        }
      });

      await prisma.presenca.upsert({
        where: { alunoId_aulaId: { alunoId: userId, aulaId } },
        update: buildPresenceUpdate(progresso.percentualAssistido, presencaAtual),
        create: {
          alunoId: userId,
          aulaId,
          ...buildPresenceUpdate(progresso.percentualAssistido, presencaAtual)
        }
      });

      res.json(progresso);
    }
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao salvar progresso' });
  }
});

// POST /api/aluno/aula/:id/concluir
router.post('/aula/:id/concluir', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const aulaId = readString(req.params.id);

    if (!aulaId) {
      res.status(400).json({ error: 'Aula invalida' });
      return;
    }

    const aula = await prisma.aula.findUnique({
      where: { id: aulaId },
      select: { id: true, duracaoSegundos: true }
    });

    if (!aula) {
      res.status(404).json({ error: 'Aula nao encontrada' });
      return;
    }

    const presenca = await prisma.presenca.findUnique({
      where: { alunoId_aulaId: { alunoId: userId, aulaId } }
    });

    if (!hasAttendanceUnlock(presenca)) {
      res.status(403).json({ error: 'A conclusao manual desta aula exige presenca confirmada em Meet ou Presencial.' });
      return;
    }

    const progresso = await prisma.progressoAluno.upsert({
      where: { alunoId_aulaId: { alunoId: userId, aulaId } },
      update: {
        percentualAssistido: 100,
        posicaoAtualSegundos: aula.duracaoSegundos || 0,
        concluido: true,
        dataConclusao: new Date()
      },
      create: {
        alunoId: userId,
        aulaId,
        percentualAssistido: 100,
        posicaoAtualSegundos: aula.duracaoSegundos || 0,
        tempoTotalSegundos: 0,
        concluido: true,
        dataConclusao: new Date(),
        sessoes: 1
      }
    });

    await prisma.presenca.update({
      where: { alunoId_aulaId: { alunoId: userId, aulaId } },
      data: {
        percentual: 100,
        registradoEm: new Date()
      }
    });

    res.json({
      ok: true,
      progresso
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao concluir aula' });
  }
});

// POST /api/aluno/quiz
router.post('/quiz', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { aulaId, respostas, pontuacao, totalQuestoes } = req.body;

    const resultado = await prisma.resultadoQuiz.create({
      data: {
        alunoId: userId,
        aulaId,
        respostas: JSON.stringify(respostas),
        pontuacao,
        totalQuestoes
      }
    });

    res.json(resultado);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao salvar resultado do quiz' });
  }
});

// PUT /api/aluno/anotacao
router.put('/anotacao', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { aulaId, conteudo } = req.body;

    const anotacao = await prisma.anotacaoAluno.upsert({
      where: { alunoId_aulaId: { alunoId: userId, aulaId } },
      update: { conteudo, atualizadoEm: new Date() },
      create: { alunoId: userId, aulaId, conteudo }
    });

    res.json(anotacao);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao salvar anotação' });
  }
});

// GET /api/aluno/materiais
router.get('/materiais', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);

    const [materiais, total] = await Promise.all([
      prisma.material.findMany({
        include: { materiaisAula: { include: { aula: { select: { titulo: true } } } } },
        orderBy: { criadoEm: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize
      }),
      prisma.material.count()
    ]);
    res.json({ data: materiais, total, page, pageSize });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar materiais' });
  }
});

// GET /api/aluno/avaliacoes
router.get('/avaliacoes', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const avaliacoes = await prisma.avaliacao.findMany({
      where: { publicado: true },
      include: {
        modulo: { select: { id: true, titulo: true } },
        aula: { select: { id: true, titulo: true } },
        entregas: {
          where: { alunoId: userId },
          take: 1
        }
      },
      orderBy: [
        { dataLimite: 'asc' },
        { criadoEm: 'desc' }
      ]
    });

    res.json(avaliacoes.map((avaliacao) => {
      const entregaAtual = avaliacao.entregas[0] || null;
      const questoesObjetivas = parseObjectiveQuestions(avaliacao.questoesObjetivas);
      const respostasObjetivas = parseObjectiveAnswers(entregaAtual?.respostasObjetivas, questoesObjetivas.length);
      const review = entregaAtual && questoesObjetivas.length
        ? gradeObjectiveAnswers(questoesObjetivas, respostasObjetivas, avaliacao.notaMaxima)
        : null;

      return {
        ...avaliacao,
        quantidadeQuestoes: questoesObjetivas.length,
        questoesObjetivas: sanitizeObjectiveQuestions(questoesObjetivas),
        entregaAtual,
        resultadoObjetivo: review && avaliacao.resultadoImediato && entregaAtual?.status === 'corrigido'
          ? {
              totalQuestoes: review.totalQuestoes,
              acertosObjetivos: review.acertosObjetivos,
              percentualObjetivo: review.percentualObjetivo,
              respostas: review.respostas
            }
          : null
      };
    }));
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar avaliacoes' });
  }
});

// POST /api/aluno/avaliacao/:id/entrega
router.post('/avaliacao/:id/entrega', uploadSubmission.single('arquivo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const avaliacaoId = readString(req.params.id);
    const respostaTexto = readString(req.body.respostaTexto);
    const respostasObjetivasPayload = readString(req.body.respostasObjetivas);
    const arquivo = req.file;

    if (!avaliacaoId) {
      res.status(400).json({ error: 'Avaliacao invalida.' });
      return;
    }

    const avaliacao = await prisma.avaliacao.findFirst({
      where: {
        id: avaliacaoId,
        publicado: true
      }
    });

    if (!avaliacao) {
      res.status(404).json({ error: 'Avaliacao nao encontrada.' });
      return;
    }

    const questoesObjetivas = parseObjectiveQuestions(avaliacao.questoesObjetivas);

    if (avaliacao.formato === 'objetiva') {
      if (arquivo || respostaTexto?.trim()) {
        res.status(400).json({ error: 'Esta prova deve ser respondida pelo questionario objetivo da plataforma.' });
        return;
      }

      if (!questoesObjetivas.length) {
        res.status(400).json({ error: 'A prova objetiva nao possui questoes validas cadastradas.' });
        return;
      }
    }

    const entregaExistente = await prisma.entregaAvaliacao.findUnique({
      where: {
        avaliacaoId_alunoId: {
          avaliacaoId,
          alunoId: userId
        }
      }
    });

    const arquivoAnterior = entregaExistente?.arquivoUrl;

    if (avaliacao.formato === 'objetiva') {
      if (entregaExistente?.enviadoEm) {
        res.status(409).json({ error: 'Esta prova objetiva ja foi enviada e nao aceita nova tentativa.' });
        return;
      }

      const respostasObjetivas = parseObjectiveAnswers(respostasObjetivasPayload, questoesObjetivas.length);

      // Validate: every question must be answered (number for objetiva, non-empty string for dissertativa)
      const unanswered = questoesObjetivas.some((q, i) => {
        const ans = respostasObjetivas[i];
        if (q.tipo === 'dissertativa') return !ans || (typeof ans === 'string' && !ans.trim());
        return ans === null || ans === undefined;
      });
      if (respostasObjetivas.length !== questoesObjetivas.length || unanswered) {
        res.status(400).json({ error: 'Responda todas as questoes antes de enviar a prova.' });
        return;
      }

      const resultado = gradeObjectiveAnswers(questoesObjetivas, respostasObjetivas, avaliacao.notaMaxima);
      // If there are dissertativa questions, leave for manual review; otherwise auto-correct
      const statusEntrega = resultado.hasDissertativa ? 'enviado' : 'corrigido';
      const corrigidoEm = resultado.hasDissertativa ? null : new Date();
      const comentario = resultado.hasDissertativa
        ? `Correcao automatica das objetivas: ${resultado.acertosObjetivos}/${resultado.totalObjetivas} corretas. Questoes dissertativas aguardam correcao manual.`
        : `Correcao automatica: ${resultado.acertosObjetivos}/${resultado.totalQuestoes} questoes corretas.`;

      const entregaObjetiva = await prisma.entregaAvaliacao.upsert({
        where: {
          avaliacaoId_alunoId: {
            avaliacaoId,
            alunoId: userId
          }
        },
        update: {
          respostaTexto: null,
          arquivoUrl: null,
          respostasObjetivas: JSON.stringify(respostasObjetivas),
          status: statusEntrega,
          nota: resultado.nota,
          totalQuestoes: resultado.totalQuestoes,
          acertosObjetivos: resultado.acertosObjetivos,
          percentualObjetivo: resultado.percentualObjetivo,
          comentarioCorrecao: comentario,
          enviadoEm: new Date(),
          corrigidoEm
        },
        create: {
          avaliacaoId,
          alunoId: userId,
          respostasObjetivas: JSON.stringify(respostasObjetivas),
          status: statusEntrega,
          nota: resultado.nota,
          totalQuestoes: resultado.totalQuestoes,
          acertosObjetivos: resultado.acertosObjetivos,
          percentualObjetivo: resultado.percentualObjetivo,
          comentarioCorrecao: comentario,
          enviadoEm: new Date(),
          corrigidoEm
        }
      });

      res.json({
        ...entregaObjetiva,
        resultadoObjetivo: avaliacao.resultadoImediato
          ? {
              totalQuestoes: resultado.totalQuestoes,
              acertosObjetivos: resultado.acertosObjetivos,
              percentualObjetivo: resultado.percentualObjetivo,
              respostas: resultado.respostas
            }
          : null
      });
      return;
    }

    if (!avaliacao.permiteArquivo && arquivo) {
      res.status(400).json({ error: 'Esta atividade nao aceita arquivo.' });
      return;
    }

    if (!avaliacao.permiteTexto && respostaTexto) {
      res.status(400).json({ error: 'Esta atividade nao aceita resposta em texto.' });
      return;
    }

    if (!arquivo && !respostaTexto?.trim()) {
      res.status(400).json({ error: 'Envie um arquivo, uma resposta em texto ou ambos.' });
      return;
    }

    const entrega = await prisma.entregaAvaliacao.upsert({
      where: {
        avaliacaoId_alunoId: {
          avaliacaoId,
          alunoId: userId
        }
      },
      update: {
        respostaTexto: avaliacao.permiteTexto ? respostaTexto : entregaExistente?.respostaTexto,
        arquivoUrl: arquivo ? `/uploads/submissions/${arquivo.filename}` : entregaExistente?.arquivoUrl,
        status: 'enviado',
        enviadoEm: new Date(),
        comentarioCorrecao: null,
        nota: null,
        corrigidoEm: null
      },
      create: {
        avaliacaoId,
        alunoId: userId,
        respostaTexto: avaliacao.permiteTexto ? respostaTexto : null,
        arquivoUrl: arquivo ? `/uploads/submissions/${arquivo.filename}` : null,
        status: 'enviado',
        enviadoEm: new Date()
      }
    });

    if (arquivo && arquivoAnterior && arquivoAnterior !== entrega.arquivoUrl) {
      const arquivoAnteriorPath = path.resolve('uploads/submissions', path.basename(arquivoAnterior));
      if (fs.existsSync(arquivoAnteriorPath)) {
        fs.unlinkSync(arquivoAnteriorPath);
      }
    }

    res.json(entrega);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao enviar atividade' });
  }
});

// GET /api/aluno/entrega-avaliacao/:id/arquivo
router.get('/entrega-avaliacao/:id/arquivo', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const entregaId = readString(req.params.id);

    if (!entregaId) {
      res.status(400).json({ error: 'Entrega invalida.' });
      return;
    }

    const entrega = await prisma.entregaAvaliacao.findFirst({
      where: {
        id: entregaId,
        alunoId: userId
      },
      select: {
        arquivoUrl: true
      }
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

// GET /api/aluno/perfil
router.get('/perfil', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const iaStatus = formatAIStatus(await syncDailyAICredits(prisma, userId));
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        foto: true,
        criadoEm: true,
        compartilhaDadosIA: true,
        aiCreditosDisponiveis: true,
        aiCreditosUltimaRecarga: true
      }
    });

    const progressos = await prisma.progressoAluno.findMany({
      where: { alunoId: userId },
      include: { aula: { select: { titulo: true, modulo: { select: { titulo: true } } } } },
      orderBy: { dataInicio: 'desc' }
    });

    const resultados = await prisma.resultadoQuiz.findMany({
      where: { alunoId: userId },
      include: { aula: { select: { titulo: true } } },
      orderBy: { feitoEm: 'desc' }
    });

    const entregasAvaliacao = await prisma.entregaAvaliacao.findMany({
      where: { alunoId: userId },
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
    });

    const modulos = await prisma.modulo.findMany({
      where: { ativo: true },
      include: {
        aulas: {
          where: { publicado: true },
          include: {
            presencas: {
              where: { alunoId: userId },
              select: { status: true }
            }
          }
        }
      },
      orderBy: { ordem: 'asc' }
    });

    res.json({
      user,
      progressos,
      resultados,
      entregasAvaliacao,
      relatorioAcademico: {
        frequenciaPorModulo: buildModuleFrequencyReport(modulos),
        entregasResumo: buildDeliverySummary(entregasAvaliacao),
        boletimPorModulo: buildBulletinByModule(entregasAvaliacao)
      },
      ia: iaStatus
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar perfil' });
  }
});

// PUT /api/aluno/perfil
router.put('/perfil', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { nome, telefone } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { nome, telefone },
      select: { id: true, nome: true, email: true, telefone: true, foto: true }
    });

    res.json(user);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// PUT /api/aluno/perfil/foto
router.put('/perfil/foto', authMiddleware, uploadAvatar.single('foto'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      return;
    }
    const fotoUrl = `/api/uploads/avatars/${req.file.filename}`;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { foto: true } });
    // Delete old avatar file if exists
    if (user?.foto) {
      const oldPath = path.resolve(user.foto.replace(/^\//, ''));
      fs.unlink(oldPath, () => {});
    }
    await prisma.user.update({ where: { id: userId }, data: { foto: fotoUrl } });
    res.json({ foto: fotoUrl });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao salvar foto.' });
  }
});

// GET /api/aluno/ia/status
router.get('/ia/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const iaStatus = formatAIStatus(await syncDailyAICredits(prisma, userId));
    res.json(iaStatus);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao carregar status de IA' });
  }
});

// PUT /api/aluno/ia/consentimento
router.put('/ia/consentimento', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const compartilhaDadosIA = Boolean(req.body?.compartilhaDadosIA);
    const status = await updateAIConsent(prisma, userId, compartilhaDadosIA);
    res.json(formatAIStatus(status));
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao atualizar preferencia de IA' });
  }
});

// POST /api/aluno/ia/perguntar
router.post('/ia/perguntar', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const aulaId = readString(req.body?.aulaId);
    const pergunta = readString(req.body?.pergunta);

    if (!aulaId || !pergunta || pergunta.trim().length < 8) {
      res.status(400).json({ error: 'Informe a aula e uma pergunta mais detalhada.' });
      return;
    }

    const aula = await prisma.aula.findUnique({
      where: { id: aulaId },
      include: {
        modulo: true,
        materiaisAula: { include: { material: true } }
      }
    });

    if (!aula) {
      res.status(404).json({ error: 'Aula nao encontrada' });
      return;
    }

    if (!aula.transcricao) {
      res.status(400).json({ error: 'O assistente esta disponivel apenas para aulas com transcricao. Aguarde o administrador adicionar a transcricao desta aula.' });
      return;
    }

    let creditos;
    try {
      creditos = await consumeAICredit(prisma, userId);
    } catch (error) {
      if (error instanceof Error && error.message === 'SEM_CREDITOS_IA') {
        res.status(429).json({
          error: 'Seus creditos diarios de IA acabaram.',
          ia: formatAIStatus(await syncDailyAICredits(prisma, userId))
        });
        return;
      }

      throw error;
    }

    const resposta = await askLessonAssistant({
      aulaId,
      pergunta,
      titulo: aula.titulo,
      descricao: aula.descricao,
      modulo: aula.modulo?.titulo,
      transcricao: aula.transcricao,
      resumo: aula.resumo,
      pontosChave: parseJSONArray<string>(aula.pontosChave),
      versiculos: parseJSONArray<{ referencia: string; texto: string }>(aula.versiculos),
      glossario: parseJSONArray<{ termo: string; definicao: string }>(aula.glossario),
      materiais: aula.materiaisAula.map((item: { material: { titulo: string; descricao: string | null } }) => ({
        titulo: item.material.titulo,
        descricao: item.material.descricao
      }))
    });

    const registro = await prisma.interacaoIA.create({
      data: {
        alunoId: userId,
        aulaId,
        pergunta,
        resposta: JSON.stringify(resposta)
      }
    });

    res.json({
      ...resposta,
      ia: formatAIStatus(creditos),
      interacao: parseInteractionRecord(registro)
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao consultar o assistente da aula' });
  }
});

// PUT /api/aluno/senha
router.put('/senha', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha) {
      res.status(400).json({ error: 'Informe a senha atual e a nova senha' });
      return;
    }

    if (String(novaSenha).length < 6) {
      res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'Usuario nao encontrado' });
      return;
    }

    const senhaValida = await bcrypt.compare(String(senhaAtual), user.senhaHash);
    if (!senhaValida) {
      res.status(400).json({ error: 'Senha atual incorreta' });
      return;
    }

    const senhaHash = await bcrypt.hash(String(novaSenha), 10);
    await prisma.user.update({
      where: { id: userId },
      data: { senhaHash }
    });

    // Audit: senha alterada
    const realIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    await prisma.alertaSeguranca.create({
      data: {
        usuarioId: userId,
        tipo: 'senha_alterada',
        mensagem: `Senha alterada com sucesso. IP: ${realIp}`,
        ip: realIp,
      }
    }).catch(() => {});

    res.json({ ok: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao atualizar senha' });
  }
});

// PUT /api/aluno/notificacao/:id/lida
router.put('/notificacao/:id/lida', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notificacaoId = readString(req.params.id);
    if (!notificacaoId) {
      res.status(400).json({ error: 'Notificacao invalida' });
      return;
    }

    await prisma.notificacao.update({
      where: { id: notificacaoId },
      data: { lida: true }
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro' });
  }
});

// DELETE /api/aluno/conta — LGPD: direito ao esquecimento (anonimiza dados pessoais)
router.delete('/conta', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { senha } = req.body;

    if (!senha || typeof senha !== 'string') {
      res.status(400).json({ error: 'Confirme sua senha para excluir a conta.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'Usuario nao encontrado.' });
      return;
    }

    const senhaValida = await bcrypt.compare(senha, user.senhaHash);
    if (!senhaValida) {
      res.status(401).json({ error: 'Senha incorreta. A exclusao nao foi realizada.' });
      return;
    }

    // Anonimiza dados pessoais em vez de deletar para manter integridade referencial
    await prisma.user.update({
      where: { id: userId },
      data: {
        nome: '[Conta Excluida]',
        email: `excluido_${userId}@dadosexcluidos.ibvn`,
        senhaHash: 'EXCLUIDO',
        telefone: null,
        foto: null,
        ativo: false
      }
    });

    // Audit: deleção de conta (LGPD)
    logger.info('account deleted (LGPD anonymisation)', { userId });

    res.json({ ok: true, message: 'Conta excluida conforme a LGPD. Seus dados pessoais foram anonimizados.' });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir conta.' });
  }
});

export default router;
