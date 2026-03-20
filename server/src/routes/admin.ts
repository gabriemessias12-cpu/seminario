import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { processAIPipeline } from '../services/ai-mock.js';

const router = Router();
const prisma = new PrismaClient();

function readString(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

// Multer setup for video uploads
const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.resolve('uploads/videos')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const uploadVideo = multer({ storage: videoStorage, limits: { fileSize: 500 * 1024 * 1024 } });

const materialStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.resolve('uploads/materials')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const uploadMaterial = multer({ storage: materialStorage, limits: { fileSize: 100 * 1024 * 1024 } });

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

    res.json(aluno);
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
    res.json(aula);
  } catch {
    res.status(500).json({ error: 'Erro' });
  }
});

// POST /api/admin/aula - create lesson with video upload
router.post('/aula', uploadVideo.single('video'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { titulo, descricao, moduloId, publicado, dataPublicacao } = req.body;
    const videoFile = req.file;
    const modulo = await prisma.modulo.findUnique({
      where: { id: String(moduloId) },
      select: { titulo: true }
    });

    const aula = await prisma.aula.create({
      data: {
        titulo,
        descricao,
        moduloId,
        urlVideo: videoFile ? `/uploads/videos/${videoFile.filename}` : null,
        publicado: publicado === 'true',
        dataPublicacao: dataPublicacao ? new Date(dataPublicacao) : (publicado === 'true' ? new Date() : null),
        duracaoSegundos: 1800, // Default 30min for mock
        statusIA: 'processando'
      }
    });

    // Fire AI pipeline asynchronously
    processAIPipeline(aula.id, titulo, descricao, { modulo: modulo?.titulo }).then(async (aiResult) => {
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
router.put('/aula/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const aulaId = readString(req.params.id);
    if (!aulaId) {
      res.status(400).json({ error: 'Aula invalida' });
      return;
    }

    const { titulo, descricao, moduloId, publicado, dataPublicacao } = req.body;

    const aula = await prisma.aula.update({
      where: { id: aulaId },
      data: {
        titulo,
        descricao,
        moduloId,
        publicado,
        dataPublicacao: dataPublicacao ? new Date(dataPublicacao) : undefined
      }
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

    await prisma.aula.delete({ where: { id: aulaId } });
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

    const modulo = await prisma.modulo.update({
      where: { id: moduloId },
      data: {
        titulo,
        descricao,
        capaUrl,
        ordem: ordem ? parseInt(ordem) : undefined
      }
    });
    res.json(modulo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar modulo' });
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

    await prisma.modulo.delete({ where: { id: moduloId } });
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

    res.json({ engajamento, logins });
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

export default router;
