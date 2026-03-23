import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureApiClient, apiFetch, apiGet, apiPost, apiPut, apiDelete } from '../apiClient';

// ── Setup ─────────────────────────────────────────────────────────

const ACCESS_TOKEN = 'access-token-abc';
const REFRESH_TOKEN = 'refresh-token-xyz';
const NEW_ACCESS = 'new-access-token';
const NEW_REFRESH = 'new-refresh-token';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response as Response);
}

// ── apiFetch ──────────────────────────────────────────────────────

describe('apiFetch', () => {
  it('injeta Authorization quando há accessToken no localStorage', async () => {
    localStorage.setItem('accessToken', ACCESS_TOKEN);
    const spy = mockFetch({ ok: true, status: 200, json: async () => ({}) });

    await apiFetch('/api/test');

    const [, init] = spy.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it('não injeta Authorization quando não há token', async () => {
    const spy = mockFetch({ ok: true, status: 200, json: async () => ({}) });

    await apiFetch('/api/public');

    const [, init] = spy.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBeNull();
  });

  it('retenta a requisição após refresh bem-sucedido em 401', async () => {
    localStorage.setItem('accessToken', 'expired-token');
    localStorage.setItem('refreshToken', REFRESH_TOKEN);

    const onTokenRefreshed = vi.fn();
    const onLogout = vi.fn();
    configureApiClient({ onTokenRefreshed, onLogout });

    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ accessToken: NEW_ACCESS, refreshToken: NEW_REFRESH }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) } as Response);

    const response = await apiFetch('/api/protected');

    expect(spy).toHaveBeenCalledTimes(3); // original + refresh + retry
    expect(response.status).toBe(200);
    expect(onTokenRefreshed).toHaveBeenCalledWith(NEW_ACCESS);
  });

  it('chama onLogout quando refresh falha em 401', async () => {
    localStorage.setItem('accessToken', 'expired-token');
    localStorage.setItem('refreshToken', REFRESH_TOKEN);

    const onLogout = vi.fn();
    configureApiClient({ onTokenRefreshed: vi.fn(), onLogout });

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response);

    await apiFetch('/api/protected');

    expect(onLogout).toHaveBeenCalled();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});

// ── apiGet ────────────────────────────────────────────────────────

describe('apiGet', () => {
  it('retorna dados parseados em sucesso', async () => {
    const data = { nome: 'Aluno', email: 'a@b.com' };
    mockFetch({ ok: true, status: 200, json: async () => data });

    const result = await apiGet<typeof data>('/api/aluno/perfil');
    expect(result).toEqual(data);
  });

  it('lança Error com mensagem do servidor em falha', async () => {
    mockFetch({ ok: false, status: 404, json: async () => ({ error: 'Recurso não encontrado' }) });

    await expect(apiGet('/api/nao-existe')).rejects.toThrow('Recurso não encontrado');
  });

  it('lança Error genérico quando resposta não tem campo error', async () => {
    mockFetch({ ok: false, status: 500, json: async () => ({}) });

    await expect(apiGet('/api/erro')).rejects.toThrow('HTTP 500');
  });
});

// ── apiPost ───────────────────────────────────────────────────────

describe('apiPost', () => {
  it('envia método POST com body JSON', async () => {
    const spy = mockFetch({ ok: true, status: 200, json: async () => ({ id: '1' }) });
    const payload = { titulo: 'Nova Aula' };

    await apiPost('/api/admin/aula', payload);

    const [, init] = spy.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(payload);
  });

  it('lança Error em resposta não-ok', async () => {
    mockFetch({ ok: false, status: 400, json: async () => ({ error: 'Título obrigatório' }) });

    await expect(apiPost('/api/admin/aula', {})).rejects.toThrow('Título obrigatório');
  });

  it('funciona sem body (undefined)', async () => {
    const spy = mockFetch({ ok: true, status: 200, json: async () => ({}) });

    await apiPost('/api/aluno/aula/123/concluir');

    const [, init] = spy.mock.calls[0];
    expect(init?.body).toBeUndefined();
  });
});

// ── apiPut ────────────────────────────────────────────────────────

describe('apiPut', () => {
  it('envia método PUT com body JSON', async () => {
    const spy = mockFetch({ ok: true, status: 200, json: async () => ({}) });
    const payload = { conteudo: 'Minha anotação' };

    await apiPut('/api/aluno/anotacao', payload);

    const [, init] = spy.mock.calls[0];
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual(payload);
  });
});

// ── apiDelete ─────────────────────────────────────────────────────

describe('apiDelete', () => {
  it('envia método DELETE', async () => {
    const spy = mockFetch({ ok: true, status: 200, json: async () => ({}) });

    await apiDelete('/api/admin/material/123');

    const [, init] = spy.mock.calls[0];
    expect(init?.method).toBe('DELETE');
  });
});
