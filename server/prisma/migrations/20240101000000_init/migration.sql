-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'aluno',
    "foto" TEXT,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoAcesso" TIMESTAMP(3),
    "compartilhaDadosIA" BOOLEAN NOT NULL DEFAULT false,
    "aiCreditosDisponiveis" INTEGER NOT NULL DEFAULT 3,
    "aiCreditosUltimaRecarga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modulo" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "capaUrl" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Modulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aula" (
    "id" TEXT NOT NULL,
    "moduloId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "urlVideo" TEXT,
    "thumbnail" TEXT,
    "duracaoSegundos" INTEGER NOT NULL DEFAULT 0,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "dataPublicacao" TIMESTAMP(3),
    "transcricao" TEXT,
    "resumo" TEXT,
    "pontosChave" TEXT,
    "versiculos" TEXT,
    "glossario" TEXT,
    "statusIA" TEXT NOT NULL DEFAULT 'pendente',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'trabalho',
    "formato" TEXT NOT NULL DEFAULT 'discursiva',
    "moduloId" TEXT,
    "aulaId" TEXT,
    "dataLimite" TIMESTAMP(3),
    "notaMaxima" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "permiteArquivo" BOOLEAN NOT NULL DEFAULT true,
    "permiteTexto" BOOLEAN NOT NULL DEFAULT false,
    "questoesObjetivas" TEXT,
    "resultadoImediato" BOOLEAN NOT NULL DEFAULT true,
    "tempoLimiteMinutos" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaAvaliacao" (
    "id" TEXT NOT NULL,
    "avaliacaoId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "respostaTexto" TEXT,
    "arquivoUrl" TEXT,
    "respostasObjetivas" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "nota" DOUBLE PRECISION,
    "totalQuestoes" INTEGER,
    "acertosObjetivos" INTEGER,
    "percentualObjetivo" DOUBLE PRECISION,
    "comentarioCorrecao" TEXT,
    "enviadoEm" TIMESTAMP(3),
    "corrigidoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntregaAvaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "aulaId" TEXT NOT NULL,
    "questoes" TEXT NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressoAluno" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "aulaId" TEXT NOT NULL,
    "percentualAssistido" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tempoTotalSegundos" INTEGER NOT NULL DEFAULT 0,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "dataInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataConclusao" TIMESTAMP(3),
    "posicaoAtualSegundos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vezesQueParou" INTEGER NOT NULL DEFAULT 0,
    "sessoes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProgressoAluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultadoQuiz" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "aulaId" TEXT NOT NULL,
    "respostas" TEXT NOT NULL,
    "pontuacao" INTEGER NOT NULL,
    "totalQuestoes" INTEGER NOT NULL,
    "feitoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultadoQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "urlArquivo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'pdf',
    "categoria" TEXT NOT NULL DEFAULT 'geral',
    "permiteDownload" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialAula" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "aulaId" TEXT NOT NULL,

    CONSTRAINT "MaterialAula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presenca" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "aulaId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ausente',
    "metodo" TEXT NOT NULL DEFAULT 'digital',
    "percentual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Presenca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnotacaoAluno" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "aulaId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL DEFAULT '',
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnotacaoAluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginHistorico" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ip" TEXT,
    "dispositivo" TEXT,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sucesso" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LoginHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteracaoIA" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "aulaId" TEXT,
    "pergunta" TEXT NOT NULL,
    "resposta" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteracaoIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroMudancaConteudo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "usuarioNome" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "entidadeTitulo" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "detalhes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroMudancaConteudo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EntregaAvaliacao_avaliacaoId_alunoId_key" ON "EntregaAvaliacao"("avaliacaoId", "alunoId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressoAluno_alunoId_aulaId_key" ON "ProgressoAluno"("alunoId", "aulaId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialAula_materialId_aulaId_key" ON "MaterialAula"("materialId", "aulaId");

-- CreateIndex
CREATE UNIQUE INDEX "Presenca_alunoId_aulaId_key" ON "Presenca"("alunoId", "aulaId");

-- CreateIndex
CREATE UNIQUE INDEX "AnotacaoAluno_alunoId_aulaId_key" ON "AnotacaoAluno"("alunoId", "aulaId");

-- AddForeignKey
ALTER TABLE "Aula" ADD CONSTRAINT "Aula_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "Modulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "Modulo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "Aula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaAvaliacao" ADD CONSTRAINT "EntregaAvaliacao_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "Avaliacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaAvaliacao" ADD CONSTRAINT "EntregaAvaliacao_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "Aula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressoAluno" ADD CONSTRAINT "ProgressoAluno_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressoAluno" ADD CONSTRAINT "ProgressoAluno_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "Aula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultadoQuiz" ADD CONSTRAINT "ResultadoQuiz_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultadoQuiz" ADD CONSTRAINT "ResultadoQuiz_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "Aula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAula" ADD CONSTRAINT "MaterialAula_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAula" ADD CONSTRAINT "MaterialAula_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "Aula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presenca" ADD CONSTRAINT "Presenca_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presenca" ADD CONSTRAINT "Presenca_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "Aula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnotacaoAluno" ADD CONSTRAINT "AnotacaoAluno_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnotacaoAluno" ADD CONSTRAINT "AnotacaoAluno_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "Aula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginHistorico" ADD CONSTRAINT "LoginHistorico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteracaoIA" ADD CONSTRAINT "InteracaoIA_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteracaoIA" ADD CONSTRAINT "InteracaoIA_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "Aula"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroMudancaConteudo" ADD CONSTRAINT "RegistroMudancaConteudo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
