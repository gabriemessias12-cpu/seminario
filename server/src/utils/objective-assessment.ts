export type QuestionTipo = 'objetiva' | 'dissertativa';

export type ObjectiveQuestion = {
  id: string;
  tipo: QuestionTipo;
  enunciado: string;
  // objetiva only
  opcoes?: string[];
  correta?: number;
  // dissertativa only
  gabarito?: string | null;
  // both
  explicacao?: string | null;
};

export type SanitizedObjectiveQuestion = Omit<ObjectiveQuestion, 'correta' | 'gabarito'>;

export type ObjectiveReviewItem = {
  id: string;
  tipo: QuestionTipo;
  enunciado: string;
  // objetiva
  opcoes?: string[];
  respostaAluno: number | string | null;
  respostaCorreta?: number;
  correta?: boolean;
  // dissertativa
  respostaTextoAluno?: string | null;
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
    const tipo: QuestionTipo = question.tipo === 'dissertativa' ? 'dissertativa' : 'objetiva';
    const enunciado = String(question.enunciado || '').trim();
    const explicacao = typeof question.explicacao === 'string' && question.explicacao.trim()
      ? question.explicacao.trim()
      : null;
    const id = String(question.id || `questao-${index + 1}`);

    if (!enunciado) return [];

    if (tipo === 'dissertativa') {
      const gabarito = typeof question.gabarito === 'string' && question.gabarito.trim()
        ? question.gabarito.trim()
        : null;
      return [{ id, tipo, enunciado, gabarito, explicacao } as ObjectiveQuestion];
    }

    // objetiva
    const opcoes = Array.isArray(question.opcoes)
      ? question.opcoes.map((option) => String(option || '').trim()).filter(Boolean)
      : [];
    const correta = Number(question.correta);

    if (opcoes.length < 2 || !Number.isInteger(correta) || correta < 0 || correta >= opcoes.length) {
      return [];
    }

    return [{ id, tipo, enunciado, opcoes, correta, explicacao }];
  });
}

export function serializeObjectiveQuestions(questions: ObjectiveQuestion[]) {
  return JSON.stringify(questions);
}

export function sanitizeObjectiveQuestions(questions: ObjectiveQuestion[]): SanitizedObjectiveQuestion[] {
  return questions.map(({ correta, gabarito, ...question }) => question);
}

export function parseObjectiveAnswers(
  value: unknown,
  totalQuestions: number
): Array<number | string | null> {
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
    if (typeof answer === 'string') return answer;
    const numeric = Number(answer);
    return Number.isInteger(numeric) ? numeric : null;
  });
}

export function gradeObjectiveAnswers(
  questions: ObjectiveQuestion[],
  answers: Array<number | string | null>,
  notaMaxima: number
) {
  const totalQuestoes = questions.length;
  const objetivas = questions.filter((q) => q.tipo === 'objetiva');
  const totalObjetivas = objetivas.length;
  const hasDissertativa = questions.some((q) => q.tipo === 'dissertativa');

  const respostas: ObjectiveReviewItem[] = questions.map((question, index) => {
    const respostaAluno = answers[index] ?? null;
    if (question.tipo === 'dissertativa') {
      return {
        id: question.id,
        tipo: 'dissertativa',
        enunciado: question.enunciado,
        respostaAluno,
        respostaTextoAluno: typeof respostaAluno === 'string' ? respostaAluno : null,
        explicacao: question.explicacao || null
      };
    }

    const respostaIndex = typeof respostaAluno === 'number' ? respostaAluno : null;
    return {
      id: question.id,
      tipo: 'objetiva',
      enunciado: question.enunciado,
      opcoes: question.opcoes ?? [],
      respostaAluno,
      respostaCorreta: question.correta ?? 0,
      correta: respostaIndex === question.correta,
      explicacao: question.explicacao || null
    };
  });

  const acertosObjetivos = respostas.filter((item) => item.tipo === 'objetiva' && item.correta).length;
  const percentualObjetivo = totalObjetivas > 0
    ? roundToTenth((acertosObjetivos / totalObjetivas) * 100)
    : 0;
  const nota = totalObjetivas > 0
    ? roundToTenth((acertosObjetivos / totalObjetivas) * notaMaxima)
    : 0;

  return {
    totalQuestoes,
    totalObjetivas,
    acertosObjetivos,
    percentualObjetivo,
    nota,
    hasDissertativa,
    respostas
  };
}
