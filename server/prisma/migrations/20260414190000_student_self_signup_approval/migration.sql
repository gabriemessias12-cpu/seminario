-- Add student registration approval status and profile fields
DO $$
BEGIN
  CREATE TYPE "StatusCadastroAluno" AS ENUM ('pendente', 'aprovado', 'rejeitado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "statusCadastro" "StatusCadastroAluno" NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS "dataNascimento" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "membroVinha" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "batizado" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "User_statusCadastro_idx" ON "User"("statusCadastro");

