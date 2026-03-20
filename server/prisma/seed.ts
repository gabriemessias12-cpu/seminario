import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { processAIPipeline } from '../src/services/ai-mock.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.loginHistorico.deleteMany();
  await prisma.anotacaoAluno.deleteMany();
  await prisma.notificacao.deleteMany();
  await prisma.presenca.deleteMany();
  await prisma.resultadoQuiz.deleteMany();
  await prisma.progressoAluno.deleteMany();
  await prisma.materialAula.deleteMany();
  await prisma.material.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.aula.deleteMany();
  await prisma.modulo.deleteMany();
  await prisma.user.deleteMany();

  const senhaAluno = await bcrypt.hash('123456', 10);
  const senhaAdmin = await bcrypt.hash('admin123', 10);

  // Create admin users
  const pastor = await prisma.user.create({
    data: {
      nome: 'Pr. Ricardo Silva',
      email: 'pastor@vinhanova.com',
      senhaHash: senhaAdmin,
      papel: 'pastor',
      telefone: '(11) 99999-0001',
      ultimoAcesso: new Date()
    }
  });

  const admin = await prisma.user.create({
    data: {
      nome: 'Maria Santos (Secretária)',
      email: 'admin@vinhanova.com',
      senhaHash: senhaAdmin,
      papel: 'admin',
      telefone: '(11) 99999-0002',
      ultimoAcesso: new Date()
    }
  });

  // Create students
  const estudantes = [];
  const nomesAlunos = [
    { nome: 'João Pedro Oliveira', email: 'aluno1@vinhanova.com', tel: '(11) 99999-1001' },
    { nome: 'Ana Clara Rodrigues', email: 'aluno2@vinhanova.com', tel: '(11) 99999-1002' },
    { nome: 'Lucas Mendes Costa', email: 'aluno3@vinhanova.com', tel: '(11) 99999-1003' },
    { nome: 'Priscila Fernandes Lima', email: 'aluno4@vinhanova.com', tel: '(11) 99999-1004' },
    { nome: 'Daniel Souza Almeida', email: 'aluno5@vinhanova.com', tel: '(11) 99999-1005' }
  ];

  for (const a of nomesAlunos) {
    const aluno = await prisma.user.create({
      data: {
        nome: a.nome,
        email: a.email,
        senhaHash: senhaAluno,
        papel: 'aluno',
        telefone: a.tel,
        ultimoAcesso: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        compartilhaDadosIA: a.email === 'aluno1@vinhanova.com' || a.email === 'aluno2@vinhanova.com',
        aiCreditosDisponiveis: a.email === 'aluno1@vinhanova.com' || a.email === 'aluno2@vinhanova.com' ? 8 : 3
      }
    });
    estudantes.push(aluno);
  }

  // Create modules
  const modulos = await Promise.all([
    prisma.modulo.create({
      data: { titulo: 'Módulo 1 — Fundamentos da Fé', descricao: 'Introdução à teologia cristã e bases bíblicas fundamentais.', ordem: 1 }
    }),
    prisma.modulo.create({
      data: { titulo: 'Módulo 2 — Hermenêutica Bíblica', descricao: 'Princípios e métodos de interpretação das Escrituras Sagradas.', ordem: 2 }
    }),
    prisma.modulo.create({
      data: { titulo: 'Módulo 3 — Teologia Pastoral', descricao: 'Formação prática para o ministério pastoral e liderança eclesiástica.', ordem: 3 }
    })
  ]);

  // Create lessons for each module
  const aulasData = [
    // Module 1
    { moduloId: modulos[0].id, titulo: 'Introdução à Teologia Cristã', descricao: 'Visão panorâmica da teologia e suas disciplinas fundamentais.' },
    { moduloId: modulos[0].id, titulo: 'A Doutrina de Deus (Teologia Própria)', descricao: 'Estudo dos atributos e natureza de Deus conforme revelados nas Escrituras.' },
    { moduloId: modulos[0].id, titulo: 'Cristologia — A Pessoa de Jesus Cristo', descricao: 'Análise da natureza divina e humana de Jesus Cristo e sua obra redentora.' },
    // Module 2
    { moduloId: modulos[1].id, titulo: 'Princípios de Interpretação Bíblica', descricao: 'Fundamentos da hermenêutica e regras para interpretação correta dos textos sagrados.' },
    { moduloId: modulos[1].id, titulo: 'Exegese do Antigo Testamento', descricao: 'Métodos e ferramentas para análise dos textos do Antigo Testamento.' },
    { moduloId: modulos[1].id, titulo: 'Exegese do Novo Testamento', descricao: 'Métodos e ferramentas para análise dos textos do Novo Testamento em grego koiné.' },
    // Module 3
    { moduloId: modulos[2].id, titulo: 'O Chamado Pastoral', descricao: 'Reflexão sobre a vocação ministerial e responsabilidades do pastor.' },
    { moduloId: modulos[2].id, titulo: 'Aconselhamento Bíblico', descricao: 'Princípios bíblicos para cuidado pastoral e aconselhamento de membros.' },
    { moduloId: modulos[2].id, titulo: 'Liderança Eclesiástica', descricao: 'Modelos bíblicos de liderança e gestão da comunidade de fé.' }
  ];

  const aulas = [];
  for (const aulaData of aulasData) {
    const moduloAtual = modulos.find((modulo) => modulo.id === aulaData.moduloId);
    const aula = await prisma.aula.create({
      data: {
        ...aulaData,
        duracaoSegundos: 240 + Math.floor(Math.random() * 180),
        publicado: true,
        dataPublicacao: new Date(),
        statusIA: 'processando'
      }
    });

    // Generate AI content
    const aiResult = await processAIPipeline(aula.id, aula.titulo, aula.descricao || undefined, {
      modulo: moduloAtual?.titulo
    });
    await prisma.aula.update({
      where: { id: aula.id },
      data: {
        transcricao: aiResult.transcricao,
        resumo: aiResult.resumo,
        pontosChave: aiResult.pontosChave,
        versiculos: aiResult.versiculos,
        glossario: aiResult.glossario,
        statusIA: 'concluido'
      }
    });

    await prisma.quiz.create({
      data: { aulaId: aula.id, questoes: aiResult.quiz }
    });

    aulas.push(aula);
  }

  // Create progress for students
  for (const aluno of estudantes) {
    // Each student has progress on some lessons
    const numAulas = 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < Math.min(numAulas, aulas.length); i++) {
      const percentual = Math.min(100, 20 + Math.random() * 80);
      const concluido = percentual >= 95;

      await prisma.progressoAluno.create({
        data: {
          alunoId: aluno.id,
          aulaId: aulas[i].id,
          percentualAssistido: Math.round(percentual),
          tempoTotalSegundos: Math.floor(aulas[i].duracaoSegundos * (percentual / 100)),
          concluido,
          posicaoAtualSegundos: Math.floor(aulas[i].duracaoSegundos * (percentual / 100)),
          dataConclusao: concluido ? new Date() : null,
          vezesQueParou: Math.floor(Math.random() * 10),
          sessoes: 1 + Math.floor(Math.random() * 3)
        }
      });

      // Attendance
      const status = percentual >= 70 ? 'presente' : percentual >= 30 ? 'parcial' : 'ausente';
      await prisma.presenca.create({
        data: {
          alunoId: aluno.id,
          aulaId: aulas[i].id,
          status,
          percentual: Math.round(percentual)
        }
      });

      // Quiz results for completed lessons
      if (concluido) {
        const pontuacao = 3 + Math.floor(Math.random() * 3);
        await prisma.resultadoQuiz.create({
          data: {
            alunoId: aluno.id,
            aulaId: aulas[i].id,
            respostas: '[]',
            pontuacao,
            totalQuestoes: 5
          }
        });
      }
    }
  }

  // Create materials
  const materialTeologia = await prisma.material.create({
    data: {
      titulo: 'Introdução à Teologia Sistemática',
      descricao: 'Apostila completa sobre os fundamentos da teologia cristã.',
      urlArquivo: '/uploads/materials/teologia-sistematica.pdf',
      tipo: 'pdf',
      categoria: 'teológico',
      permiteDownload: true
    }
  });

  const materialHermeneutica = await prisma.material.create({
    data: {
      titulo: 'Guia de Hermenêutica Bíblica',
      descricao: 'Manual prático de interpretação das Escrituras.',
      urlArquivo: '/uploads/materials/hermeneutica.pdf',
      tipo: 'pdf',
      categoria: 'bíblico',
      permiteDownload: false
    }
  });

  const materialCronologia = await prisma.material.create({
    data: {
      titulo: 'Mapa Cronológico da Bíblia',
      descricao: 'Linha do tempo dos eventos bíblicos organizados cronologicamente.',
      urlArquivo: '/uploads/materials/cronologia.pdf',
      tipo: 'pdf',
      categoria: 'histórico',
      permiteDownload: true
    }
  });

  await prisma.materialAula.createMany({
    data: [
      { materialId: materialTeologia.id, aulaId: aulas[0].id },
      { materialId: materialHermeneutica.id, aulaId: aulas[3].id },
      { materialId: materialCronologia.id, aulaId: aulas[6].id }
    ]
  });

  // Notifications
  for (const aluno of estudantes) {
    await prisma.notificacao.create({
      data: {
        alunoId: aluno.id,
        titulo: 'Bem-vindo ao Seminário Vinha Nova!',
        mensagem: 'Que alegria ter você conosco! Comece sua jornada teológica assistindo a primeira aula do Módulo 1.'
      }
    });

    await prisma.notificacao.create({
      data: {
        alunoId: aluno.id,
        titulo: 'Nova aula disponível',
        mensagem: 'A aula "Liderança Eclesiástica" do Módulo 3 já está disponível. Confira!'
      }
    });
  }

  // Login history
  for (const aluno of estudantes) {
    for (let i = 0; i < 3; i++) {
      await prisma.loginHistorico.create({
        data: {
          usuarioId: aluno.id,
          ip: '192.168.1.' + Math.floor(Math.random() * 254),
          dispositivo: 'Mozilla/5.0 Chrome/120.0',
          dataHora: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
          sucesso: true
        }
      });
    }
  }

  console.log('Seed complete.');
  console.log('');
  console.log('Credentials:');
  console.log('   Pastor:  pastor@vinhanova.com / admin123');
  console.log('   Admin:   admin@vinhanova.com / admin123');
  console.log('   Alunos:  aluno1@vinhanova.com / 123456');
  console.log('            aluno2@vinhanova.com / 123456');
  console.log('            aluno3@vinhanova.com / 123456');
  console.log('            aluno4@vinhanova.com / 123456');
  console.log('            aluno5@vinhanova.com / 123456');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
