import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../auth.js';
import {
  generateTokens,
  verifyAccessToken,
  verifyAndRotateRefreshToken,
  invalidateRefreshToken,
  generateVideoToken,
  verifyVideoToken,
  authMiddleware,
  adminMiddleware,
} from '../auth.js';

// ── Fixture ───────────────────────────────────────────────────────

const basePayload = {
  userId: 'user-123',
  email: 'test@example.com',
  papel: 'aluno',
  nome: 'Aluno Teste',
};

// ── generateTokens + verifyAccessToken ───────────────────────────

describe('generateTokens + verifyAccessToken', () => {
  it('gera tokens sem lançar erro', () => {
    expect(() => generateTokens(basePayload)).not.toThrow();
  });

  it('access token contém o payload correto', () => {
    const { accessToken } = generateTokens(basePayload);
    const decoded = verifyAccessToken(accessToken);
    expect(decoded.userId).toBe(basePayload.userId);
    expect(decoded.email).toBe(basePayload.email);
    expect(decoded.papel).toBe(basePayload.papel);
  });

  it('verifyAccessToken lança erro para token inválido', () => {
    expect(() => verifyAccessToken('token.invalido.aqui')).toThrow();
  });
});

// ── verifyAndRotateRefreshToken ───────────────────────────────────

describe('verifyAndRotateRefreshToken', () => {
  it('rotação válida emite novos tokens e payload correto', () => {
    const { refreshToken } = generateTokens(basePayload);
    const { payload, newTokens } = verifyAndRotateRefreshToken(refreshToken);
    expect(payload.userId).toBe(basePayload.userId);
    expect(newTokens.accessToken).toBeTruthy();
    expect(newTokens.refreshToken).toBeTruthy();
  });

  it('rejeita o mesmo refresh token usado duas vezes (single-use)', () => {
    const { refreshToken } = generateTokens(basePayload);
    verifyAndRotateRefreshToken(refreshToken); // 1ª vez — ok
    expect(() => verifyAndRotateRefreshToken(refreshToken)).toThrow(
      'Refresh token invalido ou ja utilizado'
    );
  });

  it('lança erro para token completamente inválido', () => {
    expect(() => verifyAndRotateRefreshToken('token.invalido')).toThrow();
  });
});

// ── invalidateRefreshToken ────────────────────────────────────────

describe('invalidateRefreshToken', () => {
  it('após invalidação, rotação lança erro', () => {
    const { refreshToken } = generateTokens(basePayload);
    invalidateRefreshToken(refreshToken);
    expect(() => verifyAndRotateRefreshToken(refreshToken)).toThrow(
      'Refresh token invalido ou ja utilizado'
    );
  });

  it('não lança erro para token malformado', () => {
    expect(() => invalidateRefreshToken('nao-e-jwt')).not.toThrow();
  });
});

// ── generateVideoToken + verifyVideoToken ─────────────────────────

describe('generateVideoToken + verifyVideoToken', () => {
  it('gera e verifica video token com payload correto', () => {
    const token = generateVideoToken({ userId: 'u1', aulaId: 'a1' });
    const payload = verifyVideoToken(token);
    expect(payload.type).toBe('video');
    expect(payload.userId).toBe('u1');
    expect(payload.aulaId).toBe('a1');
  });

  it('rejeita access token normal como video token', () => {
    const { accessToken } = generateTokens(basePayload);
    expect(() => verifyVideoToken(accessToken)).toThrow('Tipo de token invalido');
  });

  it('rejeita token inválido', () => {
    expect(() => verifyVideoToken('invalido')).toThrow();
  });
});

// ── authMiddleware ────────────────────────────────────────────────

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

describe('authMiddleware', () => {
  it('retorna 401 quando sem header Authorization', () => {
    const req = { headers: {} } as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    authMiddleware(req, res, next);
    expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 401 para token inválido', () => {
    const req = { headers: { authorization: 'Bearer token.invalido' } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    authMiddleware(req, res, next);
    expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(401);
  });

  it('chama next() e popula req.user com token válido', () => {
    const { accessToken } = generateTokens(basePayload);
    const req = { headers: { authorization: `Bearer ${accessToken}` } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.userId).toBe(basePayload.userId);
  });
});

// ── adminMiddleware ───────────────────────────────────────────────

describe('adminMiddleware', () => {
  beforeEach(() => {});

  it('retorna 403 quando req.user ausente', () => {
    const req = {} as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    adminMiddleware(req, res, next);
    expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(403);
  });

  it('retorna 403 para papel "aluno"', () => {
    const req = { user: { ...basePayload, papel: 'aluno' } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    adminMiddleware(req, res, next);
    expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(403);
  });

  it('chama next() para papel "admin"', () => {
    const req = { user: { ...basePayload, papel: 'admin' } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    adminMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('chama next() para papel "pastor"', () => {
    const req = { user: { ...basePayload, papel: 'pastor' } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    adminMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
