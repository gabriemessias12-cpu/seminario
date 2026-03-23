# Roadmap — Seminário Vinha Nova

> Fases já concluídas documentam o que foi construído. Fases futuras são intenções priorizadas, não compromissos com datas fixas.

---

## Fases Concluídas

### Fase 1 — MVP (Concluída)
**Objetivo:** Plataforma funcional para a primeira turma do IBVN.

- [x] Autenticação JWT com refresh automático
- [x] Player de aulas (YouTube + vídeo próprio)
- [x] Tracking de progresso por aluno
- [x] Avaliações discursivas com entrega de arquivo
- [x] CRUD completo de módulos, aulas e materiais
- [x] Gestão de alunos (admin)
- [x] Landing page com fotos de liderança

### Fase 2 — IA e Engajamento (Concluída)
**Objetivo:** Diferencial competitivo com IA integrada ao conteúdo.

- [x] Pipeline de IA: transcrição → resumo → pontos-chave → versículos → glossário → quiz
- [x] Assistente IA contextualizado por aula (créditos por aluno)
- [x] Sistema de consentimento de dados para IA
- [x] Avaliações objetivas com gabarito e correção automática
- [x] Anotações pessoais por aula
- [x] Quiz interativo ao final da aula

### Fase 3 — Gestão Acadêmica (Concluída)
**Objetivo:** Funcionalidades operacionais para coordenação.

- [x] Registro de presença (digital, meet, presencial)
- [x] Relatórios acadêmicos (boletim, frequência, resumo de entregas)
- [x] Notificações in-app individuais e em massa
- [x] Alertas de segurança (novo IP, login falho, senha alterada)
- [x] Histórico de auditoria de conteúdo

### Fase 4 — Qualidade e Infraestrutura (Concluída — 2026-03)
**Objetivo:** Estabilidade, segurança e operação sustentável.

- [x] Testes automatizados (90+ testes — vitest, server + client)
- [x] CI/CD completo: testes → typecheck → build → push Docker (GitHub Actions)
- [x] Logger JSON estruturado com níveis configuráveis
- [x] Métricas in-memory por rota (`/api/metrics`)
- [x] Request logging com correlation ID
- [x] Error Boundary React com log estruturado
- [x] Nginx production-ready (gzip, cache imutável, security headers)
- [x] Docker Compose dev e prod
- [x] Audit completo: login_falho, senha_alterada, correção de entregas
- [x] Health check com ping ao banco

---

## Fase 5 — Resiliência e Escala (Próxima)
**Objetivo:** Preparar a plataforma para crescimento e operação 24/7.

### P1 — Crítico

- [ ] **Persistir refresh tokens no banco** (atualmente in-memory; server restart = todos deslogados)
  - Criar tabela `RefreshToken { jti, userId, expiresAt, revokedAt }`
  - Invalidação por `jti` em vez de Set em memória
- [ ] **Timeout em endpoints long-running** (pipeline IA, transcrição)
  - Adicionar `AbortController` com timeout de 10min nos processos filhos
  - Resposta imediata 202 + status polling já existe; garantir cleanup em timeout
- [ ] **Variável `VITE_API_URL` no client** verificar se está sendo usada corretamente em produção

### P2 — Alta Prioridade

- [ ] **Circuit breaker para OpenAI**
  - Após N falhas consecutivas, pausar chamadas por X minutos
  - Logar degradação; retornar fallback gracioso ao aluno
- [ ] **Notificações por e-mail** (nova aula publicada, avaliação expirando em 24h)
  - Integrar Nodemailer ou Resend
  - Fila simples (pg-boss ou Bull) para envio assíncrono
- [ ] **PWA básico** (service worker + manifest)
  - Cache de assets estáticos offline
  - Ícone na tela inicial do celular

---

## Fase 6 — Funcionalidades de Alto Impacto
**Objetivo:** Itens do backlog do PRD com maior valor percebido pelos usuários.

- [ ] **Certificado de conclusão de módulo** (PDF gerado no servidor)
- [ ] **Boletim imprimível em PDF** (html-pdf ou Puppeteer)
- [ ] **Fórum por aula** (comentários moderados por admin)
- [ ] **Calendário de aulas e avaliações** (visualização mensal/semanal)
- [ ] **Exportação de relatórios CSV/Excel**

---

## Fase 7 — Multi-turma e Expansão
**Objetivo:** Suporte a múltiplas turmas simultâneas e novos institutos.

- [ ] **Modelo de turmas** — separar alunos por turma; módulos por turma
- [ ] **Multi-tenant** — suporte a múltiplos institutos no mesmo deploy
- [ ] **Papéis granulares** — professor (cria conteúdo mas não gerencia alunos)
- [ ] **App mobile nativo** (React Native) ou PWA avançado

---

## Critérios para avançar de fase

| Condição | Descrição |
|----------|-----------|
| Cobertura de testes | ≥ 80% nas rotas críticas (auth, progresso, avaliações) |
| Zero erros críticos abertos | Nenhum bug P0/P1 no backlog |
| Deploy estável por 30 dias | Sem regressões em produção |
| Aprovação da liderança | Features da próxima fase alinhadas com coordenação do IBVN |

---

## Legenda de prioridade

| Símbolo | Significado |
|---------|------------|
| 🔴 P0 | Bloqueador — impede operação |
| 🟠 P1 | Crítico — corrigir no próximo sprint |
| 🟡 P2 | Alta — próxima janela de desenvolvimento |
| 🟢 P3 | Média — próximo trimestre |
| ⚪ P4 | Baixa / futuro — backlog |
