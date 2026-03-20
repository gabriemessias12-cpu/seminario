# Seminario Vinha Nova

Projeto em monorepo com:

- `client/`: frontend React + Vite
- `server/`: backend Node + Express + Prisma SQLite

## Easypanel

Crie dois App Services apontando para este mesmo repositório:

### 1. Backend

- Source repo: este repositório
- Root directory: `server`
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Port: `3001`
- Domain: `api.seu-dominio.com`

Environment variables:

```env
PORT=3001
CORS_ORIGIN=https://seminario.seu-dominio.com
JWT_SECRET=uma-chave-forte
JWT_REFRESH_SECRET=outra-chave-forte
OPENAI_API_KEY=
```

Volumes recomendados:

- monte persistência para `server/prisma`
- monte persistência para `uploads`

### 2. Frontend

- Source repo: este repositório
- Root directory: `client`
- Build command: `npm install && npm run build`
- Start command: `npm run preview -- --host 0.0.0.0 --port 4173`
- Port: `4173`
- Domain: `seminario.seu-dominio.com`

Environment variables:

```env
VITE_API_URL=https://api.seu-dominio.com
```

## Observação

O frontend em produção deve consumir a API pelo domínio do backend, e o backend deve liberar esse domínio no CORS.
