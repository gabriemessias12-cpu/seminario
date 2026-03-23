import { apiUrl } from './api';

type TokenRefreshCallback = (newToken: string) => void;
type LogoutCallback = () => void;

let onTokenRefreshed: TokenRefreshCallback | null = null;
let onLogout: LogoutCallback | null = null;

export function configureApiClient(callbacks: {
  onTokenRefreshed: TokenRefreshCallback;
  onLogout: LogoutCallback;
}) {
  onTokenRefreshed = callbacks.onTokenRefreshed;
  onLogout = callbacks.onLogout;
}

async function attemptRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const res = await fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      onLogout?.();
      return null;
    }

    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    onTokenRefreshed?.(data.accessToken);
    return data.accessToken;
  } catch {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    onLogout?.();
    return null;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('accessToken');

  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  const signal = init.signal ?? controller.signal;

  let res: Response;
  try {
    res = await fetch(apiUrl(path), { ...init, headers, signal });
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    const newToken = await attemptRefresh();
    if (!newToken) return res;

    const retryHeaders = new Headers(init.headers);
    retryHeaders.set('Authorization', `Bearer ${newToken}`);
    if (!retryHeaders.has('Content-Type') && init.body && typeof init.body === 'string') {
      retryHeaders.set('Content-Type', 'application/json');
    }

    const retryController = new AbortController();
    const retryTimeoutId = setTimeout(() => retryController.abort(), 20000);
    try {
      return await fetch(apiUrl(path), { ...init, headers: retryHeaders, signal: retryController.signal });
    } finally {
      clearTimeout(retryTimeoutId);
    }
  }

  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, data?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: 'POST',
    body: data !== undefined ? JSON.stringify(data) : undefined
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, data?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: 'PUT',
    body: data !== undefined ? JSON.stringify(data) : undefined
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiDelete<T>(path: string, data?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: 'DELETE',
    body: data !== undefined ? JSON.stringify(data) : undefined
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
