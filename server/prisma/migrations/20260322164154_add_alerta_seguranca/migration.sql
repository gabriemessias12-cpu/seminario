-- CreateTable
CREATE TABLE "AlertaSeguranca" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "ip" TEXT,
    "dispositivo" TEXT,
    "lido" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertaSeguranca_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AlertaSeguranca" ADD CONSTRAINT "AlertaSeguranca_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
