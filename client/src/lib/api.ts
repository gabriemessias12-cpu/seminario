const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = configuredApiUrl || '';

export function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (!path.startsWith('/')) {
    return API_BASE_URL ? `${API_BASE_URL}/${path}` : `/${path}`;
  }

  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export function installApiFetchInterceptor() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return;
  }

  const currentFetch = window.fetch as typeof window.fetch & { __seminarioPatched?: boolean };
  if (currentFetch.__seminarioPatched) {
    return;
  }

  const nativeFetch = window.fetch.bind(window);
  const patchedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      return nativeFetch(apiUrl(input), init);
    }

    if (input instanceof URL) {
      return nativeFetch(input, init);
    }

    return nativeFetch(input, init);
  }) as typeof window.fetch & { __seminarioPatched?: boolean };

  patchedFetch.__seminarioPatched = true;
  window.fetch = patchedFetch;
}
