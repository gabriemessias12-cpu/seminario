import fs from 'fs';
import path from 'path';

let loaded = false;

function parseEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, '$1');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadEnvFiles() {
  if (loaded) {
    return;
  }

  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), 'server/.env'),
    path.resolve(process.cwd(), 'server/.env.local'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(process.cwd(), '../.env.local')
  ];

  for (const filePath of candidates) {
    parseEnvFile(filePath);
  }

  loaded = true;
}
