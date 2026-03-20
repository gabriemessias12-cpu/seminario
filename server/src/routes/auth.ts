import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateTokens, verifyRefreshToken, authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      res.status(400).json({ error: 'Email e senha são obrigatórios' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.ativo) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    const senhaValida = await bcrypt.compare(senha, user.senhaHash);
    if (!senhaValida) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    // Update last access
    await prisma.user.update({
      where: { id: user.id },
      data: { ultimoAcesso: new Date() }
    });

    // Log login
    await prisma.loginHistorico.create({
      data: {
        usuarioId: user.id,
        ip: req.ip || 'unknown',
        dispositivo: req.headers['user-agent'] || 'unknown',
        sucesso: true
      }
    });

    const payload = { userId: user.id, email: user.email, papel: user.papel, nome: user.nome };
    const tokens = generateTokens(payload);

    res.json({
      ...tokens,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        papel: user.papel,
        foto: user.foto
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token obrigatório' });
      return;
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.ativo) {
      res.status(401).json({ error: 'Usuário inválido' });
      return;
    }

    const newPayload = { userId: user.id, email: user.email, papel: user.papel, nome: user.nome };
    const tokens = generateTokens(newPayload);

    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Refresh token inválido' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (_req: Request, res: Response): Promise<void> => {
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, nome: true, email: true, papel: true, foto: true, telefone: true, criadoEm: true }
    });
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
