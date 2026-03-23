export function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const signal = options.signal ? controller.signal : controller.signal;
  return fetch(url, { ...options, signal }).finally(() => clearTimeout(timeoutId));
}
