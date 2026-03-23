import { useState, useCallback, useRef } from 'react';
import { apiGet } from '../lib/apiClient';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string;
}

interface UseApiResult<T> extends UseApiState<T> {
  fetch: (path: string) => Promise<T | null>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
  reset: () => void;
}

export function useApi<T = unknown>(): UseApiResult<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: ''
  });
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (path: string): Promise<T | null> => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const data = await apiGet<T>(path);
      setState({ data, loading: false, error: '' });
      return data;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return null;
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setState(prev => ({ ...prev, loading: false, error: message }));
      return null;
    }
  }, []);

  const setData = useCallback((updater: React.SetStateAction<T | null>) => {
    setState(prev => ({
      ...prev,
      data: typeof updater === 'function' ? (updater as (prev: T | null) => T | null)(prev.data) : updater
    }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ data: null, loading: false, error: '' });
  }, []);

  return {
    ...state,
    fetch: fetchData,
    setData,
    reset
  };
}
