import { apiFetch } from './apiClient';

export async function downloadAuthenticatedFile(path: string) {
  const response = await apiFetch(path);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Não foi possível baixar o arquivo.');
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const contentDisposition = response.headers.get('content-disposition') || '';
  const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  const fileName = fileNameMatch?.[1] || 'arquivo';

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = decodeURIComponent(fileName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}
