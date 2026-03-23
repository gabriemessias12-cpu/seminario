import { describe, it, expect } from 'vitest';
import {
  parseObjectiveQuestions,
  sanitizeObjectiveQuestions,
  gradeObjectiveAnswers,
  parseObjectiveAnswers,
  type ObjectiveQuestion,
} from '../objective-assessment.js';

// ── Fixtures ─────────────────────────────────────────────────────

const validObjetiva: ObjectiveQuestion = {
  id: 'q1',
  tipo: 'objetiva',
  enunciado: 'Qual é a capital do Brasil?',
  opcoes: ['São Paulo', 'Brasília', 'Rio de Janeiro'],
  correta: 1,
};

const validDissertativa: ObjectiveQuestion = {
  id: 'q2',
  tipo: 'dissertativa',
  enunciado: 'Explique a Graça de Deus.',
  gabarito: 'Favor imerecido de Deus.',
};

// ── parseObjectiveQuestions ───────────────────────────────────────

describe('parseObjectiveQuestions', () => {
  it('retorna [] para null', () => {
    expect(parseObjectiveQuestions(null)).toEqual([]);
  });

  it('retorna [] para undefined', () => {
    expect(parseObjectiveQuestions(undefined)).toEqual([]);
  });

  it('retorna [] para JSON inválido', () => {
    expect(parseObjectiveQuestions('{ invalido')).toEqual([]);
  });

  it('retorna [] para não-array', () => {
    expect(parseObjectiveQuestions('{"key":"value"}')).toEqual([]);
  });

  it('ignora item sem enunciado', () => {
    const input = [{ tipo: 'objetiva', opcoes: ['A', 'B'], correta: 0 }];
    expect(parseObjectiveQuestions(input)).toEqual([]);
  });

  it('ignora objetiva com menos de 2 opções', () => {
    const input = [{ tipo: 'objetiva', enunciado: 'Q?', opcoes: ['só uma'], correta: 0 }];
    expect(parseObjectiveQuestions(input)).toEqual([]);
  });

  it('ignora objetiva com índice correta fora do range', () => {
    const input = [{ tipo: 'objetiva', enunciado: 'Q?', opcoes: ['A', 'B'], correta: 5 }];
    expect(parseObjectiveQuestions(input)).toEqual([]);
  });

  it('ignora objetiva com correta negativo', () => {
    const input = [{ tipo: 'objetiva', enunciado: 'Q?', opcoes: ['A', 'B'], correta: -1 }];
    expect(parseObjectiveQuestions(input)).toEqual([]);
  });

  it('parseia objetiva válida', () => {
    const input = [{ id: 'q1', tipo: 'objetiva', enunciado: 'Q?', opcoes: ['A', 'B'], correta: 0 }];
    const result = parseObjectiveQuestions(input);
    expect(result).toHaveLength(1);
    expect(result[0].tipo).toBe('objetiva');
    expect(result[0].correta).toBe(0);
    expect(result[0].opcoes).toEqual(['A', 'B']);
  });

  it('parseia dissertativa válida', () => {
    const input = [{ tipo: 'dissertativa', enunciado: 'Explique.', gabarito: 'Resposta.' }];
    const result = parseObjectiveQuestions(input);
    expect(result).toHaveLength(1);
    expect(result[0].tipo).toBe('dissertativa');
    expect(result[0].gabarito).toBe('Resposta.');
  });

  it('parseia JSON string com questões mistas', () => {
    const input = JSON.stringify([
      { tipo: 'objetiva', enunciado: 'Q1?', opcoes: ['A', 'B', 'C'], correta: 2 },
      { tipo: 'dissertativa', enunciado: 'Q2?' },
    ]);
    const result = parseObjectiveQuestions(input);
    expect(result).toHaveLength(2);
  });

  it('gera id automático quando não fornecido', () => {
    const input = [{ tipo: 'objetiva', enunciado: 'Q?', opcoes: ['A', 'B'], correta: 0 }];
    const result = parseObjectiveQuestions(input);
    expect(result[0].id).toBe('questao-1');
  });
});

// ── sanitizeObjectiveQuestions ────────────────────────────────────

describe('sanitizeObjectiveQuestions', () => {
  it('remove campo "correta" de questões objetivas', () => {
    const result = sanitizeObjectiveQuestions([validObjetiva]);
    expect(result[0]).not.toHaveProperty('correta');
  });

  it('remove campo "gabarito" de questões dissertativas', () => {
    const result = sanitizeObjectiveQuestions([validDissertativa]);
    expect(result[0]).not.toHaveProperty('gabarito');
  });

  it('preserva enunciado, opcoes e demais campos', () => {
    const result = sanitizeObjectiveQuestions([validObjetiva]);
    expect(result[0].enunciado).toBe(validObjetiva.enunciado);
    expect((result[0] as any).opcoes).toEqual(validObjetiva.opcoes);
  });
});

// ── gradeObjectiveAnswers ─────────────────────────────────────────

describe('gradeObjectiveAnswers', () => {
  const questions: ObjectiveQuestion[] = [
    { id: 'q1', tipo: 'objetiva', enunciado: 'Q1?', opcoes: ['A', 'B'], correta: 0 },
    { id: 'q2', tipo: 'objetiva', enunciado: 'Q2?', opcoes: ['X', 'Y', 'Z'], correta: 2 },
  ];

  it('nota máxima quando todas corretas', () => {
    const result = gradeObjectiveAnswers(questions, [0, 2], 10);
    expect(result.nota).toBe(10);
    expect(result.acertosObjetivos).toBe(2);
    expect(result.percentualObjetivo).toBe(100);
  });

  it('nota zero quando todas erradas', () => {
    const result = gradeObjectiveAnswers(questions, [1, 0], 10);
    expect(result.nota).toBe(0);
    expect(result.acertosObjetivos).toBe(0);
  });

  it('nota proporcional para metade de acertos', () => {
    const result = gradeObjectiveAnswers(questions, [0, 0], 10);
    expect(result.nota).toBe(5);
    expect(result.acertosObjetivos).toBe(1);
  });

  it('nota zero para lista de questões vazia', () => {
    const result = gradeObjectiveAnswers([], [], 10);
    expect(result.nota).toBe(0);
    expect(result.totalQuestoes).toBe(0);
  });

  it('detecta presença de dissertativa', () => {
    const mixed = [...questions, validDissertativa];
    const result = gradeObjectiveAnswers(mixed, [0, 2, 'algum texto'], 10);
    expect(result.hasDissertativa).toBe(true);
    expect(result.totalObjetivas).toBe(2);
  });

  it('trata resposta null como errada', () => {
    const result = gradeObjectiveAnswers(questions, [null, null], 10);
    expect(result.acertosObjetivos).toBe(0);
  });

  it('inclui detalhes de cada resposta no resultado', () => {
    const result = gradeObjectiveAnswers(questions, [0, 2], 10);
    expect(result.respostas).toHaveLength(2);
    expect(result.respostas[0].correta).toBe(true);
    expect(result.respostas[1].correta).toBe(true);
  });
});

// ── parseObjectiveAnswers ─────────────────────────────────────────

describe('parseObjectiveAnswers', () => {
  it('retorna [] para null', () => {
    expect(parseObjectiveAnswers(null, 3)).toEqual([]);
  });

  it('parseia array de números', () => {
    const result = parseObjectiveAnswers([0, 1, 2], 3);
    expect(result).toEqual([0, 1, 2]);
  });

  it('parseia JSON string de números', () => {
    const result = parseObjectiveAnswers('[0,1,2]', 3);
    expect(result).toEqual([0, 1, 2]);
  });

  it('trunca ao total de questões', () => {
    const result = parseObjectiveAnswers([0, 1, 2, 3, 4], 2);
    expect(result).toHaveLength(2);
  });

  it('converte float inválido para null', () => {
    const result = parseObjectiveAnswers([1.5], 1);
    expect(result[0]).toBeNull();
  });

  it('preserva resposta dissertativa como string', () => {
    const result = parseObjectiveAnswers(['texto livre'], 1);
    expect(result[0]).toBe('texto livre');
  });
});
