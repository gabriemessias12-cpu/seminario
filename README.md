# Seminário Vinha Nova — Plataforma de Ensino

Sistema de gestão de ensino (LMS) para o **Instituto Bíblico Vinha Nova (IBVN)**.
Permite que alunos assistam aulas, façam avaliações e interajam com um assistente de IA baseado no conteúdo das aulas.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Node.js 20, Express 4, TypeScript |
| ORM | Prisma 6 (PostgreSQL) |
| Auth | JWT (access 2h + refresh 7d) com rotação automática |
| IA | OpenAI GPT-4o-mini + Whisper (transcrição local) + yt-dlp |
| Uploads | Multer — avatares, vídeos, materiais, entregas |
| CI/CD | GitHub Actions → GHCR (Docker) |

---

## Pré-requisitos

- Node.js ≥ 20
- Docker & Docker Compose
- (opcional) Python 3 + pip — para transcrição local com Whisper

---

## Desenvolvimento local

### 1. Clonar e instalar dependências

```bash
git clone <repo>
cd seminario

# Instalar dependências de ambos os workspaces
npm install --workspace client
npm install --workspace server
```

### 2. Subir o banco de dados

```bash
docker-compose up -d postgres
# PostgreSQL disponível em localhost:5432
# User: seminario | Password: seminario_dev | DB: seminario
```

### 3. Configurar variáveis de ambiente do servidor

```bash
cp server/.env.example server/.env
# Edite server/.env — ajuste DATABASE_URL para localhost
```

O `.env` mínimo para desenvolvimento:

```env
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug
JWT_SECRET=qualquer-string-longa-aqui-para-dev
JWT_REFRESH_SECRET=outra-string-longa-para-dev
DATABASE_URL="postgresql://seminario:seminario_dev@localhost:5432/seminario"
DIRECT_URL="postgresql://seminario:seminario_dev@localhost:5432/seminario"
```

### 4. Aplicar o schema e popular o banco

```bash
npm run db:push          # Cria as tabelas (equivale a prisma db push)
npm run seed             # Cria as contas de admin padrão
```

### 5. Iniciar em modo desenvolvimento

Em dois terminais separados:

```bash
npm run dev:server       # API em http://localhost:3001
npm run dev:client       # Frontend em http://localhost:5173
```

O client tem proxy configurado: `/api/*` e `/uploads/*` são roteados para `:3001`.

---

## Comandos úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev:server` | Inicia API em modo watch (tsx) |
| `npm run dev:client` | Inicia frontend com HMR |
| `npm run build` | Build de produção (client + server) |
| `npm run build:client` | Build apenas do frontend |
| `npm run build:server` | Build apenas do backend |
| `npm run db:push` | Sincroniza schema Prisma com o banco |
| `npm run seed` | Popula contas do sistema |
| `npm run typecheck` | Typecheck TypeScript de ambos os workspaces |
| `npm run test` | Roda todos os testes (vitest) |
| `npm run test:coverage` | Testes com relatório de cobertura |

---

## Estrutura do monorepo

```
seminario/
├── client/                  # Frontend React + Vite
│   ├── src/
│   │   ├── components/      # Componentes reutilizáveis
│   │   ├── contexts/        # AuthContext (JWT + refresh)
│   │   ├── lib/             # apiClient, draft-storage, utils
│   │   ├── pages/
│   │   │   ├── admin/       # Dashboard, Alunos, Aulas, Materiais...
│   │   │   └── student/     # Dashboard, AulaPlayer, Avaliações...
│   │   └── test/            # Setup do vitest
│   ├── nginx.conf           # Config Nginx para produção
│   ├── Dockerfile
│   └── vite.config.ts
│
├── server/                  # Backend Express + Prisma
│   ├── src/
│   │   ├── config/          # Carregamento de .env
│   │   ├── middleware/       # auth, errorHandler, metrics, requestLogger
│   │   ├── routes/          # auth, alunos, admin
│   │   ├── services/        # ai-mock, academic-report, content-change-log...
│   │   ├── utils/           # logger, video-source, objective-assessment...
│   │   └── test/            # Setup do vitest (JWT secrets)
│   ├── prisma/
│   │   └── schema.prisma
│   ├── .env.example
│   └── Dockerfile
│
├── docker-compose.yml       # Dev: apenas postgres
├── docker-compose.prod.yml  # Prod: postgres + server + client
├── .github/workflows/ci.yml
├── README.md
├── PRD.md
├── ROADMAP.md
├── PENDENCIAS.md
└── SYSTEM_DESIGN.md
```

---

## Variáveis de ambiente

Consulte [server/.env.example](server/.env.example) para a lista completa.

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `PORT` | não (padrão 3001) | Porta do servidor |
| `NODE_ENV` | não | `development` ou `production` |
| `LOG_LEVEL` | não (padrão `info`) | `debug`, `info`, `warn`, `error` |
| `JWT_SECRET` | **sim** | Chave de assinatura dos access tokens |
| `JWT_REFRESH_SECRET` | **sim** | Chave de assinatura dos refresh tokens |
| `DATABASE_URL` | **sim** | Connection string PostgreSQL (pgbouncer) |
| `DIRECT_URL` | **sim** | Connection string direta (migrations) |
| `CORS_ORIGIN` | não | Origens permitidas (separadas por vírgula) |
| `OPENAI_API_KEY` | não | Necessário para pipeline de IA |
| `OPENAI_MODEL` | não (padrão `gpt-4o-mini`) | Modelo OpenAI |

---

## Deploy

### Opção 1 — Docker Compose (self-hosted)

```bash
# Configure server/.env com POSTGRES_PASSWORD e demais variáveis
docker-compose -f docker-compose.prod.yml up -d --build
# Acesse: http://localhost:80
```

### Opção 2 — Easypanel / Railway

Crie dois App Services apontando para este repositório:

**Backend** (`server/`)
- Build: `npm install && npm run build`
- Start: `npm run start`
- Porta: `3001`
- Domínio: `api.seu-dominio.com`
- Volumes: `/app/uploads` (persistência de arquivos)

**Frontend** (`client/`)
- Build: `npm install && npm run build`
- Start: `npm run preview -- --host 0.0.0.0 --port 4173`
- Porta: `4173`
- Domínio: `seminario.seu-dominio.com`
- Env: `VITE_API_URL=https://api.seu-dominio.com`

### Opção 3 — CI/CD automático

Cada push para `main` ou `develop` dispara o pipeline GitHub Actions que:
1. Roda testes (server + client) e typecheck em paralelo
2. Constrói e publica imagens Docker no GHCR (`ghcr.io/<org>/server:latest` e `/client:latest`)

---

## Contas padrão (criadas pelo seed)

| E-mail | Senha | Papel |
|--------|-------|-------|
| `ralfer@ibvn.com.br` | `ibvn2024` | admin |
| `fabia@ibvn.com.br` | `ibvn2024` | admin |

> **Troque as senhas imediatamente após o primeiro login em produção.**

---

## Saúde da API

```bash
curl http://localhost:3001/api/health
# {"status":"ok","timestamp":"...","db":"ok","ai":{...}}
```

```bash
# Métricas (requer token de admin)
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/metrics
```
