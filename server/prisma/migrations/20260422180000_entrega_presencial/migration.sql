-- Add MetodoEntrega enum and track presencial deliveries
DO $$
BEGIN
  CREATE TYPE "MetodoEntrega" AS ENUM ('digital', 'presencial');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "EntregaAvaliacao"
  ADD COLUMN IF NOT EXISTS "metodoEntrega" "MetodoEntrega" NOT NULL DEFAULT 'digital';
