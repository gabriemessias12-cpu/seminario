import { loadEnvFiles } from '../config/env.js';
import { logger } from '../utils/logger.js';

loadEnvFiles();

const OPENAI_API_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

type Verse = {
  referencia: string;
  texto: string;
};

type GlossaryItem = {
  termo: string;
  definicao: string;
};

type QuizQuestion = {
  pergunta: string;
  alternativas: Array<{ texto: string; correta: boolean }>;
  explicacao: string;
};

type PipelinePayload = {
  transcricao: string;
  resumo: string;
  pontosChave: string[];
  versiculos: Verse[];
  glossario: GlossaryItem[];
  quiz: QuizQuestion[];
};

type LessonAssistantPayload = {
  resposta: string;
  destaques: string[];
  proximosPassos: string[];
  nivelConfianca: 'alta' | 'media' | 'baixa';
};

type PipelineInput = {
  aulaId: string;
  titulo: string;
  descricao?: string;
  modulo?: string;
  materiais?: Array<{ titulo: string; descricao?: string | null }>;
};

type AssistantInput = {
  aulaId: string;
  pergunta: string;
  titulo: string;
  descricao?: string | null;
  modulo?: string | null;
  transcricao?: string | null;
  resumo?: string | null;
  pontosChave?: string[];
  versiculos?: Verse[];
  glossario?: GlossaryItem[];
  materiais?: Array<{ titulo: string; descricao?: string | null }>;
};

const pipelineSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    transcricao: { type: 'string' },
    resumo: { type: 'string' },
    pontosChave: {
      type: 'array',
      items: { type: 'string' },
      minItems: 6,
      maxItems: 10
    },
    versiculos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          referencia: { type: 'string' },
          texto: { type: 'string' }
        },
        required: ['referencia', 'texto']
      },
      minItems: 3,
      maxItems: 6
    },
    glossario: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          termo: { type: 'string' },
          definicao: { type: 'string' }
        },
        required: ['termo', 'definicao']
      },
      minItems: 4,
      maxItems: 6
    },
    quiz: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pergunta: { type: 'string' },
          alternativas: {
            type: 'array',
            minItems: 4,
            maxItems: 4,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                texto: { type: 'string' },
                correta: { type: 'boolean' }
              },
              required: ['texto', 'correta']
            }
          },
          explicacao: { type: 'string' }
        },
        required: ['pergunta', 'alternativas', 'explicacao']
      }
    }
  },
  required: ['transcricao', 'resumo', 'pontosChave', 'versiculos', 'glossario', 'quiz']
};

const assistantSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    resposta: { type: 'string' },
    destaques: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 5
    },
    proximosPassos: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 4
    },
    nivelConfianca: {
      type: 'string',
      enum: ['alta', 'media', 'baixa']
    }
  },
  required: ['resposta', 'destaques', 'proximosPassos', 'nivelConfianca']
};

function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function compactText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function truncateText(value: string | null | undefined, maxLength: number) {
  const normalized = compactText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function keywordMap() {
  return [
    {
      terms: ['cristologia', 'cristo', 'jesus'],
      verses: [
        { referencia: 'João 1:1', texto: 'No princípio era o Verbo, e o Verbo estava com Deus, e o Verbo era Deus.' },
        { referencia: 'Colossenses 1:15', texto: 'Ele é a imagem do Deus invisível, o primogênito de toda a criação.' },
        { referencia: 'Hebreus 1:3', texto: 'Ele, que é o resplendor da glória e a expressão exata do seu Ser.' }
      ],
      glossary: [
        { termo: 'Encarnação', definicao: 'Doutrina segundo a qual o Filho eterno de Deus assumiu natureza humana sem deixar de ser Deus.' },
        { termo: 'União hipostática', definicao: 'Expressão teológica que descreve a união das naturezas divina e humana na única pessoa de Cristo.' }
      ]
    },
    {
      terms: ['deus', 'teologia própria', 'atributos'],
      verses: [
        { referencia: 'Êxodo 34:6', texto: 'Senhor, Senhor Deus compassivo, clemente e longânimo.' },
        { referencia: 'Isaías 40:28', texto: 'O Senhor é o eterno Deus, o Criador dos fins da terra.' },
        { referencia: 'Salmo 90:2', texto: 'De eternidade a eternidade, tu és Deus.' }
      ],
      glossary: [
        { termo: 'Onisciência', definicao: 'Atributo divino que afirma que Deus conhece plenamente todas as coisas.' },
        { termo: 'Imutabilidade', definicao: 'Perfeição divina que expressa que Deus não muda em seu ser, caráter e promessas.' }
      ]
    },
    {
      terms: ['hermenêutica', 'interpretação', 'exegese'],
      verses: [
        { referencia: 'Neemias 8:8', texto: 'Leram no livro, na Lei de Deus, claramente, dando explicações.' },
        { referencia: '2 Timóteo 2:15', texto: 'Procura apresentar-te a Deus aprovado, manejando bem a palavra da verdade.' },
        { referencia: 'Lucas 24:27', texto: 'Expunha-lhes o que a seu respeito constava em todas as Escrituras.' }
      ],
      glossary: [
        { termo: 'Hermenêutica', definicao: 'Disciplina que estuda princípios e métodos de interpretação das Escrituras.' },
        { termo: 'Exegese', definicao: 'Análise do texto bíblico em seu contexto para compreender o sentido pretendido.' }
      ]
    },
    {
      terms: ['pastoral', 'aconselhamento', 'liderança', 'lideranca'],
      verses: [
        { referencia: '1 Pedro 5:2', texto: 'Pastoreai o rebanho de Deus que há entre vós.' },
        { referencia: 'Gálatas 6:2', texto: 'Levai as cargas uns dos outros e, assim, cumprireis a lei de Cristo.' },
        { referencia: 'Marcos 10:45', texto: 'O Filho do Homem não veio para ser servido, mas para servir.' }
      ],
      glossary: [
        { termo: 'Cuidado pastoral', definicao: 'Ministério de condução, proteção e acompanhamento espiritual do povo de Deus.' },
        { termo: 'Aconselhamento bíblico', definicao: 'Aplicação pastoral das Escrituras às lutas e decisões da vida cristã.' }
      ]
    }
  ];
}

function getMatchedResource(title: string, description: string) {
  const haystack = `${title} ${description}`.toLowerCase();
  return keywordMap().find((entry) => entry.terms.some((term) => haystack.includes(term)));
}

function extractFocusPoints(title: string, description: string) {
  const normalizedDescription = compactText(description);
  const sentences = normalizedDescription
    .split(/[.!?]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const base = [
    `O tema central da aula é "${title}".`,
    normalizedDescription
      ? `A descrição destaca que ${normalizedDescription.charAt(0).toLowerCase()}${normalizedDescription.slice(1)}.`
      : `A aula apresenta uma visão introdutória sobre ${title.toLowerCase()}.`
  ];

  for (const sentence of sentences.slice(0, 4)) {
    base.push(sentence.endsWith('.') ? sentence : `${sentence}.`);
  }

  while (base.length < 6) {
    base.push(`A aplicação pastoral e acadêmica de ${title.toLowerCase()} exige leitura bíblica cuidadosa, clareza doutrinária e disciplina espiritual.`);
  }

  return base.slice(0, 8);
}

function buildFallbackPipeline(input: PipelineInput): PipelinePayload {
  const title = compactText(input.titulo);
  const description = compactText(input.descricao);
  const focusPoints = extractFocusPoints(title, description);
  const matched = getMatchedResource(title, description);

  const versiculos = matched?.verses || [
    { referencia: 'Salmo 119:105', texto: 'Lâmpada para os meus pés é a tua palavra e luz para o meu caminho.' },
    { referencia: '2 Timóteo 3:16', texto: 'Toda a Escritura é inspirada por Deus e útil para o ensino.' },
    { referencia: 'Tiago 1:5', texto: 'Se, porém, algum de vós necessita de sabedoria, peça-a a Deus.' }
  ];

  const glossario = [
    ...(matched?.glossary || []),
    { termo: 'Doutrina', definicao: `Ensino bíblico sistematizado que ajuda a compreender ${title.toLowerCase()} com fidelidade.` },
    { termo: 'Aplicação', definicao: `Movimento de levar o conteúdo de ${title.toLowerCase()} para a vida, o ministério e a prática da igreja local.` },
    { termo: 'Discernimento', definicao: 'Capacidade espiritual e bíblica de avaliar ideias, textos e decisões à luz das Escrituras.' }
  ].slice(0, 5);

  const quiz: QuizQuestion[] = [
    {
      pergunta: `Qual é o tema principal tratado na aula "${title}"?`,
      alternativas: [
        { texto: title, correta: true },
        { texto: 'História da filosofia medieval', correta: false },
        { texto: 'Administração financeira eclesiástica', correta: false },
        { texto: 'Panorama político do Império Romano', correta: false }
      ],
      explicacao: `A aula foi estruturada em torno de ${title.toLowerCase()}, conforme o título e a descrição apresentados.`
    },
    {
      pergunta: 'Qual objetivo melhor resume a proposta da aula?',
      alternativas: [
        { texto: description || `Apresentar os fundamentos relacionados a ${title.toLowerCase()}.`, correta: true },
        { texto: 'Substituir a leitura bíblica por opiniões pessoais.', correta: false },
        { texto: 'Ensinar apenas memorização de datas históricas.', correta: false },
        { texto: 'Eliminar a necessidade de interpretação do texto bíblico.', correta: false }
      ],
      explicacao: 'A resposta correta retoma diretamente o objetivo explicitado na descrição da aula.'
    },
    {
      pergunta: 'Qual postura o aluno deve adotar ao estudar esse conteúdo?',
      alternativas: [
        { texto: 'Ler o conteúdo com atenção, reflexão bíblica e aplicação prática.', correta: true },
        { texto: 'Tratar a aula como informação desconectada da vida cristã.', correta: false },
        { texto: 'Ignorar o contexto bíblico e histórico.', correta: false },
        { texto: 'Priorizar opiniões pessoais acima das Escrituras.', correta: false }
      ],
      explicacao: 'O estudo teológico saudável exige fidelidade bíblica, reflexão e aplicação à vida e ao ministério.'
    },
    {
      pergunta: 'Qual afirmação está alinhada ao desenvolvimento da aula?',
      alternativas: [
        { texto: focusPoints[2], correta: true },
        { texto: 'A aula defende que doutrina e prática nunca se relacionam.', correta: false },
        { texto: 'A aula ensina que o contexto bíblico deve ser descartado.', correta: false },
        { texto: 'A aula conclui que a Bíblia não é suficiente para orientar o ministério.', correta: false }
      ],
      explicacao: 'A alternativa correta deriva diretamente dos pontos centrais identificados a partir do título e da descrição.'
    },
    {
      pergunta: 'Qual resultado esperado do estudo desta aula é o mais adequado?',
      alternativas: [
        { texto: `Compreender melhor ${title.toLowerCase()} e aplicar o aprendizado de forma bíblica e responsável.`, correta: true },
        { texto: 'Trocar o conteúdo da aula por especulações sem base bíblica.', correta: false },
        { texto: 'Abandonar a análise do texto e depender só de experiência pessoal.', correta: false },
        { texto: 'Reduzir o estudo teológico a impressões superficiais.', correta: false }
      ],
      explicacao: `O objetivo do estudo é aprofundar a compreensão de ${title.toLowerCase()} de forma fiel, prática e ministerial.`
    }
  ];

  return {
    transcricao: [
      `Nesta aula do Seminário Vinha Nova, estudamos o tema "${title}".`,
      description || `O conteúdo foi organizado para oferecer uma base sólida sobre ${title.toLowerCase()}.`,
      '',
      'Ao longo da exposição, o professor destaca que o estudo teológico deve nascer do texto bíblico, considerar o contexto e caminhar para a aplicação prática.',
      '',
      ...focusPoints.map((point) => `- ${point}`),
      '',
      'A aula conclui reforçando que aprender este conteúdo não é apenas acumular informação, mas formar convicções bíblicas que sustentem a vida cristã, o serviço e a liderança espiritual.'
    ].join('\n'),
    resumo: [
      `A aula apresenta uma síntese introdutória e aplicada sobre ${title.toLowerCase()}.`,
      description || `O conteúdo organiza os fundamentos essenciais do tema para estudo individual, discipulado e ministério.`,
      'O desenvolvimento parte de princípios bíblicos, busca clareza doutrinária e conduz o aluno a perceber como o tema afeta leitura, prática e testemunho cristão.',
      `Os pontos principais ajudam a revisar os conceitos centrais de ${title.toLowerCase()} sem perder a conexão com a vida da igreja.`,
      'Ao final, o aluno é encorajado a continuar o estudo com atenção ao texto bíblico, oração, humildade e aplicação concreta.'
    ].join('\n\n'),
    pontosChave: focusPoints,
    versiculos,
    glossario,
    quiz
  };
}

function buildFallbackAssistant(input: AssistantInput): LessonAssistantPayload {
  const points = (input.pontosChave || []).filter(Boolean);
  const verses = (input.versiculos || []).filter(Boolean);
  const materiais = (input.materiais || []).filter(Boolean);

  const resposta = [
    `Pergunta recebida: "${compactText(input.pergunta)}".`,
    `Com base na aula "${compactText(input.titulo)}", a resposta mais segura é que o tema deve ser entendido a partir do conteúdo apresentado, da descrição da aula e dos pontos-chave já gerados pelo sistema.`,
    input.resumo ? truncateText(input.resumo, 420) : `A aula enfatiza ${input.titulo.toLowerCase()} como eixo central do estudo.`,
    points[0] ? `O primeiro destaque da aula resume bem a direção do conteúdo: ${points[0]}` : 'O estudo deve permanecer fiel ao texto bíblico e ao objetivo pedagógico da aula.'
  ].join(' ');

  const destaques = [
    points[0] || `A aula gira em torno de ${input.titulo.toLowerCase()}.`,
    points[1] || 'O conteúdo precisa ser lido em chave bíblica, pastoral e prática.',
    verses[0] ? `${verses[0].referencia}: ${verses[0].texto}` : 'Revise os versículos relacionados na aba da aula.'
  ];

  const proximosPassos = [
    'Releia o resumo da aula e compare com sua pergunta.',
    materiais[0] ? `Abra o material "${materiais[0].titulo}" para aprofundar o tema.` : 'Reassista aos trechos centrais da aula antes de responder ao questionário.',
    'Anote em poucas linhas como esse conteúdo se aplica ao seu contexto ministerial.'
  ];

  return {
    resposta,
    destaques,
    proximosPassos,
    nivelConfianca: input.transcricao || input.resumo ? 'alta' : 'media'
  };
}

async function callOpenAIStructured<T>(name: string, schema: Record<string, unknown>, systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_NAO_CONFIGURADA');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${OPENAI_API_URL}/responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        text: {
          format: {
            type: 'json_schema',
            name,
            strict: true,
            schema
          }
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OPENAI_HTTP_${response.status}: ${errorText}`);
    }

    const payload = await response.json();
    if (payload.output_parsed) {
      return payload.output_parsed as T;
    }

    if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
      return JSON.parse(payload.output_text) as T;
    }

    for (const item of payload.output || []) {
      for (const content of item.content || []) {
        if (typeof content.text === 'string' && content.text.trim()) {
          return JSON.parse(content.text) as T;
        }

        if (typeof content.output_text === 'string' && content.output_text.trim()) {
          return JSON.parse(content.output_text) as T;
        }
      }
    }

    throw new Error('OPENAI_SEM_SAIDA_ESTRUTURADA');
  } finally {
    clearTimeout(timeout);
  }
}

function serializePipeline(payload: PipelinePayload) {
  return {
    transcricao: payload.transcricao,
    resumo: payload.resumo,
    pontosChave: JSON.stringify(payload.pontosChave),
    versiculos: JSON.stringify(payload.versiculos),
    glossario: JSON.stringify(payload.glossario),
    quiz: JSON.stringify(payload.quiz)
  };
}

const enrichmentSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    resumo: { type: 'string' },
    pontosChave: {
      type: 'array',
      items: { type: 'string' },
      minItems: 6,
      maxItems: 10
    },
    versiculos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          referencia: { type: 'string' },
          texto: { type: 'string' }
        },
        required: ['referencia', 'texto']
      },
      minItems: 3,
      maxItems: 6
    },
    glossario: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          termo: { type: 'string' },
          definicao: { type: 'string' }
        },
        required: ['termo', 'definicao']
      },
      minItems: 4,
      maxItems: 6
    },
    quiz: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pergunta: { type: 'string' },
          alternativas: {
            type: 'array',
            minItems: 4,
            maxItems: 4,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                texto: { type: 'string' },
                correta: { type: 'boolean' }
              },
              required: ['texto', 'correta']
            }
          },
          explicacao: { type: 'string' }
        },
        required: ['pergunta', 'alternativas', 'explicacao']
      }
    }
  },
  required: ['resumo', 'pontosChave', 'versiculos', 'glossario', 'quiz']
};

type EnrichmentPayload = Omit<PipelinePayload, 'transcricao'>;

function buildFallbackEnrichment(titulo: string, transcricao: string): EnrichmentPayload {
  const title = compactText(titulo);
  const text = compactText(transcricao);
  const matched = getMatchedResource(title, text);

  const sentences = text.split(/[.!?]/).map((s) => s.trim()).filter((s) => s.length > 20);

  const pontosChave: string[] = sentences.slice(0, 6).map((s) => s.endsWith('.') ? s : `${s}.`);
  while (pontosChave.length < 6) {
    pontosChave.push(`Estude com atenção o conteúdo apresentado nesta aula sobre ${title.toLowerCase()}.`);
  }

  const versiculos = matched?.verses || [
    { referencia: 'Salmo 119:105', texto: 'Lâmpada para os meus pés é a tua palavra e luz para o meu caminho.' },
    { referencia: '2 Timóteo 3:16', texto: 'Toda a Escritura é inspirada por Deus e útil para o ensino.' },
    { referencia: 'Tiago 1:5', texto: 'Se, porém, algum de vós necessita de sabedoria, peça-a a Deus.' }
  ];

  const glossario = [
    ...(matched?.glossary || []),
    { termo: 'Doutrina', definicao: `Ensino bíblico sistematizado sobre ${title.toLowerCase()}.` },
    { termo: 'Aplicação', definicao: `Movimento de levar o conteúdo de ${title.toLowerCase()} para a vida e o ministério.` },
    { termo: 'Discernimento', definicao: 'Capacidade espiritual e bíblica de avaliar ideias e decisões à luz das Escrituras.' }
  ].slice(0, 5);

  const quiz: QuizQuestion[] = [
    {
      pergunta: `Qual é o tema central abordado na aula "${title}"?`,
      alternativas: [
        { texto: title, correta: true },
        { texto: 'Filosofia medieval', correta: false },
        { texto: 'Administração eclesiástica', correta: false },
        { texto: 'História do Império Romano', correta: false }
      ],
      explicacao: `A aula trata de ${title.toLowerCase()} conforme apresentado na transcrição.`
    },
    {
      pergunta: 'Qual postura é esperada do aluno ao estudar esse conteúdo?',
      alternativas: [
        { texto: 'Leitura atenta, reflexão bíblica e aplicação prática.', correta: true },
        { texto: 'Tratar como informação sem vínculo com a vida cristã.', correta: false },
        { texto: 'Ignorar o contexto bíblico e histórico.', correta: false },
        { texto: 'Priorizar opiniões pessoais acima das Escrituras.', correta: false }
      ],
      explicacao: 'O estudo teológico saudável exige fidelidade bíblica, reflexão e aplicação.'
    },
    {
      pergunta: 'O que melhor caracteriza o desenvolvimento desta aula?',
      alternativas: [
        { texto: pontosChave[0], correta: true },
        { texto: 'A aula defende que doutrina e prática são opostos.', correta: false },
        { texto: 'O contexto bíblico deve ser ignorado.', correta: false },
        { texto: 'A Bíblia não é suficiente para o ministério.', correta: false }
      ],
      explicacao: 'A alternativa correta deriva dos pontos centrais da transcrição.'
    },
    {
      pergunta: 'Qual resultado é esperado do estudo desta aula?',
      alternativas: [
        { texto: `Compreender ${title.toLowerCase()} e aplicar de forma bíblica e responsável.`, correta: true },
        { texto: 'Substituir o conteúdo por especulações pessoais.', correta: false },
        { texto: 'Reduzir o estudo a impressões superficiais.', correta: false },
        { texto: 'Depender apenas de experiência pessoal.', correta: false }
      ],
      explicacao: `O objetivo é aprofundar a compreensão de ${title.toLowerCase()} de forma fiel e ministerial.`
    },
    {
      pergunta: 'Qual é a importância da transcrição da aula para o aprendizado?',
      alternativas: [
        { texto: 'Serve como base para revisão, quiz e assistente de perguntas.', correta: true },
        { texto: 'É apenas um recurso de acessibilidade sem valor pedagógico.', correta: false },
        { texto: 'Substitui completamente o vídeo da aula.', correta: false },
        { texto: 'É gerada apenas para fins administrativos.', correta: false }
      ],
      explicacao: 'A transcrição alimenta o resumo, os pontos-chave, o quiz e o assistente de IA.'
    }
  ];

  return {
    resumo: [
      `Esta aula apresenta o tema "${title}" com base no conteúdo exposto na transcrição.`,
      sentences.slice(0, 3).join(' ') || `O conteúdo organiza os fundamentos essenciais sobre ${title.toLowerCase()}.`,
      'O aluno é encorajado a revisar os pontos-chave e aplicar o aprendizado em seu contexto ministerial.'
    ].join('\n\n'),
    pontosChave,
    versiculos,
    glossario,
    quiz
  };
}

// Generate resumo, pontosChave, versiculos, glossario, quiz from an existing transcript
export async function processIAFromTranscript(
  _aulaId: string,
  titulo: string,
  transcricao: string,
  options?: { modulo?: string }
): Promise<{ resumo: string; pontosChave: string; versiculos: string; glossario: string; quiz: string; provider: string }> {
  const fallback = buildFallbackEnrichment(titulo, transcricao);

  const serialize = (payload: EnrichmentPayload) => ({
    resumo: payload.resumo,
    pontosChave: JSON.stringify(payload.pontosChave),
    versiculos: JSON.stringify(payload.versiculos),
    glossario: JSON.stringify(payload.glossario),
    quiz: JSON.stringify(payload.quiz)
  });

  if (!isOpenAIConfigured()) {
    return { ...serialize(fallback), provider: 'local' };
  }

  try {
    const payload = await callOpenAIStructured<EnrichmentPayload>(
      'seminario_enrichment',
      enrichmentSchema,
      [
        'Você é um professor de teologia do Seminário Vinha Nova.',
        'Responda em português do Brasil.',
        'Use APENAS o conteúdo da transcrição fornecida.',
        'Não invente informações fora da transcrição.',
        'O quiz deve avaliar exatamente o que foi ensinado na transcrição, com 4 alternativas e apenas 1 correta.'
      ].join(' '),
      [
        `Gere o material didático para a aula "${titulo}" (Módulo: ${options?.modulo || 'Não informado'}) com base na transcrição abaixo.`,
        '',
        `TRANSCRIÇÃO:\n${truncateText(transcricao, 6000)}`,
        '',
        'Gere: resumo da aula, 6-10 pontos-chave, 3-6 versículos bíblicos relacionados ao conteúdo, 4-6 termos do glossário e 5 questões de quiz.'
      ].join('\n')
    );
    return { ...serialize(payload), provider: 'openai' };
  } catch (error) {
    logger.error('Falha ao enriquecer aula com OpenAI:', error);
    return { ...serialize(fallback), provider: 'local' };
  }
}

export function getAIConfig() {
  loadEnvFiles();

  return {
    provider: isOpenAIConfigured() ? 'openai' : 'local',
    model: OPENAI_MODEL,
    configured: isOpenAIConfigured()
  };
}

export async function processAIPipeline(aulaId: string, titulo: string, descricao?: string, options?: Omit<PipelineInput, 'aulaId' | 'titulo' | 'descricao'>) {
  const fallback = serializePipeline(buildFallbackPipeline({
    aulaId,
    titulo,
    descricao,
    ...options
  }));

  if (!isOpenAIConfigured()) {
    return { ...fallback, provider: 'local' };
  }

  try {
    const materialContext = (options?.materiais || [])
      .map((material) => `- ${material.titulo}${material.descricao ? `: ${material.descricao}` : ''}`)
      .join('\n');

    const payload = await callOpenAIStructured<PipelinePayload>(
      'seminario_pipeline',
      pipelineSchema,
      [
        'Você é um designer instrucional e professor de teologia do Seminário Vinha Nova.',
        'Responda em português do Brasil.',
        'Use apenas o contexto fornecido.',
        'Não invente detalhes específicos que não possam ser sustentados pelo título, descrição ou materiais.',
        'O quiz deve ser estritamente coerente com o conteúdo da aula, com 4 alternativas e apenas 1 correta por questão.'
      ].join(' '),
      [
        'Gere um pacote didático completo para a aula abaixo.',
        `ID da aula: ${aulaId}`,
        `Módulo: ${options?.modulo || 'Não informado'}`,
        `Título: ${titulo}`,
        `Descrição: ${descricao || 'Não informada'}`,
        materialContext ? `Materiais relacionados:\n${materialContext}` : 'Materiais relacionados: nenhum.',
        'A transcrição deve parecer uma aula realista.',
        'O resumo deve destacar ideias centrais e aplicação prática.',
        'Os pontos-chave devem ser objetivos.',
        'Os versículos e o glossário devem reforçar o conteúdo.',
        'O questionário precisa avaliar exatamente o que a aula ensinou.'
      ].join('\n\n')
    );

    return { ...serializePipeline(payload), provider: 'openai' };
  } catch (error) {
    logger.error('Falha ao gerar pipeline da aula com OpenAI. Recuando para o modo local.', error);
    return { ...fallback, provider: 'local' };
  }
}

export async function askLessonAssistant(input: AssistantInput) {
  const fallback = buildFallbackAssistant(input);

  if (!isOpenAIConfigured()) {
    return { ...fallback, provider: 'local' };
  }

  try {
    const payload = await callOpenAIStructured<LessonAssistantPayload>(
      'seminario_assistente_aula',
      assistantSchema,
      [
        'Você é um tutor acadêmico do Seminário Vinha Nova.',
        'Responda com precisão, clareza pastoral e rigor bíblico.',
        'A resposta deve ser baseada única e exclusivamente na transcrição desta aula, ignorando qualquer conhecimento externo da internet.',
        'Se a pergunta abordar algo que não foi conversado na transcrição da aula, responda EXATAMENTE com a frase: "Isso não foi conversado nesta aula". Não adicione nenhuma justificativa extra.',
        'Use somente o contexto fornecido.'
      ].join(' '),
      [
        `Pergunta do aluno: ${compactText(input.pergunta)}`,
        `Aula: ${compactText(input.titulo)}`,
        `Módulo: ${compactText(input.modulo) || 'Não informado'}`,
        `Descrição: ${compactText(input.descricao) || 'Não informada'}`,
        `Resumo: ${truncateText(input.resumo, 1200) || 'Não disponível'}`,
        `Transcrição: ${truncateText(input.transcricao, 4000) || 'Não disponível'}`,
        `Pontos-chave: ${(input.pontosChave || []).join(' | ') || 'Não disponíveis'}`,
        `Versículos: ${(input.versiculos || []).map((item) => `${item.referencia} - ${item.texto}`).join(' | ') || 'Não disponíveis'}`,
        `Glossário: ${(input.glossario || []).map((item) => `${item.termo}: ${item.definicao}`).join(' | ') || 'Não disponível'}`,
        `Materiais: ${(input.materiais || []).map((item) => `${item.titulo}${item.descricao ? `: ${item.descricao}` : ''}`).join(' | ') || 'Nenhum material relacionado'}`
      ].join('\n\n')
    );

    return { ...payload, provider: 'openai' };
  } catch (error) {
    logger.error('Falha ao responder pergunta do assistente com OpenAI. Recuando para o modo local.', error);
    return { ...fallback, provider: 'local' };
  }
}
