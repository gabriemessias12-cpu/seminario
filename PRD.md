# PRD — Seminário Vinha Nova

**Produto:** Plataforma de Ensino do Instituto Bíblico Vinha Nova (IBVN)
**Versão:** 1.0 (produção)
**Última revisão:** 2026-03-23

---

## 1. Visão do Produto

Oferecer ao IBVN uma plataforma de ensino bíblico completa, acessível via web e mobile, que permita:

- Alunos acompanharem aulas em vídeo com assistência de inteligência artificial
- Professores/pastores gerenciarem todo o conteúdo e os alunos sem dependência de TI
- Liderança acompanhar o progresso acadêmico da turma em tempo real

### Problema que resolve

O IBVN conduzia seu programa de formação bíblica com materiais físicos e comunicação por WhatsApp. Isso tornava a gestão de presença, avaliações e entrega de materiais trabalhosa e sujeita a perdas.

### Proposta de valor

> "Tudo que o IBVN precisa para operar seu seminário — em uma única plataforma, sem mensalidade de SaaS."

---

## 2. Usuários e Papéis

| Papel | Descrição | Permissões-chave |
|-------|-----------|-----------------|
| `aluno` | Estudante matriculado | Assistir aulas, fazer avaliações, usar assistente IA, ver materiais |
| `admin` | Professor / coordenador | CRUD de tudo, relatórios, chamada, notificações |
| `pastor` | Liderança sênior | Mesmas permissões de admin (papel separado para histórico) |

---

## 3. Funcionalidades Implementadas (v1.0)

### 3.1 Módulo do Aluno

| # | Funcionalidade | Status |
|---|---------------|--------|
| A1 | Login/logout com JWT e refresh automático | ✅ Concluído |
| A2 | Dashboard com progresso geral e últimas aulas | ✅ Concluído |
| A3 | Listagem de aulas por módulo | ✅ Concluído |
| A4 | Player de aula (YouTube embed + vídeo próprio) | ✅ Concluído |
| A5 | Tracking de progresso (posição, % assistido, conclusão) | ✅ Concluído |
| A6 | Quiz ao final da aula (questões objetivas) | ✅ Concluído |
| A7 | Avaliações discursivas e objetivas com entrega de arquivo | ✅ Concluído |
| A8 | Assistente IA contextualizado por aula | ✅ Concluído |
| A9 | Materiais de apoio (download e visualização) | ✅ Concluído |
| A10 | Anotações pessoais por aula | ✅ Concluído |
| A11 | Perfil com foto, edição de dados e troca de senha | ✅ Concluído |
| A12 | Notificações in-app | ✅ Concluído |
| A13 | Exclusão de conta (LGPD — anonimização) | ✅ Concluído |
| A14 | Consentimento de uso de dados para IA | ✅ Concluído |

### 3.2 Módulo Admin

| # | Funcionalidade | Status |
|---|---------------|--------|
| B1 | Dashboard com KPIs: alunos ativos, progresso médio, alertas | ✅ Concluído |
| B2 | CRUD de módulos (com capa, ordem) | ✅ Concluído |
| B3 | CRUD de aulas (vídeo YouTube ou upload, thumbnail, publicação) | ✅ Concluído |
| B4 | Pipeline de IA: transcrição → resumo → pontos-chave → versículos → glossário → quiz | ✅ Concluído |
| B5 | CRUD de materiais de apoio (upload, vinculação por aula) | ✅ Concluído |
| B6 | CRUD de avaliações (discursiva + objetiva com gabarito) | ✅ Concluído |
| B7 | Correção de entregas com nota e comentário | ✅ Concluído |
| B8 | Gestão de alunos (criação, ativação/desativação, foto) | ✅ Concluído |
| B9 | Registro de presença por aula (digital, meet, presencial) | ✅ Concluído |
| B10 | Relatórios acadêmicos (boletim, frequência, resumo de entregas) | ✅ Concluído |
| B11 | Notificações individuais e em massa | ✅ Concluído |
| B12 | Alertas de segurança (novo IP, login falho, troca de senha) | ✅ Concluído |
| B13 | Histórico de mudanças de conteúdo (auditoria) | ✅ Concluído |
| B14 | Customização de fotos de liderança (landing page) | ✅ Concluído |

### 3.3 Infraestrutura

| # | Item | Status |
|---|------|--------|
| C1 | CI/CD GitHub Actions (tests + typecheck + build Docker) | ✅ Concluído |
| C2 | Docker Compose dev (postgres) e prod (postgres + server + client) | ✅ Concluído |
| C3 | Nginx com gzip, cache imutável, security headers, proxy API | ✅ Concluído |
| C4 | Health check com ping ao banco (`/api/health`) | ✅ Concluído |
| C5 | Métricas in-memory por rota (`/api/metrics`, admin-only) | ✅ Concluído |
| C6 | Request logging com correlation ID (`X-Request-ID`) | ✅ Concluído |
| C7 | Logger JSON estruturado com níveis configuráveis | ✅ Concluído |
| C8 | Rate limiting em auth (login + refresh) | ✅ Concluído |
| C9 | Graceful shutdown (SIGTERM/SIGINT com disconnect Prisma) | ✅ Concluído |
| C10 | Error boundary React com log estruturado | ✅ Concluído |
| C11 | Testes automatizados: 90+ testes (vitest, server + client) | ✅ Concluído |

---

## 4. Backlog — Próximas Funcionalidades

### Prioridade Alta

| ID | Funcionalidade | Justificativa |
|----|---------------|---------------|
| F1 | **Boletim imprimível em PDF** | Solicitado pela liderança para arquivamento oficial |
| F2 | **Certificado de conclusão de módulo** | Motivação dos alunos; diferencial do programa |
| F3 | **Refresh tokens persistidos em banco** | Atualmente em memória — perde estado ao reiniciar o servidor |
| F4 | **Notificações por e-mail** | Alertas de nova aula, avaliação pendente |
| F5 | **App mobile (PWA)** | Maioria dos alunos acessa via celular |

### Prioridade Média

| ID | Funcionalidade | Justificativa |
|----|---------------|---------------|
| F6 | **Fórum/comentários por aula** | Comunidade e engajamento |
| F7 | **Calendário de aulas e avaliações** | Planejamento do aluno |
| F8 | **Dashboard de métricas IA** | Quantificar uso e custo |
| F9 | **Multi-turma** | Caso o IBVN expanda para novas turmas simultâneas |
| F10 | **Exportação de relatórios em CSV/Excel** | Integração com planilhas administrativas |

### Prioridade Baixa / Futuro

| ID | Funcionalidade | Justificativa |
|----|---------------|---------------|
| F11 | **Video player próprio com controles avançados** | Reduzir dependência do YouTube |
| F12 | **Modo offline (PWA cache)** | Aulas em áreas com internet limitada |
| F13 | **Gamificação (pontos, medalhas)** | Engajamento de longo prazo |
| F14 | **SSO / login social** | Redução de fricção no onboarding |

---

## 5. Restrições e Decisões de Projeto

| Decisão | Raciocínio |
|---------|-----------|
| PostgreSQL via Supabase | Banco gerenciado gratuito; pgBouncer para pooling |
| JWT em memória (refresh) | Simples; limite: single-instance. Ver F3 para corrigir |
| OpenAI (não self-hosted) | Qualidade superior; custo controlado com créditos por aluno |
| Whisper local (faster-whisper) | Transcrição gratuita para vídeos próprios |
| Sem Redis / cache externo | Escopo atual não justifica; métricas in-memory são suficientes |
| Tailwind sem design system | Velocidade de desenvolvimento; componentes ad-hoc |

---

## 6. Métricas de Sucesso

| Métrica | Meta |
|---------|------|
| Taxa de conclusão de aulas | ≥ 70% das aulas iniciadas são concluídas |
| Engajamento com IA | ≥ 1 pergunta por aluno por módulo |
| Disponibilidade da plataforma | ≥ 99% uptime mensal |
| Tempo médio de resposta da API | ≤ 300 ms (p95) |
| NPS dos alunos | ≥ 8 |
