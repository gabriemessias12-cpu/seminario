import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { buildBulletinByModule, buildDeliverySummary, buildModuleFrequencyReport } from '../services/academic-report.js';
import { processAIPipeline, processIAFromTranscript } from '../services/ai-mock.js';
import { logContentChange } from '../services/content-change-log.js';
import { parseObjectiveQuestions, serializeObjectiveQuestions } from '../utils/objective-assessment.js';
import { sendStoredUpload } from '../utils/stored-file.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, rm, stat, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { extractYouTubeVideoId, getLessonVideoKind, normalizeLessonVideoUrl } from '../utils/video-source.js';

const execAsync = promisify(exec);

// Fetch YouTube auto-generated transcript via InnerTube API (no yt-dlp, no Whisper)
// Returns plain text or null if unavailable
async function fetchYoutubeTranscript(videoId: string, preferLang = 'pt'): Promise<string | null> {
  try {
    const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
      },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
        videoId
      })
    });
    if (!playerRes.ok) return null;
    const data = await playerRes.json() as any;
    const tracks: any[] = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) return null;
    const track = tracks.find((t) => t.languageCode === preferLang) ?? tracks[0];
    const xmlRes = await fetch(track.baseUrl as string);
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
  try {
    const { stdout } = await execAsync(
      `yt-dlp --print duration --no-playlist -q --extractor-args "youtube:player_client=ios,mweb" "https://www.youtube.com/watch?v=${videoId}"`,
      { timeout: 30000 }
    );
    const secs = Number(stdout.trim());
    return Number.isFinite(secs) && secs > 0 ? Math.round(secs) : 0;
  } catch {
    return 0;
  }
}

// Auto-detect local file duration using ffprobe (returns seconds, 0 on failure)
async function getFileDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { timeout: 15000 }
    );
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
    const slot = String(req.params?.slot ?? '1').replace(/[^0-9]/g, '');
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
    const totalAlunos = await prisma.user.count({ where: { papel: 'aluno' } });
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const alunosAtivos = await prisma.user.count({
      where: { papel: 'aluno', ultimoAcesso: { gte: seteDiasAtras } }
    });
    const aulasPublicadas = await prisma.aula.count({ where: { publicado: true } });

    const progressos = await prisma.progressoAluno.findMany();
    const taxaConclusao = progressos.length > 0
      ? Math.round(progressos.filter((p: { concluido: boolean }) => p.concluido).length / progressos.length * 100)
      : 0;

    // Students needing attention (< 20% progress)
    const alunos = await prisma.user.findMany({
      where: { papel: 'aluno' },
      include: { progressos: true }
    });

    const alunosAtencao = alunos
      .map((a: {
        id: string;
        nome: string;
        email: string;
        foto: string | null;
        progressos: Array<{ percentualAssistido: number }>;
      }) => {
        const avg = a.progressos.length > 0
          ? a.progressos.reduce((s: number, p: { percentualAssistido: number }) => s + p.percentualAssistido, 0) / a.progressos.length
          : 0;
        return { id: a.id, nome: a.nome, email: a.email, foto: a.foto, progressoMedio: Math.round(avg) };
      })
      .filter((a: { progressoMedio: number }) => a.progressoMedio < 20)
      .slice(0, 10);

    // Recent activity
    const atividadeRecente = await prisma.loginHistorico.findMany({
      include: { usuario: { select: { nome: true, email: true } } },
      orderBy: { dataHora: 'desc' },
      take: 10
    });

    // Per-lesson stats
    const aulas = await prisma.aula.findMany({
      where: { publicado: true },
      include: { progressos: true },
      orderBy: { criadoEm: 'asc' }
    });

    const aulasStats = aulas.map((a: {
      id: string;
      titulo: string;
      progressos: Array<{ percentualAssistido: number }>;
    }) => ({
      id: a.id,
      titulo: a.titulo,
      totalAlunos: a.progressos.length,
      mediaConclusao: a.progressos.length > 0
        ? Math.round(a.progressos.reduce((s: number, p: { percentualAssistido: number }) => s + p.percentualAssistido, 0) / a.progressos.length)
        : 0
    }));

    res.json({
      totalAlunos,
      alunosAtivos,
      aulasPublicadas,
      taxaConclusao,
      alunosAtencao,
      atividadeRecente,
      aulasStats
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar dashboard admin' });
  }
});

// GET /api/admin/alunos
router.get('/alunos', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alunos = await prisma.user.findMany({
      where: { papel: 'aluno' },
      include: { progressos: true },
      orderBy: { criadoEm: 'desc' }
    });

    const result = alunos.map((a: {
      id: string;
      nome: string;
      email: string;
      foto: string | null;
      telefone: string | null;
      ativo: boolean;
      criadoEm: Date;
      ultimoAcesso: Date | null;
      progressos: Array<{ concluido: boolean; percentualAssistido: number }>;
    }) => {
      const totalAulas = a.progressos.length;
      const conc = a.progressos.filter((p: { concluido: boolean }) => p.concluido).length;
      const avg = totalAulas > 0
        ? Math.round(a.progressos.reduce((s: number, p: { percentualAssistido: number }) => s + p.percentualAssistido, 0) / totalAulas)
        : 0;
      return {
        id: a.id,
        nome: a.nome,
        email: a.email,
        foto: a.foto,
        telefone: a.telefone,
        ativo: a.ativo,
        criadoEm: a.criadoEm,
        ultimoAcesso: a.ultimoAcesso,
        progressoGeral: avg,
        aulasConcluidas: conc,
        totalAulasAcessadas: totalAulas
      };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
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

    const aluno = await prisma.user.findUnique({
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
    });

    if (!aluno) {
      res.status(404).json({ error: 'Aluno não encontrado' });
      return;
    }

    const modulos = await prisma.modulo.findMany({
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
    });

    res.json({
      ...aluno,
      relatorioAcademico: {
        frequenciaPorModulo: buildModuleFrequencyReport(modulos),
        entregasResumo: buildDeliverySummary(aluno.entregasAvaliacao),
        boletimPorModulo: buildBulletinByModule(aluno.entregasAvaliacao)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar aluno' });
  }
});

// POST /api/admin/aluno - create student
router.post('/aluno', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { nome, email, senha, telefone } = req.body;
    if (!nome || !email) {
      res.status(400).json({ error: 'Nome e email sao obrigatorios' });
      return;
    }

    const emailNormalizado = String(email).trim().toLowerCase();
    const existente = await prisma.user.findUnique({ where: { email: emailNormalizado } });
    if (existente) {
      res.status(409).json({ error: 'Ja existe um usuario com esse email' });
      return;
    }

    const senhaLimpa = String(senha || '123456');
    const senhaHash = await bcrypt.hash(senhaLimpa, 10);

    const aluno = await prisma.user.create({
      data: {
        nome: String(nome).trim(),
        email: emailNormalizado,
        senhaHash,
        telefone: telefone ? String(telefone).trim() : null,
        papel: 'aluno'
      }
    });

    res.json({
      ...aluno,
      senhaTemporaria: senhaLimpa
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar aluno' });
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
    console.error(error);
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
    console.error(error);
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

      console.log(`AI pipeline completed for lesson: ${titulo}`);
    }).catch(async (err) => {
      console.error('AI pipeline error:', err);
      await prisma.aula.update({
        where: { id: aula.id },
        data: { statusIA: 'erro' }
      });
    });

    res.json(aula);
  } catch (error) {
    console.error(error);
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
    const modulo = await prisma.modulo.create({
      data: {
        titulo,
        descricao,
        capaUrl,
        ordem: parseInt(ordem || '0')
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
      },
    });

    res.json(modulo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar modulo' });
  }
});

// PUT /api/admin/modulo/:id
router.put('/modulo/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const moduloId = readString(req.params.id);
    const { titulo, descricao, capaUrl, ordem } = req.body;
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
        ordem: ordem ? parseInt(ordem) : undefined
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
        },
      },
    });

    res.json(modulo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar modulo' });
  }
});

// PUT /api/admin/modulo/:id/capa — upload cover image
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar historico de conteudo' });
  }
});

// POST /api/admin/material
router.post('/material', uploadMaterial.single('arquivo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { titulo, descricao, categoria, permiteDownload, aulasRelacionadas } = req.body;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Arquivo obrigatório' });
      return;
    }

    const material = await prisma.material.create({
      data: {
        titulo,
        descricao,
        urlArquivo: `/uploads/materials/${file.filename}`,
        tipo: path.extname(file.originalname).slice(1),
        categoria: categoria || 'geral',
        permiteDownload: permiteDownload === 'true'
      }
    });

    // Link to lessons if provided
    if (aulasRelacionadas) {
      const aulaIds = JSON.parse(Array.isArray(aulasRelacionadas) ? aulasRelacionadas[0] : aulasRelacionadas);
      for (const aulaId of aulaIds) {
        await prisma.materialAula.create({
          data: { materialId: material.id, aulaId }
        });
      }
    }

    res.json(material);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao fazer upload de material' });
  }
});

// GET /api/admin/materiais
router.get('/materiais', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const materiais = await prisma.material.findMany({
      include: { materiaisAula: { include: { aula: { select: { titulo: true } } } } },
      orderBy: { criadoEm: 'desc' }
    });
    res.json(materiais);
  } catch {
    res.status(500).json({ error: 'Erro' });
  }
});

// GET /api/admin/avaliacoes
router.get('/avaliacoes', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const avaliacoes = await prisma.avaliacao.findMany({
      include: {
        modulo: { select: { id: true, titulo: true } },
        aula: { select: { id: true, titulo: true } },
        entregas: {
          select: {
            id: true,
            status: true,
            nota: true
          }
        }
      },
      orderBy: [
        { dataLimite: 'asc' },
        { criadoEm: 'desc' }
      ]
    });

    res.json(avaliacoes.map((avaliacao) => ({
      ...avaliacao,
      quantidadeQuestoes: parseObjectiveQuestions(avaliacao.questoesObjetivas).length,
      resumoEntregas: buildDeliverySummary(avaliacao.entregas)
    })));
  } catch (error) {
    console.error(error);
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

    const avaliacao = await prisma.avaliacao.create({
      data: {
        titulo,
        descricao,
        tipo,
        formato,
        moduloId,
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
    console.error(error);
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

    const avaliacao = await prisma.avaliacao.update({
      where: { id: avaliacaoId },
      data: {
        titulo,
        descricao,
        tipo,
        formato,
        moduloId,
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
    console.error(error);
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
    console.error(error);
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
        aula: { select: { id: true, titulo: true } },
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

    res.json({
      ...avaliacao,
      questoesObjetivas: parseObjectiveQuestions(avaliacao.questoesObjetivas),
      quantidadeQuestoes: parseObjectiveQuestions(avaliacao.questoesObjetivas).length,
      resumoEntregas: buildDeliverySummary(avaliacao.entregas)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar avaliacao' });
  }
});

// PUT /api/admin/entrega-avaliacao/:id/correcao
router.put('/entrega-avaliacao/:id/correcao', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entregaId = readString(req.params.id);
    const comentarioCorrecao = readString(req.body.comentarioCorrecao);
    const status = readString(req.body.status) || 'corrigido';
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

    res.json(entrega);
  } catch (error) {
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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

    for (const item of presencas) {
      await prisma.presenca.upsert({
        where: { alunoId_aulaId: { alunoId: item.alunoId, aulaId: aulaId } },
        update: {
          status: item.status,
          metodo: item.metodo,
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
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
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
    console.error(error);
    res.status(500).json({ error: 'Erro ao enviar notificacao' });
  }
});

// GET /api/admin/relatorios
router.get('/relatorios', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Engagement report
    const aulas = await prisma.aula.findMany({
      where: { publicado: true },
      include: { progressos: true, resultadosQuiz: true },
      orderBy: { criadoEm: 'asc' }
    });

    const engajamento = aulas.map((a: {
      id: string;
      titulo: string;
      progressos: Array<{ percentualAssistido: number }>;
      resultadosQuiz: Array<{ pontuacao: number; totalQuestoes: number }>;
    }) => ({
      id: a.id,
      titulo: a.titulo,
      totalVisualizacoes: a.progressos.length,
      mediaConclusao: a.progressos.length > 0
        ? Math.round(a.progressos.reduce((s: number, p: { percentualAssistido: number }) => s + p.percentualAssistido, 0) / a.progressos.length)
        : 0,
      mediaQuiz: a.resultadosQuiz.length > 0
        ? Math.round(a.resultadosQuiz.reduce((s: number, r: { pontuacao: number; totalQuestoes: number }) => s + (r.pontuacao / r.totalQuestoes * 100), 0) / a.resultadosQuiz.length)
        : 0,
      totalQuizzes: a.resultadosQuiz.length
    }));

    // Access report
    const logins = await prisma.loginHistorico.findMany({
      orderBy: { dataHora: 'desc' },
      take: 100,
      include: { usuario: { select: { nome: true, email: true } } }
    });

    const alunos = await prisma.user.findMany({
      where: { papel: 'aluno' },
      include: {
        entregasAvaliacao: {
          select: {
            status: true,
            nota: true
          }
        },
        progressos: {
          select: {
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
    });

    const avaliacoes = await prisma.avaliacao.findMany({
      where: { publicado: true },
      include: {
        modulo: { select: { titulo: true } },
        aula: { select: { titulo: true } },
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
    });

    const academicByStudent = alunos.map((aluno) => {
      const totalPresencas = aluno.presencas.length;
      const attendanceScore = aluno.presencas.reduce((sum, presenca) => {
        if (presenca.status === 'presente') return sum + 1;
        if (presenca.status === 'parcial') return sum + 0.5;
        return sum;
      }, 0);

      return {
        alunoId: aluno.id,
        nome: aluno.nome,
        email: aluno.email,
        aulasConcluidas: aluno.progressos.filter((item) => item.concluido).length,
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

// Transcribe audio using local faster-whisper (preferred — $0, no limits)
async function transcribeLocal(audioFile: string): Promise<string> {
  const scriptPath = path.join(process.cwd(), 'whisper_transcribe.py');
  const { stdout } = await execAsync(
    `python3 "${scriptPath}" "${audioFile}"`,
    { timeout: 10800000, maxBuffer: 10 * 1024 * 1024 } // 3h timeout, 10MB buffer
  );
  return stdout.trim();
}

// Splits audio file into 20-min chunks for API fallback (Groq 25MB limit)
async function splitAudioIntoChunks(audioFile: string, tempDir: string, chunkSecs = 1200): Promise<string[]> {
  const { stdout } = await execAsync(
    `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioFile}"`
  );
  const totalSecs = parseFloat(stdout.trim());
  if (!totalSecs || Number.isNaN(totalSecs)) throw new Error('Nao foi possivel determinar a duracao do audio.');

  const numChunks = Math.ceil(totalSecs / chunkSecs);
  const chunks: string[] = [];

  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSecs;
    const chunkFile = path.join(tempDir, `chunk-${String(i).padStart(3, '0')}.mp3`);
    await execAsync(
      `ffmpeg -y -i "${audioFile}" -ss ${start} -t ${chunkSecs} -ar 16000 -ac 1 -b:a 32k -f mp3 "${chunkFile}"`,
      { timeout: 120000 }
    );
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

// POST /api/admin/aula/:id/processar-ia — save transcript and generate IA content via OpenAI
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
    console.error('Processar IA error:', error);
    res.status(500).json({ error: 'Erro ao processar IA.' });
  }
});

// POST /api/admin/aula/:id/gerar-transcricao — local Whisper (free) with API fallback
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
      await execAsync(
        `yt-dlp -x --audio-format mp3 --audio-quality 0 --no-playlist --extractor-args "youtube:player_client=ios,mweb" -P "${tempDir}" -o "audio.%(ext)s" "https://www.youtube.com/watch?v=${videoId}"`,
        { timeout: 600000 }
      );

      const processedAudio = path.join(tempDir, 'audio.wav');
      await execAsync(
        `ffmpeg -y -i "${rawAudio}" -ar 16000 -ac 1 "${processedAudio}"`,
        { timeout: 300000 }
      );

      let transcricao = '';
      let provider = 'Whisper local';

      try {
        transcricao = await transcribeLocal(processedAudio);
      } catch (localError) {
        console.warn('Local whisper unavailable, falling back to API:', localError instanceof Error ? localError.message : localError);

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
    console.error('Transcricao error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Whisper HTTP')) {
      res.status(502).json({ error: `Erro na API de transcricao. Detalhe: ${msg}` });
    } else {
      res.status(500).json({ error: msg || 'Erro ao gerar transcricao.' });
    }
  }
});

// GET /api/admin/brand/lideranca — returns current leadership slides config
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

// PUT /api/admin/brand/lideranca/:slot — upload photo and/or update name
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
