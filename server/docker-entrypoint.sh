#!/bin/sh
set -eu

echo "Aplicando schema do banco antes de iniciar a API..."

FAILED_MIGRATION_NAME="${FAILED_MIGRATION_NAME:-20260322200000_db_optimizations}"

run_migrate_deploy() {
  npx prisma migrate deploy
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

exec node dist/src/index.js
