# Pendências e Changelog — Seminário Vinha Nova

> Este documento registra correções realizadas, pendências conhecidas e decisões técnicas relevantes.
> Para o backlog de funcionalidades novas, consulte [PRD.md](PRD.md).
> Para a visão de fases, consulte [ROADMAP.md](ROADMAP.md).

---

## Changelog

### 2026-03-23 — Auditoria de Estabilidade (Fases 1–12)

#### Fase 1 — Segurança e Autenticação
- ✅ Implementado `apiClient.ts` centralizado com injeção automática de JWT
- ✅ Retry automático em 401 com refresh token
- ✅ Migração de todas as páginas para `apiClient` (removido `token` manual de todos os componentes)
- ✅ Rate limiting nas rotas de auth (`/login`: 10/15min, `/refresh`: 15/1min)
- ✅ Validação de entrada com Zod no login

#### Fase 2 — Banco de Dados e ORM
- ✅ Todos os `await prisma.*` em handlers sem `try/catch` foram encapsulados
- ✅ Índices revisados no schema Prisma

#### Fase 3 — Performance e Cache
- ✅ Proxy `/uploads` e `/api/uploads` deduplicados no servidor
- ✅ Code splitting Vite: chunks separados para react-vendor, router, framer-motion, icons
- ✅ Build com `minify: 'esbuild'`, `sourcemap: false` em produção

#### Fase 4 — Componentes React
- ✅ `AuthContext.tsx` — refresh automático via `apiClient.configureApiClient`
- ✅ Removido `useAuth().token` de `AulaPlayer.tsx` e demais páginas
- ✅ `AbortController` preservado após migração para `apiFetch`

#### Fase 5 — Responsividade e UI/UX
- ✅ Overflow fix: `min-width: 0` em flex children de `.lesson-group-header`
- ✅ Truncamento CSS: `text-overflow: ellipsis` + `line-clamp` sem `.substring()`
- ✅ Z-index: documentação completa do stack (1–9999) em `index.css`
- ✅ Touch targets: `aria-label` em todos os `role="button"` divs
- ✅ Labels associados a inputs com `htmlFor` + `id` em formulários de admin
- ✅ `.alert-action-row` responsivo (coluna em mobile)
- ✅ `.profile-card-header` flex-wrap em telas estreitas

#### Fase 6 — Padronização de Código
- ✅ `logger.ts` substituiu todos os `console.log/warn/error` no servidor
- ✅ `errorHandler.ts` centralizado (4-arg Express) registrado após todas as rotas
- ✅ `AulaPlayer.tsx` migrado para `apiClient` — removidos 8 fetch manuais

#### Fase 7 — Limpeza
- ✅ Tipos duplicados revisados nos componentes admin

#### Fase 8 — Testes Automatizados
- ✅ Vitest configurado em server e client
- ✅ 90+ testes criados do zero:
  - `server/src/utils/__tests__/video-source.test.ts` (18 testes)
  - `server/src/utils/__tests__/objective-assessment.test.ts` (27 testes)
  - `server/src/middleware/__tests__/auth.test.ts` (24 testes)
  - `client/src/lib/__tests__/draft-storage.test.ts` (11 testes)
  - `client/src/lib/__tests__/apiClient.test.ts` (10 testes)
- ✅ `server/src/test/setup.ts` — JWT secrets antes do carregamento dos módulos

#### Fase 9 — CI/CD e Infraestrutura
- ✅ `.github/workflows/ci.yml` — 4 jobs: test-server, test-client, typecheck, build-and-push
- ✅ `docker-compose.yml` (dev) e `docker-compose.prod.yml` (prod com healthchecks)
- ✅ `client/nginx.conf` — gzip, cache imutável, security headers, proxy API
- ✅ `server/.env.example` — variáveis `NODE_ENV` e `LOG_LEVEL` adicionadas

#### Fase 10 — Health Check e Métricas
- ✅ `/api/health` pinga o banco (`SELECT 1`); retorna 503 se degradado
- ✅ `/api/metrics` — métricas in-memory por rota (p50/p95/p99), admin-only

#### Fase 11 — Monitoramento e Observabilidade
- ✅ `logger.ts` — JSON estruturado, níveis configuráveis, retrocompatível
- ✅ `requestLogger.ts` — access log com `requestId` (UUID), timing, userId
- ✅ `metrics.ts` — contadores globais + histograma por rota
- ✅ `errorHandler.ts` — inclui `requestId` na resposta 500
- ✅ `auth.ts` — audit `login_falho`: `LoginHistorico` + `AlertaSeguranca` em senha errada
- ✅ `alunos.ts` — audit `senha_alterada` + log de deleção de conta (LGPD)
- ✅ `admin.ts` — audit de correção de entregas + log de chamada
- ✅ `ErrorBoundary.tsx` — captura erros React com log estruturado; fallback com reload

#### Fase 12 — Documentação
- ✅ `README.md` — setup completo, stack, comandos, estrutura, variáveis, deploy
- ✅ `PRD.md` — objetivos, funcionalidades v1.0, backlog priorizado, métricas de sucesso
- ✅ `ROADMAP.md` — fases concluídas + fases futuras com critérios de avanço
- ✅ `PENDENCIAS.md` — este arquivo
- ✅ `SYSTEM_DESIGN.md` — arquitetura, fluxos de dados, APIs, decisões técnicas

---

## Pendências Conhecidas

### 🔴 Críticas

| ID | Descrição | Impacto | Arquivo |
|----|-----------|---------|---------|
| P-001 | **Refresh tokens em memória** — server restart desloga todos os usuários | Alto em produção | `server/src/middleware/auth.ts` |

### 🟠 Alta Prioridade

| ID | Descrição | Impacto | Arquivo |
|----|-----------|---------|---------|
| P-002 | **Pipeline de IA sem timeout** — transcrição pode travar indefinidamente | Médio | `server/src/routes/admin.ts` (linha ~1850) |
| P-003 | **`VITE_API_URL` não validada** — se ausente em produção, as chamadas vão para localhost | Médio | `client/src/lib/api.ts` |
| P-004 | **Cobertura de testes baixa nas rotas** — apenas utilitários e middleware têm testes; rotas REST não | Médio | `server/src/routes/` |

### 🟡 Média Prioridade

| ID | Descrição | Impacto | Arquivo |
|----|-----------|---------|---------|
| P-005 | **Sem paginação em listagens longas** — `/api/admin/alunos` retorna todos sem `limit/offset` | Médio | `server/src/routes/admin.ts` |
| P-006 | **Upload sem validação de tipo MIME no servidor** — multer aceita qualquer arquivo | Baixo/Médio | `server/src/routes/admin.ts` |
| P-007 | **`questoesObjetivas` armazenado como JSON string** — dificulta queries; ideal seria JSONB | Baixo | `server/prisma/schema.prisma` |
| P-008 | **Sem índice em `ProgressoAluno.alunoId`** quando buscando todos os progressos de um aluno | Baixo | `server/prisma/schema.prisma` |

### 🟢 Baixa Prioridade

| ID | Descrição | Impacto | Arquivo |
|----|-----------|---------|---------|
| P-009 | **Sem notificações por e-mail** — somente in-app | Baixo | Novo serviço |
| P-010 | **Sem PWA manifest / service worker** | Baixo | `client/public/` |
| P-011 | **Métricas in-memory não sobrevivem a restart** — apenas para observação em tempo real | Baixo | `server/src/middleware/metrics.ts` |
| P-012 | **Storybook / documentação de componentes** não implementado | Baixo | `client/src/components/` |

---

## Decisões Técnicas Registradas

| Data | Decisão | Alternativa Considerada | Razão |
|------|---------|------------------------|-------|
| 2026-03 | JWT em memória (refresh) | Redis / banco | Simplicidade; escopo single-instance |
| 2026-03 | Logger console-JSON próprio | Winston / Pino | Zero dependência; mesma interface |
| 2026-03 | Métricas in-memory | Prometheus + Grafana | Overkill para porte atual do projeto |
| 2026-03 | Vitest (não Jest) | Jest | ESM nativo; mais rápido; config unificada com Vite |
| 2026-03 | PostgreSQL (não SQLite) | SQLite | Produção já usava Supabase; JSONB e índices parciais |
| 2026-03 | faster-whisper (local) | OpenAI Whisper API | Custo zero para transcrição; latência aceitável |
