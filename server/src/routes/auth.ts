import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateTokens, verifyRefreshToken, authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

function parseUserAgent(ua: string): string {
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  let browser = 'Navegador desconhecido';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  let os = 'SO desconhecido';
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  return `${browser} · ${os}${mobile ? ' · Mobile' : ''}`;
}

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

    // Extract real IP (behind Railway/nginx proxy)
    const realIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    const dispositivo = parseUserAgent(ua);

    // Log login
    await prisma.loginHistorico.create({
      data: {
        usuarioId: user.id,
        ip: realIp,
        dispositivo,
        sucesso: true
      }
    });

    // Detect new IP — if this user has logins and never used this IP before, create security alert
    const previousLogins = await prisma.loginHistorico.findMany({
      where: { usuarioId: user.id, sucesso: true, ip: { not: realIp } },
      take: 1
    });
    const usedThisIpBefore = await prisma.loginHistorico.findFirst({
      where: { usuarioId: user.id, ip: realIp, id: { not: undefined } },
      orderBy: { dataHora: 'desc' },
      skip: 1 // skip the record we just created
    });
    if (previousLogins.length > 0 && !usedThisIpBefore) {
      await prisma.alertaSeguranca.create({
        data: {
          usuarioId: user.id,
          tipo: 'novo_ip',
          mensagem: `Acesso de IP novo detectado para ${user.nome} (${user.email}). IP: ${realIp} · Dispositivo: ${dispositivo}`,
          ip: realIp,
          dispositivo
        }
      });
    }

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
