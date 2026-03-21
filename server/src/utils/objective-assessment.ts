export type ObjectiveQuestion = {
  id: string;
  enunciado: string;
  opcoes: string[];
  correta: number;
  explicacao?: string | null;
};

export type SanitizedObjectiveQuestion = Omit<ObjectiveQuestion, 'correta'>;

export type ObjectiveReviewItem = {
  id: string;
  enunciado: string;
  opcoes: string[];
  respostaAluno: number | null;
  respostaCorreta: number;
  correta: boolean;
  explicacao?: string | null;
};

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

export function parseObjectiveQuestions(value: unknown): ObjectiveQuestion[] {
  if (!value) {
    return [];
  }

  let raw: unknown;
  try {
    raw = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return [];
  }

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const question = item as Record<string, unknown>;
    const enunciado = String(question.enunciado || '').trim();
    const opcoes = Array.isArray(question.opcoes)
      ? question.opcoes.map((option) => String(option || '').trim()).filter(Boolean)
      : [];
    const correta = Number(question.correta);
    const explicacao = typeof question.explicacao === 'string' && question.explicacao.trim()
      ? question.explicacao.trim()
      : null;

    if (!enunciado || opcoes.length < 2 || !Number.isInteger(correta) || correta < 0 || correta >= opcoes.length) {
      return [];
    }

    return [{
      id: String(question.id || `questao-${index + 1}`),
      enunciado,
      opcoes,
      correta,
      explicacao
    }];
  });
}

export function serializeObjectiveQuestions(questions: ObjectiveQuestion[]) {
  return JSON.stringify(questions);
}

export function sanitizeObjectiveQuestions(questions: ObjectiveQuestion[]): SanitizedObjectiveQuestion[] {
  return questions.map(({ correta, ...question }) => question);
}

export function parseObjectiveAnswers(value: unknown, totalQuestions: number) {
  if (!value) {
    return [];
  }

  let raw: unknown;
  try {
    raw = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return [];
  }

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.slice(0, totalQuestions).map((answer) => {
    const numeric = Number(answer);
    return Number.isInteger(numeric) ? numeric : null;
  });
}

export function gradeObjectiveAnswers(questions: ObjectiveQuestion[], answers: Array<number | null>, notaMaxima: number) {
  const totalQuestoes = questions.length;
  const respostas = questions.map((question, index) => {
    const respostaAluno = answers[index] ?? null;
    const correta = respostaAluno === question.correta;

    return {
      id: question.id,
      enunciado: question.enunciado,
      opcoes: question.opcoes,
      respostaAluno,
      respostaCorreta: question.correta,
      correta,
      explicacao: question.explicacao || null
    } satisfies ObjectiveReviewItem;
  });

  const acertosObjetivos = respostas.filter((item) => item.correta).length;
  const percentualObjetivo = totalQuestoes > 0
    ? roundToTenth((acertosObjetivos / totalQuestoes) * 100)
    : 0;
  const nota = totalQuestoes > 0
    ? roundToTenth((acertosObjetivos / totalQuestoes) * notaMaxima)
    : 0;

  return {
    totalQuestoes,
    acertosObjetivos,
    percentualObjetivo,
    nota,
    respostas
  };
}
