#!/bin/sh
set -eu

echo "Aplicando schema do banco antes de iniciar a API..."

FAILED_MIGRATION_NAME="${FAILED_MIGRATION_NAME:-20260322200000_db_optimizations}"

run_migrate_deploy() {
  npx prisma migrate deploy
}

ensure_dashboard_rpcs() {
  echo "Garantindo funcoes SQL do dashboard (fallback de compatibilidade)..."
  npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
CREATE OR REPLACE FUNCTION get_admin_dashboard_metrics()
RETURNS TABLE(
  total_alunos BIGINT,
  alunos_ativos_7d BIGINT,
  aulas_publicadas BIGINT,
  total_progressos BIGINT,
  progressos_concluidos BIGINT,
  taxa_conclusao NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM "User" WHERE papel = 'aluno')::BIGINT,
    (SELECT COUNT(*) FROM "User" WHERE papel = 'aluno' AND "ultimoAcesso" >= NOW() - INTERVAL '7 days')::BIGINT,
    (SELECT COUNT(*) FROM "Aula" WHERE publicado = true)::BIGINT,
    (SELECT COUNT(*) FROM "ProgressoAluno")::BIGINT,
    (SELECT COUNT(*) FROM "ProgressoAluno" WHERE concluido = true)::BIGINT,
    ROUND(
      (SELECT COUNT(*) FROM "ProgressoAluno" WHERE concluido = true)::NUMERIC /
      NULLIF((SELECT COUNT(*) FROM "ProgressoAluno"), 0) * 100,
      2
    );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_low_progress_students(
  p_threshold FLOAT DEFAULT 20,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(
  aluno_id TEXT,
  nome TEXT,
  email TEXT,
  foto TEXT,
  progresso_medio NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id::TEXT,
    u.nome::TEXT,
    u.email::TEXT,
    u.foto::TEXT,
    ROUND(COALESCE(AVG(pa."percentualAssistido"), 0)::NUMERIC, 2) AS progresso_medio
  FROM "User" u
  LEFT JOIN "ProgressoAluno" pa ON u.id = pa."alunoId"
  WHERE u.papel = 'aluno' AND u.ativo = true
  GROUP BY u.id, u.nome, u.email, u.foto
  HAVING COALESCE(AVG(pa."percentualAssistido"), 0) < p_threshold
  ORDER BY progresso_medio ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_lesson_engagement_stats()
RETURNS TABLE(
  aula_id TEXT,
  titulo TEXT,
  total_alunos BIGINT,
  media_conclusao NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id::TEXT,
    a.titulo::TEXT,
    COUNT(DISTINCT pa."alunoId")::BIGINT,
    ROUND(COALESCE(AVG(pa."percentualAssistido"), 0)::NUMERIC, 2)
  FROM "Aula" a
  LEFT JOIN "ProgressoAluno" pa ON a.id = pa."aulaId"
  WHERE a.publicado = true
  GROUP BY a.id, a.titulo, a."criadoEm"
  ORDER BY a."criadoEm" ASC;
END;
$$ LANGUAGE plpgsql STABLE;
SQL
}

repair_alerta_tipo_enum() {
  echo "Aplicando reparo de compatibilidade para AlertaSeguranca.tipo..."
  npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AlertaSeguranca'
      AND column_name = 'tipo'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_type
      WHERE typname = 'TipoAlertaSeguranca'
    ) THEN
      CREATE TYPE "TipoAlertaSeguranca" AS ENUM ('novo_ip', 'login_falho', 'senha_alterada');
    END IF;

    UPDATE "AlertaSeguranca"
    SET "tipo" = 'login_falho'
    WHERE COALESCE("tipo"::text, '') NOT IN ('novo_ip', 'login_falho', 'senha_alterada');

    ALTER TABLE "AlertaSeguranca"
      ALTER COLUMN "tipo" TYPE "TipoAlertaSeguranca"
      USING "tipo"::text::"TipoAlertaSeguranca";
  END IF;
END $$;
SQL
}

if run_migrate_deploy; then
  echo "Prisma migrate deploy concluido."
else
  echo "Prisma migrate deploy falhou. Iniciando fluxo de reparo para liberar o boot."
  npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION_NAME" || true
  repair_alerta_tipo_enum || true
  npx prisma db push --skip-generate --accept-data-loss || true
  npx prisma migrate resolve --applied "$FAILED_MIGRATION_NAME" || true
  run_migrate_deploy || true
fi

ensure_dashboard_rpcs || true

exec node dist/src/index.js
