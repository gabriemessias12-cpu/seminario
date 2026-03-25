-- Add required/optional flag for modules
ALTER TABLE "Modulo"
ADD COLUMN "obrigatorio" BOOLEAN NOT NULL DEFAULT true;

-- Allow materials to be linked directly to a module
ALTER TABLE "Material"
ADD COLUMN "moduloId" TEXT;

CREATE INDEX "Material_moduloId_idx" ON "Material"("moduloId");

ALTER TABLE "Material"
ADD CONSTRAINT "Material_moduloId_fkey"
FOREIGN KEY ("moduloId") REFERENCES "Modulo"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
