const LESSON_COMPLETION_THRESHOLD = 95;
const COMPLETED_DELIVERY_STATUSES = new Set(['enviado', 'corrigido']);

export type LessonProgressSource = {
  alunoId: string;
  aulaId: string;
  percentualAssistido: number;
  concluido: boolean;
};

export type PublishedLessonSource = {
  id: string;
  titulo: string;
  dataPublicacao: Date | null;
  criadoEm: Date;
  modulo?: {
    titulo: string;
  } | null;
};

export type DeliveryProgressSource = {
  alunoId: string;
  avaliacaoId: string;
  status: string;
};

export type PublishedAssessmentSource = {
  id: string;
  titulo: string;
  tipo: string;
  dataLimite: Date | null;
  criadoEm: Date;
  modulo?: {
    titulo: string;
  } | null;
  aula?: {
    titulo: string;
    modulo?: {
      titulo: string;
    } | null;
  } | null;
};

export type ProgressMetric = {
  total: number;
  concluidas: number;
  pendentes: number;
  percentual: number;
};

export type LessonProgressRow = {
  aulaId: string;
  titulo: string;
  modulo: string;
  dataPublicacao: Date;
  percentualAssistido: number;
  concluido: boolean;
  atrasada: boolean;
  diasAtraso: number | null;
  status: 'concluida' | 'em_andamento' | 'nao_iniciada';
};

export type AssessmentProgressRow = {
  avaliacaoId: string;
  titulo: string;
  tipo: string;
  modulo: string;
  aula: string | null;
  dataLimite: Date | null;
  concluido: boolean;
  atrasada: boolean;
  diasAtraso: number | null;
  statusEntrega: string;
};

export type StudentProgressDashboard = {
  progressoAulas: ProgressMetric;
  progressoAvaliacoes: ProgressMetric;
  progressoGeral: number;
  totalAlertasAtraso: number;
  aulasAtrasadas: LessonProgressRow[];
  avaliacoesPendentesAtrasadas: AssessmentProgressRow[];
  aulas: LessonProgressRow[];
  avaliacoes: AssessmentProgressRow[];
};

function clampPercentual(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffCalendarDays(laterDate: Date, earlierDate: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((startOfDay(laterDate).getTime() - startOfDay(earlierDate).getTime()) / dayMs);
}

function isCompletedDelivery(status: string | null | undefined) {
  return Boolean(status && COMPLETED_DELIVERY_STATUSES.has(status));
}

function buildMetric(total: number, concluidas: number): ProgressMetric {
  const totalSeguro = Math.max(total, 0);
  const concluidasSeguras = Math.min(Math.max(concluidas, 0), totalSeguro);

  return {
    total: totalSeguro,
    concluidas: concluidasSeguras,
    pendentes: Math.max(totalSeguro - concluidasSeguras, 0),
    percentual: totalSeguro > 0 ? Math.round((concluidasSeguras / totalSeguro) * 100) : 0
  };
}

function buildOverallProgress(metrics: ProgressMetric[]) {
  const metricsDisponiveis = metrics.filter((metric) => metric.total > 0);

  if (!metricsDisponiveis.length) {
    return 0;
  }

  return Math.round(
    metricsDisponiveis.reduce((sum, metric) => sum + metric.percentual, 0) / metricsDisponiveis.length
  );
}

function getLessonReleaseDate(aula: PublishedLessonSource) {
  return aula.dataPublicacao ?? aula.criadoEm;
}

function getAssessmentModuleLabel(avaliacao: PublishedAssessmentSource) {
  return avaliacao.modulo?.titulo
    || avaliacao.aula?.modulo?.titulo
    || avaliacao.aula?.titulo
    || 'Sem vinculo';
}

export function normalizeLessonPercentual(percentualAssistido: number, concluido = false) {
  const percentual = clampPercentual(percentualAssistido);

  if (concluido || percentual >= LESSON_COMPLETION_THRESHOLD) {
    return 100;
  }

  return Math.round(percentual);
}

export function buildLessonProgressRows(
  aulasPublicadas: PublishedLessonSource[],
  progressos: LessonProgressSource[],
  now = new Date()
) {
  const progressosMap = new Map(progressos.map((progresso) => [progresso.aulaId, progresso]));

  return aulasPublicadas.map((aula) => {
    const progresso = progressosMap.get(aula.id);
    const percentualAssistido = normalizeLessonPercentual(
      progresso?.percentualAssistido ?? 0,
      progresso?.concluido ?? false
    );
    const concluido = percentualAssistido >= 100;
    const dataPublicacao = getLessonReleaseDate(aula);
    const diasAtraso = !concluido ? diffCalendarDays(now, dataPublicacao) : 0;
    const atrasada = !concluido && diasAtraso > 0;

    return {
      aulaId: aula.id,
      titulo: aula.titulo,
      modulo: aula.modulo?.titulo || 'Sem modulo',
      dataPublicacao,
      percentualAssistido,
      concluido,
      atrasada,
      diasAtraso: atrasada ? diasAtraso : null,
      status: concluido ? 'concluida' : percentualAssistido > 0 ? 'em_andamento' : 'nao_iniciada'
    } satisfies LessonProgressRow;
  });
}

export function buildAssessmentProgressRows(
  avaliacoesPublicadas: PublishedAssessmentSource[],
  entregas: DeliveryProgressSource[],
  now = new Date()
) {
  const entregasMap = new Map(entregas.map((entrega) => [entrega.avaliacaoId, entrega]));

  return avaliacoesPublicadas.map((avaliacao) => {
    const entrega = entregasMap.get(avaliacao.id);
    const concluido = isCompletedDelivery(entrega?.status);
    const vencida = Boolean(!concluido && avaliacao.dataLimite && avaliacao.dataLimite.getTime() < now.getTime());
    const diasAtrasoBase = avaliacao.dataLimite ? diffCalendarDays(now, avaliacao.dataLimite) : 0;

    return {
      avaliacaoId: avaliacao.id,
      titulo: avaliacao.titulo,
      tipo: avaliacao.tipo,
      modulo: getAssessmentModuleLabel(avaliacao),
      aula: avaliacao.aula?.titulo || null,
      dataLimite: avaliacao.dataLimite,
      concluido,
      atrasada: vencida,
      diasAtraso: vencida ? Math.max(diasAtrasoBase, 1) : null,
      statusEntrega: entrega?.status || 'pendente'
    } satisfies AssessmentProgressRow;
  });
}

export function buildStudentProgressDashboard(params: {
  aulasPublicadas: PublishedLessonSource[];
  progressos: LessonProgressSource[];
  avaliacoesPublicadas: PublishedAssessmentSource[];
  entregas: DeliveryProgressSource[];
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const aulas = buildLessonProgressRows(params.aulasPublicadas, params.progressos, now);
  const avaliacoes = buildAssessmentProgressRows(params.avaliacoesPublicadas, params.entregas, now);
  const progressoAulas = buildMetric(
    aulas.length,
    aulas.filter((aula) => aula.concluido).length
  );
  const progressoAvaliacoes = buildMetric(
    avaliacoes.length,
    avaliacoes.filter((avaliacao) => avaliacao.concluido).length
  );
  const aulasAtrasadas = aulas.filter((aula) => aula.atrasada);
  const avaliacoesPendentesAtrasadas = avaliacoes.filter((avaliacao) => avaliacao.atrasada);

  return {
    progressoAulas,
    progressoAvaliacoes,
    progressoGeral: buildOverallProgress([progressoAulas, progressoAvaliacoes]),
    totalAlertasAtraso: aulasAtrasadas.length + avaliacoesPendentesAtrasadas.length,
    aulasAtrasadas,
    avaliacoesPendentesAtrasadas,
    aulas,
    avaliacoes
  } satisfies StudentProgressDashboard;
}

export function buildStudentProgressDashboardIndex(params: {
  studentIds: string[];
  aulasPublicadas: PublishedLessonSource[];
  progressos: LessonProgressSource[];
  avaliacoesPublicadas: PublishedAssessmentSource[];
  entregas: DeliveryProgressSource[];
  now?: Date;
}) {
  const progressosPorAluno = new Map<string, LessonProgressSource[]>();
  const entregasPorAluno = new Map<string, DeliveryProgressSource[]>();

  for (const progresso of params.progressos) {
    const current = progressosPorAluno.get(progresso.alunoId) || [];
    current.push(progresso);
    progressosPorAluno.set(progresso.alunoId, current);
  }

  for (const entrega of params.entregas) {
    const current = entregasPorAluno.get(entrega.alunoId) || [];
    current.push(entrega);
    entregasPorAluno.set(entrega.alunoId, current);
  }

  const index = new Map<string, StudentProgressDashboard>();

  for (const studentId of params.studentIds) {
    index.set(
      studentId,
      buildStudentProgressDashboard({
        aulasPublicadas: params.aulasPublicadas,
        progressos: progressosPorAluno.get(studentId) || [],
        avaliacoesPublicadas: params.avaliacoesPublicadas,
        entregas: entregasPorAluno.get(studentId) || [],
        now: params.now
      })
    );
  }

  return index;
}
