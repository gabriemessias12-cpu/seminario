import fs from 'fs';
import path from 'path';
import { Response } from 'express';

export function sendStoredUpload(res: Response, storedUrl: string, directory: string) {
  const fileName = path.basename(storedUrl);
  const filePath = path.resolve(directory, fileName);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Arquivo não encontrado' });
    return;
  }

  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.download(filePath, fileName);
}
