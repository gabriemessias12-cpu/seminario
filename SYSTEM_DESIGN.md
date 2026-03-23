# System Design — Seminário Vinha Nova

**Audiência:** Desenvolvedores que precisam entender, manter ou estender a plataforma.
**Última revisão:** 2026-03-23

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ :80
                ┌──────────▼──────────┐
                │  Nginx (container)  │
                │  gzip · cache · CSP  │
                └──┬──────────────┬───┘
                   │ /            │ /api/, /uploads/
          ┌────────▼────┐  ┌──────▼───────────────┐
          │  React SPA  │  │  Express API          │
          │  (static)   │  │  (container :3001)    │
          └─────────────┘  └──────────┬────────────┘
                                      │
                           ┌──────────▼──────────┐
                           │  PostgreSQL          │
                           │  (container :5432)   │
                           └─────────────────────┘
```

**Fluxo de uma requisição autenticada:**
1. Browser → Nginx `:80`
2. Nginx faz proxy de `/api/*` → Express `:3001`
3. Express: `requestLogger` (gera `requestId`) → `metricsMiddleware` → `authMiddleware` (valida JWT) → handler da rota → `errorHandler`
4. Handler usa Prisma Client → PostgreSQL
5. Resposta inclui header `X-Request-ID` para correlação de logs

---

## 2. Autenticação e Autorização

### Fluxo de Login

```
Cliente                     Servidor
  │                             │
  ├── POST /api/auth/login ────►│
  │   { email, senha }          │ 1. Valida Zod schema
  │                             │ 2. Busca User por email
  │                             │ 3. bcrypt.compare(senha, senhaHash)
  │                             │ 4. Registra LoginHistorico
  │                             │ 5. Detecta IP novo → AlertaSeguranca
  │                             │ 6. generateTokens(payload)
  │◄── { accessToken,           │
  │      refreshToken, user } ──┤
  │                             │
  │  Armazena no localStorage   │
```

### Estrutura dos Tokens

| Token | Expiração | Payload |
|-------|-----------|---------|
| `accessToken` | 2 horas | `{ userId, email, papel, nome, iat, exp }` |
| `refreshToken` | 7 dias | `{ userId, jti, iat, exp }` |

**JTI (JWT ID):** cada refresh token tem um UUID único armazenado em um `Set` em memória. Após uso, o JTI é invalidado (single-use rotation). ⚠️ Não persiste entre restarts — ver pendência P-001.

### Middleware de Auth

```typescript
// authMiddleware — aplicado em todas as rotas /api/aluno e /api/admin
// Extrai Bearer token → verifyAccessToken → req.user = payload
// Em 401: o apiClient do client tenta /api/auth/refresh automaticamente

// adminMiddleware — aplicado após authMiddleware nas rotas /api/admin
// Verifica req.user.papel === 'admin' || 'pastor'
```

### Refresh Automático no Client

O `apiClient.ts` intercepta respostas 401 e:
1. Tenta `POST /api/auth/refresh` com o `refreshToken` do localStorage
2. Se sucesso: atualiza tokens → repete a requisição original
3. Se falha: chama `onLogout()` → limpa localStorage → redireciona para login

---

## 3. Fluxo de Pipeline de IA

```
Admin clica "Processar com IA"
        │
        ▼
POST /api/admin/aula/:id/processar-ia
        │
        ├── Aula tem vídeo YouTube?
        │       │ SIM
        │       ▼
        │   yt-dlp extrai áudio → arquivo temp
        │   faster-whisper transcreve → texto
        │
        ├── Aula tem vídeo upload?
        │       │ SIM
        │       ▼
        │   faster-whisper transcreve direto
        │
        └── (sem vídeo) usa transcrição existente
                │
                ▼
         OpenAI GPT-4o-mini
              │
              ├── Resumo da aula
              ├── Pontos-chave (array)
              ├── Versículos bíblicos mencionados
              ├── Glossário (termos teológicos)
              └── Quiz (5 questões objetivas + 2 dissertativas)
                        │
                        ▼
              prisma.aula.update({
                transcricao, resumo, pontosChave,
                versiculos, glossario, statusIA: 'concluido'
              })
              + Quiz criado/atualizado em paralelo
```

**Fallback:** Se Whisper local falhar, tenta API Whisper da OpenAI.
**Status polling:** Admin pode consultar `GET /api/admin/aula/:id/status-ia` enquanto processa.

---

## 4. Sistema de Créditos IA

```
Aluno tem aiCreditosDisponiveis (padrão: 3/dia)
        │
        ▼
POST /api/aluno/ia/perguntar
        │
        ├── consumeAICredit(prisma, userId)
        │       └── Se créditos = 0 → 429 Too Many Requests
        │
        ├── Busca aula + transcrição + resumo como contexto
        │
        └── OpenAI GPT-4o-mini com system prompt:
            "Você é um assistente bíblico. Responda APENAS
             com base no conteúdo da aula: [contexto]"
                │
                ▼
            Salva em InteracaoIA
            Retorna resposta
```

**Bônus de créditos:** Alunos que compartilham dados de aprendizagem (`compartilhaDadosIA = true`) recebem 5 créditos extras/dia em vez de 3.

---

## 5. Fluxo de Upload de Arquivos

```
Multer middleware configura:
  /uploads/materials/  — materiais de apoio
  /uploads/thumbnails/ — capas de módulos e thumbnails de aulas
  /uploads/videos/     — vídeos próprios (upload direto)
  /uploads/submissions/— entregas de avaliações dos alunos
  /uploads/avatars/    — fotos de perfil
  /uploads/brand/      — fotos de liderança da landing page
```

**Servidos por:**
- Express `express.static` para `/uploads/*` e `/api/uploads/*`
- Em produção: Nginx faz proxy `/uploads/` → container server

**Download autenticado** (`/api/aluno/entrega-avaliacao/:id/arquivo`):
- Verifica que o arquivo pertence ao aluno autenticado antes de fazer `sendStoredUpload()`

---

## 6. Modelo de Dados

### Entidades Principais

```
User (1) ──────────── (N) ProgressoAluno
 │                              │ aulaId
 │                              ▼
 │                            Aula (N) ─── (1) Modulo
 │                              │
 │                              ├── (N) Material (via MaterialAula)
 │                              ├── (N) Quiz
 │                              └── (N) Presenca
 │
 ├── (N) EntregaAvaliacao ── (1) Avaliacao ── (1) Modulo / Aula
 ├── (N) AnotacaoAluno
 ├── (N) ResultadoQuiz
 ├── (N) InteracaoIA
 ├── (N) LoginHistorico
 ├── (N) AlertaSeguranca
 └── (N) Notificacao
```

### Modelos de Auditoria

| Model | Quando é criado |
|-------|----------------|
| `LoginHistorico` | A cada login (sucesso ou falha) |
| `AlertaSeguranca` | Novo IP, senha errada, senha alterada |
| `RegistroMudancaConteudo` | CRUD de módulos, aulas, materiais, avaliações, entregas |

---

## 7. Logging e Observabilidade

### Estrutura de um Log

```json
{
  "level": "info",
  "timestamp": "2026-03-23T14:30:00.000Z",
  "message": "http request",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "path": "/api/auth/login",
  "status": 200,
  "durationMs": 142.5,
  "ip": "::1",
  "userId": "abc123",
  "userAgent": "Mozilla/5.0..."
}
```

### Níveis

| Nível | Uso |
|-------|-----|
| `debug` | Detalhes de desenvolvimento (desabilitado em produção) |
| `info` | Requisições HTTP, ações de negócio importantes |
| `warn` | Situações degradadas mas recuperáveis (ex: Whisper local falhou, usando API) |
| `error` | Erros não esperados, falhas de banco, exceções não tratadas |

### Correlação de Erros

Todo erro 500 retorna `{ requestId }` no body. O mesmo `requestId` aparece nos logs do servidor, permitindo correlação direta.

---

## 8. Métricas (`GET /api/metrics`)

Requer token de admin. Retorna:

```json
{
  "uptimeSeconds": 3600,
  "requests": {
    "total": 1250,
    "errors": 12,
    "errorRate": 0.0096,
    "4xx": 8,
    "5xx": 4
  },
  "memory": {
    "heapUsedMb": 87.3,
    "heapTotalMb": 120.0,
    "rssMb": 145.6
  },
  "routes": [
    {
      "route": "GET /api/aluno/dashboard",
      "count": 340,
      "errors": 0,
      "avgMs": 45.2,
      "p50Ms": 38.0,
      "p95Ms": 120.5,
      "p99Ms": 210.0
    }
  ]
}
```

---

## 9. Referência de Endpoints

### Autenticação

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/login` | — | Login com e-mail e senha |
| POST | `/api/auth/refresh` | — | Renovar access token |
| POST | `/api/auth/logout` | — | Invalidar refresh token |
| GET | `/api/auth/me` | aluno/admin | Dados do usuário autenticado |

### Aluno

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/aluno/dashboard` | KPIs do aluno (progresso, aulas recentes) |
| GET | `/api/aluno/aulas` | Módulos e aulas disponíveis |
| GET | `/api/aluno/aula/:id` | Detalhes da aula (vídeo, materiais, quiz) |
| GET | `/api/aluno/aula/:id/ytk` | Token para embed YouTube protegido |
| POST | `/api/aluno/progresso` | Atualizar posição e % assistido |
| POST | `/api/aluno/aula/:id/concluir` | Marcar aula como concluída |
| POST | `/api/aluno/quiz` | Submeter respostas do quiz |
| PUT | `/api/aluno/anotacao` | Salvar/atualizar anotação |
| GET | `/api/aluno/materiais` | Materiais de apoio |
| GET | `/api/aluno/avaliacoes` | Avaliações e status de entrega |
| POST | `/api/aluno/avaliacao/:id/entrega` | Submeter entrega (multipart) |
| GET | `/api/aluno/entrega-avaliacao/:id/arquivo` | Download autenticado de entrega |
| GET | `/api/aluno/perfil` | Dados do perfil |
| PUT | `/api/aluno/perfil` | Atualizar nome, telefone |
| PUT | `/api/aluno/perfil/foto` | Upload de avatar (multipart) |
| GET | `/api/aluno/ia/status` | Créditos IA disponíveis |
| PUT | `/api/aluno/ia/consentimento` | Alterar consentimento de dados IA |
| POST | `/api/aluno/ia/perguntar` | Pergunta ao assistente IA |
| PUT | `/api/aluno/senha` | Alterar senha (requer senha atual) |
| PUT | `/api/aluno/notificacao/:id/lida` | Marcar notificação como lida |
| DELETE | `/api/aluno/conta` | Excluir conta (anonimização LGPD) |

### Admin

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/admin/dashboard` | KPIs administrativos |
| GET/POST | `/api/admin/alunos` / `/api/admin/aluno` | Listar / criar aluno |
| GET/PUT | `/api/admin/aluno/:id` | Detalhes / ativar-desativar |
| GET/POST/PUT/DELETE | `/api/admin/aulas` | CRUD de aulas |
| GET/POST/PUT/DELETE | `/api/admin/modulos` | CRUD de módulos |
| GET/POST/PUT/DELETE | `/api/admin/materiais` | CRUD de materiais |
| GET/POST/PUT/DELETE | `/api/admin/avaliacoes` | CRUD de avaliações |
| PUT | `/api/admin/entrega-avaliacao/:id/correcao` | Corrigir entrega com nota |
| GET/POST | `/api/admin/chamada` | Listar / registrar presença |
| POST | `/api/admin/notificacao` | Enviar notificação (individual ou em massa) |
| GET | `/api/admin/relatorios` | Relatórios acadêmicos |
| POST | `/api/admin/aula/:id/processar-ia` | Iniciar pipeline de IA |
| POST | `/api/admin/aula/:id/gerar-transcricao` | Gerar apenas transcrição |
| GET | `/api/admin/alertas-seguranca` | Alertas de segurança |
| GET | `/api/admin/conteudo-historico` | Histórico de auditoria de conteúdo |

### Sistema

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/health` | — | Status da API e do banco |
| GET | `/api/metrics` | admin | Métricas in-memory de performance |
| GET | `/api/brand/lideranca` | — | Fotos de liderança (landing page) |

---

## 10. Decisões de Design Relevantes

### Por que JWT em localStorage (não httpOnly cookie)?

O frontend React é uma SPA servida por Nginx. O token precisa ser acessível ao JavaScript para ser enviado via `Authorization: Bearer`. A mitigação é: tokens de curta duração (2h), refresh rotation com JTI, rate limiting no refresh.

### Por que `compileInput.signal` preservado no apiClient?

Os componentes React com `useEffect` criam um `AbortController`. O `apiFetch` aceita `signal` via `init` e o repassa ao `fetch` nativo. Isso evita memory leaks e erros em componentes desmontados durante requests em flight.

### Por que faster-whisper (local) em vez de só OpenAI?

faster-whisper (CTranslate2) roda o modelo Whisper `small` localmente, consumindo ~460 MB de RAM. Custo zero para transcrição de vídeos próprios. OpenAI Whisper API é o fallback quando o processo local falha.

### Por que não usar Redis para refresh tokens?

Escopo atual: single-instance, sem necessidade de cluster. Redis adicionaria complexidade operacional. A pendência P-001 documenta a solução correta quando necessário: persistir JTIs no PostgreSQL com coluna `expiresAt` e job de limpeza periódica.

---

## 11. Estrutura de Pastas — Referência Rápida

```
server/src/
├── config/
│   └── env.ts                  # loadEnvFiles(): carrega .env e .env.local
├── middleware/
│   ├── auth.ts                 # JWT: generateTokens, verify, authMiddleware, adminMiddleware
│   ├── errorHandler.ts         # Express 4-arg error handler (registrado após todas as rotas)
│   ├── metrics.ts              # Contadores in-memory + getMetrics()
│   └── requestLogger.ts        # Access log + injeção de requestId
├── routes/
│   ├── auth.ts                 # /api/auth/*
│   ├── alunos.ts               # /api/aluno/*
│   └── admin.ts                # /api/admin/*
├── services/
│   ├── ai-credits.ts           # Lógica de créditos IA por aluno
│   ├── ai-mock.ts              # Integração OpenAI (pipeline, assistente, transcrição)
│   ├── academic-report.ts      # Builders de relatórios PDF/JSON
│   ├── content-change-log.ts   # logContentChange() — auditoria de CRUD
│   └── system-accounts.ts      # ensureSystemAccounts() — seed de admins
└── utils/
    ├── logger.ts               # JSON estruturado com contexto e níveis
    ├── objective-assessment.ts # Parse/grade/sanitize de questões objetivas
    ├── stored-file.ts          # sendStoredUpload() — download seguro
    └── video-source.ts         # Normalização de URLs YouTube/upload

client/src/
├── components/
│   ├── ErrorBoundary.tsx       # Captura erros React; log estruturado
│   ├── Sidebar.tsx             # Navegação lateral (admin + student)
│   ├── AvatarCropModal.tsx     # Crop de imagem antes do upload
│   ├── AppIcon.tsx             # Ícone SVG da aplicação
│   └── layouts/
│       └── AdminLayout.tsx     # Layout com sidebar para área admin
├── contexts/
│   └── AuthContext.tsx         # Estado de auth + refresh automático + apiClient config
├── lib/
│   ├── api.ts                  # API_BASE_URL, apiUrl()
│   ├── apiClient.ts            # apiFetch/Get/Post/Put/Delete com auth + retry 401
│   ├── auth-file.ts            # downloadAuthenticatedFile()
│   ├── draft-storage.ts        # readDraft/writeDraft/clearDraft (localStorage)
│   ├── objective-assessment.ts # Tipos e builders de avaliações objetivas
│   └── utils.ts                # cn() — merge de classes Tailwind
└── pages/
    ├── admin/                  # Dashboard, Alunos, Aulas, AulaNova, AulaEditar,
    │                           # Materiais, Avaliações, Chamada, Avisos, Relatórios,
    │                           # AlunoDetalhes, Configurações
    └── student/                # Dashboard, Aulas, AulaPlayer, Materiais,
                                # Avaliações, Perfil
```
