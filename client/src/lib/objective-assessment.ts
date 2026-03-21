export type ObjectiveQuestion = {
  id: string;
  enunciado: string;
  opcoes: string[];
  correta: number;
  explicacao?: string | null;
};

export type StudentObjectiveQuestion = Omit<ObjectiveQuestion, 'correta'>;

export type ObjectiveReviewItem = {
  id: string;
  enunciado: string;
  opcoes: string[];
  respostaAluno: number | null;
  respostaCorreta: number;
  correta: boolean;
  explicacao?: string | null;
};

export function createEmptyObjectiveQuestion(index = 0): ObjectiveQuestion {
  return {
    id: `questao-${index + 1}`,
    enunciado: '',
    opcoes: ['', '', '', ''],
    correta: 0,
    explicacao: ''
  };
}

export function parseStoredObjectiveAnswers(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => {
          const numeric = Number(item);
          return Number.isInteger(numeric) ? numeric : null;
        })
      : [];
  } catch {
    return [];
  }
}

export function buildObjectiveReview(questions: ObjectiveQuestion[], answers: Array<number | null>) {
  return questions.map((question, index) => {
    const respostaAluno = answers[index] ?? null;
    return {
      id: question.id,
      enunciado: question.enunciado,
      opcoes: question.opcoes,
      respostaAluno,
      respostaCorreta: question.correta,
      correta: respostaAluno === question.correta,
      explicacao: question.explicacao || null
    } satisfies ObjectiveReviewItem;
  });
}
