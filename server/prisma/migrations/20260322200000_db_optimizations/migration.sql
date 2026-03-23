-- ============================================================
-- MIGRATION: db_optimizations
-- Adds ENUMs, indexes, CHECK constraints, RPCs and Views
-- ============================================================

-- ─── 1. ENUMS ────────────────────────────────────────────────────────────────

CREATE TYPE "PapelUsuario" AS ENUM ('aluno', 'admin', 'pastor');
CREATE TYPE "StatusIA" AS ENUM ('pendente', 'processando', 'concluido', 'erro');
CREATE TYPE "StatusEntrega" AS ENUM ('pendente', 'enviado', 'corrigido');
CREATE TYPE "StatusPresenca" AS ENUM ('presente', 'parcial', 'ausente');
CREATE TYPE "MetodoPresenca" AS ENUM ('digital', 'meet', 'presencial');
CREATE TYPE "FormatoAvaliacao" AS ENUM ('discursiva', 'objetiva');
CREATE TYPE "TipoAlertaSeguranca" AS ENUM ('novo_ip', 'login_falho', 'senha_alterada');

-- Migrate existing string columns to ENUM types
ALTER TABLE "User"
  ALTER COLUMN "papel" TYPE "PapelUsuario"
    USING "papel"::"PapelUsuario";

ALTER TABLE "Aula"
  ALTER COLUMN "statusIA" TYPE "StatusIA"
    USING "statusIA"::"StatusIA";

ALTER TABLE "EntregaAvaliacao"
  ALTER COLUMN "status" TYPE "StatusEntrega"
    USING "status"::"StatusEntrega";

ALTER TABLE "Presenca"
  ALTER COLUMN "status" TYPE "StatusPresenca"
    USING "status"::"StatusPresenca",
  ALTER COLUMN "metodo" TYPE "MetodoPresenca"
    USING "metodo"::"MetodoPresenca";

ALTER TABLE "Avaliacao"
  ALTER COLUMN "formato" TYPE "FormatoAvaliacao"
    USING "formato"::"FormatoAvaliacao";

ALTER TABLE "AlertaSeguranca"
  ALTER COLUMN "tipo" TYPE "TipoAlertaSeguranca"
    USING "tipo"::"TipoAlertaSeguranca";

-- ─── 2. INDEXES ──────────────────────────────────────────────────────────────

-- User
CREATE INDEX IF NOT EXISTS "User_papel_idx" ON "User"("papel");
CREATE INDEX IF NOT EXISTS "User_ultimoAcesso_idx" ON "User"("ultimoAcesso");
CREATE INDEX IF NOT EXISTS "User_ativo_idx" ON "User"("ativo");

-- Modulo
CREATE INDEX IF NOT EXISTS "Modulo_ativo_idx" ON "Modulo"("ativo");
CREATE INDEX IF NOT EXISTS "Modulo_ordem_idx" ON "Modulo"("ordem");

-- Aula
CREATE INDEX IF NOT EXISTS "Aula_moduloId_idx" ON "Aula"("moduloId");
CREATE INDEX IF NOT EXISTS "Aula_publicado_idx" ON "Aula"("publicado");
CREATE INDEX IF NOT EXISTS "Aula_criadoEm_idx" ON "Aula"("criadoEm" DESC);
CREATE INDEX IF NOT EXISTS "Aula_statusIA_idx" ON "Aula"("statusIA");

-- Avaliacao
CREATE INDEX IF NOT EXISTS "Avaliacao_publicado_idx" ON "Avaliacao"("publicado");
CREATE INDEX IF NOT EXISTS "Avaliacao_moduloId_idx" ON "Avaliacao"("moduloId");
CREATE INDEX IF NOT EXISTS "Avaliacao_aulaId_idx" ON "Avaliacao"("aulaId");
CREATE INDEX IF NOT EXISTS "Avaliacao_dataLimite_idx" ON "Avaliacao"("dataLimite");

-- EntregaAvaliacao
CREATE INDEX IF NOT EXISTS "EntregaAvaliacao_alunoId_idx" ON "EntregaAvaliacao"("alunoId");
CREATE INDEX IF NOT EXISTS "EntregaAvaliacao_avaliacaoId_idx" ON "EntregaAvaliacao"("avaliacaoId");
CREATE INDEX IF NOT EXISTS "EntregaAvaliacao_status_idx" ON "EntregaAvaliacao"("status");
CREATE INDEX IF NOT EXISTS "EntregaAvaliacao_corrigidoEm_idx" ON "EntregaAvaliacao"("corrigidoEm");

-- Quiz
CREATE INDEX IF NOT EXISTS "Quiz_aulaId_idx" ON "Quiz"("aulaId");

-- ProgressoAluno
CREATE INDEX IF NOT EXISTS "ProgressoAluno_alunoId_idx" ON "ProgressoAluno"("alunoId");
CREATE INDEX IF NOT EXISTS "ProgressoAluno_aulaId_idx" ON "ProgressoAluno"("aulaId");
CREATE INDEX IF NOT EXISTS "ProgressoAluno_concluido_idx" ON "ProgressoAluno"("concluido");
CREATE INDEX IF NOT EXISTS "ProgressoAluno_alunoId_concluido_idx" ON "ProgressoAluno"("alunoId", "concluido");

-- ResultadoQuiz
CREATE INDEX IF NOT EXISTS "ResultadoQuiz_alunoId_idx" ON "ResultadoQuiz"("alunoId");
CREATE INDEX IF NOT EXISTS "ResultadoQuiz_aulaId_idx" ON "ResultadoQuiz"("aulaId");
CREATE INDEX IF NOT EXISTS "ResultadoQuiz_feitoEm_idx" ON "ResultadoQuiz"("feitoEm" DESC);

-- Material
CREATE INDEX IF NOT EXISTS "Material_categoria_idx" ON "Material"("categoria");
CREATE INDEX IF NOT EXISTS "Material_criadoEm_idx" ON "Material"("criadoEm" DESC);

-- MaterialAula
CREATE INDEX IF NOT EXISTS "MaterialAula_aulaId_idx" ON "MaterialAula"("aulaId");
CREATE INDEX IF NOT EXISTS "MaterialAula_materialId_idx" ON "MaterialAula"("materialId");

-- Presenca
CREATE INDEX IF NOT EXISTS "Presenca_alunoId_idx" ON "Presenca"("alunoId");
CREATE INDEX IF NOT EXISTS "Presenca_aulaId_idx" ON "Presenca"("aulaId");
CREATE INDEX IF NOT EXISTS "Presenca_status_idx" ON "Presenca"("status");

-- Notificacao
CREATE INDEX IF NOT EXISTS "Notificacao_alunoId_idx" ON "Notificacao"("alunoId");
CREATE INDEX IF NOT EXISTS "Notificacao_alunoId_lida_idx" ON "Notificacao"("alunoId", "lida");

-- AnotacaoAluno
CREATE INDEX IF NOT EXISTS "AnotacaoAluno_alunoId_idx" ON "AnotacaoAluno"("alunoId");

-- LoginHistorico
CREATE INDEX IF NOT EXISTS "LoginHistorico_usuarioId_idx" ON "LoginHistorico"("usuarioId");
CREATE INDEX IF NOT EXISTS "LoginHistorico_dataHora_idx" ON "LoginHistorico"("dataHora" DESC);
CREATE INDEX IF NOT EXISTS "LoginHistorico_usuarioId_sucesso_idx" ON "LoginHistorico"("usuarioId", "sucesso");

-- InteracaoIA
CREATE INDEX IF NOT EXISTS "InteracaoIA_alunoId_idx" ON "InteracaoIA"("alunoId");
CREATE INDEX IF NOT EXISTS "InteracaoIA_aulaId_idx" ON "InteracaoIA"("aulaId");

-- AlertaSeguranca
CREATE INDEX IF NOT EXISTS "AlertaSeguranca_usuarioId_idx" ON "AlertaSeguranca"("usuarioId");
CREATE INDEX IF NOT EXISTS "AlertaSeguranca_lido_idx" ON "AlertaSeguranca"("lido");

-- RegistroMudancaConteudo
CREATE INDEX IF NOT EXISTS "RegistroMudancaConteudo_criadoEm_idx" ON "RegistroMudancaConteudo"("criadoEm" DESC);
CREATE INDEX IF NOT EXISTS "RegistroMudancaConteudo_entidade_entidadeId_idx" ON "RegistroMudancaConteudo"("entidade", "entidadeId");

-- ─── 3. CHECK CONSTRAINTS ────────────────────────────────────────────────────

-- ProgressoAluno: percentual 0–100, tempo não negativo, datas coerentes
ALTER TABLE "ProgressoAluno"
  ADD CONSTRAINT chk_progresso_percentual
    CHECK ("percentualAssistido" >= 0 AND "percentualAssistido" <= 100),
  ADD CONSTRAINT chk_progresso_tempo
    CHECK ("tempoTotalSegundos" >= 0),
  ADD CONSTRAINT chk_progresso_datas
    CHECK ("dataConclusao" IS NULL OR "dataConclusao" >= "dataInicio");

-- Presenca: percentual 0–100
ALTER TABLE "Presenca"
  ADD CONSTRAINT chk_presenca_percentual
    CHECK ("percentual" >= 0 AND "percentual" <= 100);

-- ResultadoQuiz: pontuação não pode exceder total de questões
ALTER TABLE "ResultadoQuiz"
  ADD CONSTRAINT chk_quiz_pontuacao
    CHECK ("pontuacao" >= 0 AND "pontuacao" <= "totalQuestoes");

-- EntregaAvaliacao: nota não negativa, datas coerentes
ALTER TABLE "EntregaAvaliacao"
  ADD CONSTRAINT chk_entrega_nota
    CHECK ("nota" IS NULL OR "nota" >= 0),
  ADD CONSTRAINT chk_entrega_datas
    CHECK ("corrigidoEm" IS NULL OR "enviadoEm" IS NULL OR "corrigidoEm" >= "enviadoEm");

-- Avaliacao: notaMaxima positiva, tempoLimite positivo
ALTER TABLE "Avaliacao"
  ADD CONSTRAINT chk_avaliacao_nota_maxima
    CHECK ("notaMaxima" > 0),
  ADD CONSTRAINT chk_avaliacao_tempo_limite
    CHECK ("tempoLimiteMinutos" IS NULL OR "tempoLimiteMinutos" > 0);

-- ─── 4. VIEWS ────────────────────────────────────────────────────────────────

-- View: engajamento por aula (usada no dashboard admin)
CREATE OR REPLACE VIEW v_lesson_engagement AS
SELECT
  a.id                                                              AS aula_id,
  a.titulo,
  a."moduloId"                                                      AS modulo_id,
  m.titulo                                                          AS modulo_titulo,
  COUNT(DISTINCT pa."alunoId")                                      AS total_alunos,
  COUNT(DISTINCT pa."alunoId") FILTER (WHERE pa.concluido = true)  AS alunos_concluiram,
  ROUND(AVG(pa."percentualAssistido")::NUMERIC, 2)                  AS media_conclusao,
  COUNT(DISTINCT rq.id)                                             AS total_tentativas_quiz,
  ROUND(
    AVG(rq.pontuacao::NUMERIC / NULLIF(rq."totalQuestoes", 0)) * 100,
    2
  )                                                                 AS media_quiz
FROM "Aula" a
LEFT JOIN "Modulo" m            ON a."moduloId" = m.id
LEFT JOIN "ProgressoAluno" pa   ON a.id = pa."aulaId"
LEFT JOIN "ResultadoQuiz" rq    ON a.id = rq."aulaId"
WHERE a.publicado = true
GROUP BY a.id, a.titulo, a."moduloId", m.titulo;

-- View: desempenho acadêmico por aluno (usada em relatórios)
CREATE OR REPLACE VIEW v_student_performance AS
SELECT
  u.id                                                                              AS aluno_id,
  u.nome,
  u.email,
  u.foto,
  u."ultimoAcesso"                                                                  AS ultimo_acesso,
  COUNT(DISTINCT pa.id)                                                             AS total_aulas_acessadas,
  COUNT(DISTINCT pa.id) FILTER (WHERE pa.concluido = true)                         AS aulas_concluidas,
  ROUND(AVG(pa."percentualAssistido")::NUMERIC, 2)                                  AS media_progresso,
  COUNT(DISTINCT ea.id)                                                             AS total_entregas,
  COUNT(DISTINCT ea.id) FILTER (WHERE ea.status = 'corrigido')                     AS entregas_corrigidas,
  ROUND(AVG(ea.nota)::NUMERIC, 2)                                                   AS media_notas,
  COUNT(DISTINCT pr.id)                                                             AS total_presencas,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.status = 'presente')                      AS presencas_presentes,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.status = 'parcial')                       AS presencas_parciais,
  ROUND(
    (
      COUNT(DISTINCT pr.id) FILTER (WHERE pr.status = 'presente') +
      COUNT(DISTINCT pr.id) FILTER (WHERE pr.status = 'parcial') * 0.5
    )::NUMERIC / NULLIF(COUNT(DISTINCT pr.id), 0) * 100,
    2
  )                                                                                 AS frequencia_percentual
FROM "User" u
LEFT JOIN "ProgressoAluno"   pa  ON u.id = pa."alunoId"
LEFT JOIN "EntregaAvaliacao" ea  ON u.id = ea."alunoId"
LEFT JOIN "Presenca"         pr  ON u.id = pr."alunoId"
WHERE u.papel = 'aluno' AND u.ativo = true
GROUP BY u.id, u.nome, u.email, u.foto, u."ultimoAcesso";

-- View: progresso por módulo por aluno
CREATE OR REPLACE VIEW v_module_progress AS
SELECT
  m.id                                                                          AS modulo_id,
  m.titulo                                                                      AS modulo_titulo,
  u.id                                                                          AS aluno_id,
  COUNT(DISTINCT a.id)                                                          AS total_aulas,
  COUNT(DISTINCT pa.id) FILTER (WHERE pa.concluido = true)                     AS aulas_concluidas,
  ROUND(
    COUNT(DISTINCT pa.id) FILTER (WHERE pa.concluido = true)::NUMERIC /
    NULLIF(COUNT(DISTINCT a.id), 0) * 100,
    2
  )                                                                             AS percentual_modulo,
  ROUND(AVG(pa."percentualAssistido")::NUMERIC, 2)                              AS media_assistido
FROM "Modulo" m
CROSS JOIN "User" u
LEFT JOIN "Aula" a          ON m.id = a."moduloId" AND a.publicado = true
LEFT JOIN "ProgressoAluno" pa ON a.id = pa."aulaId" AND u.id = pa."alunoId"
WHERE u.papel = 'aluno' AND m.ativo = true
GROUP BY m.id, m.titulo, u.id;

-- ─── 5. RPCs (Stored Functions) ──────────────────────────────────────────────

-- RPC: alunos com baixo engajamento (substitui groupBy + filter + sort no Node.js)
CREATE OR REPLACE FUNCTION get_low_progress_students(
  p_threshold FLOAT DEFAULT 20,
  p_limit     INT   DEFAULT 10
)
RETURNS TABLE(
  aluno_id        TEXT,
  nome            TEXT,
  email           TEXT,
  foto            TEXT,
  progresso_medio NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.nome,
    u.email,
    u.foto,
    ROUND(AVG(pa."percentualAssistido")::NUMERIC, 2) AS progresso_medio
  FROM "User" u
  JOIN "ProgressoAluno" pa ON u.id = pa."alunoId"
  WHERE u.papel = 'aluno' AND u.ativo = true
  GROUP BY u.id, u.nome, u.email, u.foto
  HAVING AVG(pa."percentualAssistido") < p_threshold
  ORDER BY progresso_medio ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- RPC: métricas do dashboard admin em uma única query
CREATE OR REPLACE FUNCTION get_admin_dashboard_metrics()
RETURNS TABLE(
  total_alunos       BIGINT,
  alunos_ativos_7d   BIGINT,
  aulas_publicadas   BIGINT,
  total_progressos   BIGINT,
  progressos_concluidos BIGINT,
  taxa_conclusao     NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM "User"          WHERE papel = 'aluno')::BIGINT,
    (SELECT COUNT(*) FROM "User"          WHERE papel = 'aluno'
                                            AND "ultimoAcesso" >= NOW() - INTERVAL '7 days')::BIGINT,
    (SELECT COUNT(*) FROM "Aula"          WHERE publicado = true)::BIGINT,
    (SELECT COUNT(*) FROM "ProgressoAluno")::BIGINT,
    (SELECT COUNT(*) FROM "ProgressoAluno" WHERE concluido = true)::BIGINT,
    ROUND(
      (SELECT COUNT(*) FROM "ProgressoAluno" WHERE concluido = true)::NUMERIC /
      NULLIF((SELECT COUNT(*) FROM "ProgressoAluno"), 0) * 100,
      2
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- RPC: stats de engajamento por aula (substitui groupBy duplo no admin dashboard)
CREATE OR REPLACE FUNCTION get_lesson_engagement_stats()
RETURNS TABLE(
  aula_id        TEXT,
  titulo         TEXT,
  total_alunos   BIGINT,
  media_conclusao NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.titulo,
    COUNT(DISTINCT pa."alunoId")::BIGINT,
    ROUND(AVG(pa."percentualAssistido")::NUMERIC, 2)
  FROM "Aula" a
  LEFT JOIN "ProgressoAluno" pa ON a.id = pa."aulaId"
  WHERE a.publicado = true
  GROUP BY a.id, a.titulo
  ORDER BY a."criadoEm" ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- RPC: relatório acadêmico completo (substitui query pesada em admin/relatorios)
CREATE OR REPLACE FUNCTION get_academic_report(
  p_page      INT DEFAULT 1,
  p_page_size INT DEFAULT 20
)
RETURNS TABLE(
  aluno_id             TEXT,
  nome                 TEXT,
  email                TEXT,
  foto                 TEXT,
  ultimo_acesso        TIMESTAMPTZ,
  aulas_concluidas     BIGINT,
  media_progresso      NUMERIC,
  total_entregas       BIGINT,
  entregas_corrigidas  BIGINT,
  media_notas          NUMERIC,
  frequencia_percentual NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.aluno_id,
    sp.nome,
    sp.email,
    sp.foto,
    sp.ultimo_acesso,
    sp.aulas_concluidas,
    sp.media_progresso,
    sp.total_entregas,
    sp.entregas_corrigidas,
    sp.media_notas,
    sp.frequencia_percentual
  FROM v_student_performance sp
  ORDER BY sp.nome ASC
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
END;
$$ LANGUAGE plpgsql STABLE;
