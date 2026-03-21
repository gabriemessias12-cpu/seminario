export type ModuleAttendanceInput = {
  id: string;
  titulo: string;
  aulas: Array<{
    id: string;
    presencas: Array<{
      status: string;
    }>;
  }>;
};

export type DeliverySummaryInput = {
  status: string;
  nota: number | null;
};

function getAttendanceWeight(status: string | null | undefined) {
  if (status === 'presente') {
    return 1;
  }

  if (status === 'parcial') {
    return 0.5;
  }

  return 0;
}

export function buildModuleFrequencyReport(modulos: ModuleAttendanceInput[]) {
  return modulos.map((modulo) => {
    const statuses = modulo.aulas.map((aula) => aula.presencas[0]?.status || 'ausente');
    const totalAulas = modulo.aulas.length;
    const attendanceScore = statuses.reduce((sum, status) => sum + getAttendanceWeight(status), 0);

    return {
      moduloId: modulo.id,
      modulo: modulo.titulo,
      totalAulas,
      frequenciaPercentual: totalAulas > 0 ? Math.round((attendanceScore / totalAulas) * 100) : 0,
      presencasPresentes: statuses.filter((status) => status === 'presente').length,
      presencasParciais: statuses.filter((status) => status === 'parcial').length,
      presencasAusentes: statuses.filter((status) => status === 'ausente').length
    };
  });
}

export function buildDeliverySummary(entregas: DeliverySummaryInput[]) {
  const totalAtividades = entregas.length;
  const entregues = entregas.filter((item) => item.status === 'enviado' || item.status === 'corrigido').length;
  const corrigidas = entregas.filter((item) => item.status === 'corrigido').length;
  const notasValidas = entregas.filter((item) => typeof item.nota === 'number');
  const mediaNotas = notasValidas.length > 0
    ? Math.round((notasValidas.reduce((sum, item) => sum + Number(item.nota), 0) / notasValidas.length) * 10) / 10
    : null;

  return {
    totalAtividades,
    entregues,
    pendentes: totalAtividades - entregues,
    corrigidas,
    mediaNotas
  };
}
