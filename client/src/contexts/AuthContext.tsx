import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';

import { configureApiClient } from '../lib/apiClient';
import { apiUrl } from '../lib/api';
import type { User } from '../types/models';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => void;
  isAdmin: boolean;
  isAluno: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    return null;
  }

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
      return null;
    }

    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data.accessToken;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return null;
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const loadUser = async () => {
      let token = localStorage.getItem('accessToken');
      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        let res = await fetch(apiUrl('/api/auth/me'), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });

        if (res.status === 401) {
          token = await refreshAccessToken();
          if (!token) {
            if (isMounted) setLoading(false);
            return;
          }

          res = await fetch(apiUrl('/api/auth/me'), {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
          });
        }

        if (!res.ok) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          if (isMounted) setLoading(false);
          return;
        }

        const data = await res.json();
        if (isMounted) {
          setUser(data);
          setToken(localStorage.getItem('accessToken'));
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadUser();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Erro ao fazer login' };
      }

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      setUser(data.user);
      setToken(data.accessToken);
      return { success: true, user: data.user };
    } catch {
      return { success: false, error: 'Erro de conexão com o servidor' };
    }
  }, []);

  const logout = useCallback(() => {
    void fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') })
    }).catch(() => undefined);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setToken(null);
  }, []);

  // Configure apiClient with token/logout callbacks so it can handle 401 transparently
  useEffect(() => {
    configureApiClient({
      onTokenRefreshed: (newToken) => setToken(newToken),
      onLogout: logout
    });
  }, [logout]);

  const contextValue = useMemo(() => ({
    user,
    token,
    loading,
    login,
    logout,
    isAdmin: user?.papel === 'admin' || user?.papel === 'pastor',
    isAluno: user?.papel === 'aluno' || user?.papel === 'admin' || user?.papel === 'pastor'
  }), [user, token, loading, login, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
