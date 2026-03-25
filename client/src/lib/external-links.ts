const DEFAULT_VINHA_NOVA_URL = 'https://zyonxagency.com';
const DEFAULT_SEMINARIO_URL = 'https://seminariovn.zyonxagency.com';

function normalizeUrl(value: string | undefined, fallback: string) {
  if (!value || !value.trim()) return fallback;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const VINHA_NOVA_HOME_URL = normalizeUrl(import.meta.env.VITE_VINHA_NOVA_HOME_URL, DEFAULT_VINHA_NOVA_URL);
export const SEMINARIO_HOME_URL = normalizeUrl(import.meta.env.VITE_SEMINARIO_HOME_URL, DEFAULT_SEMINARIO_URL);
