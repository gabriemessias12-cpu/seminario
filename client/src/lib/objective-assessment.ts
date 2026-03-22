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

export type StudentObjectiveQuestion = Omit<ObjectiveQuestion, 'correta' | 'gabarito'>;

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

export function createEmptyObjectiveQuestion(index = 0): ObjectiveQuestion {
  return {
    id: `questao-${index + 1}`,
    tipo: 'objetiva',
    enunciado: '',
    opcoes: ['', '', '', ''],
    correta: 0,
    explicacao: ''
  };
}

export function createEmptyDissertativeQuestion(index = 0): ObjectiveQuestion {
  return {
    id: `questao-${index + 1}`,
    tipo: 'dissertativa',
    enunciado: '',
    gabarito: '',
    explicacao: ''
  };
}

export function parseStoredObjectiveAnswers(value: string | null | undefined): Array<number | string | null> {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => {
          if (typeof item === 'string') return item;
          const numeric = Number(item);
          return Number.isInteger(numeric) ? numeric : null;
        })
      : [];
  } catch {
    return [];
  }
}

export function buildObjectiveReview(
  questions: ObjectiveQuestion[],
  answers: Array<number | string | null>
): ObjectiveReviewItem[] {
  return questions.map((question, index) => {
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
}
