import { useEffect, useMemo, useRef, useState } from 'react';

import AppIcon from '../../components/AppIcon';
import BrandMark from '../../components/BrandMark';
import { apiGet } from '../../lib/apiClient';

export default function AdminRelatorios() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet('/api/admin/relatorios')
      .then(setData)
      .catch(() => setError('Nao foi possivel carregar os relatorios agora.'))
      .finally(() => setLoading(false));
  }, []);

  const exportCSV = (rows: string[][], filename: string) => {
    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const academicByStudent = useMemo(() => (
    (data?.academicByStudent || []).filter((item: any) => {
      if (!search.trim()) return true;
      return `${item.nome} ${item.email}`.toLowerCase().includes(search.trim().toLowerCase());
    })
  ), [data?.academicByStudent, search]);

  const performanceByAssessment = data?.performanceByAssessment || [];

  const handlePrintPDF = () => {
    const printStyles = `
      @page { size: A4; margin: 20mm 15mm; }
      body { font-family: 'Inter', Arial, sans-serif; color: #1a1a2e; background: white; }
      .pdf-header { display: flex !important; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #a48fff; }
      .pdf-brand-logo { width: 48px; height: 48px; }
      .pdf-brand-name { font-size: 20px; font-weight: 700; color: #1a1a2e; }
      .pdf-brand-sub { font-size: 11px; color: #6c6c8a; letter-spacing: 0.1em; text-transform: uppercase; }
      .pdf-date { margin-left: auto; font-size: 11px; color: #6c6c8a; }
      .print-hide { display: none !important; }
      .card { border: 1px solid #e2e2f5; border-radius: 8px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #f5f3ff; color: #1a1a2e; padding: 8px 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #a48fff; }
      td { padding: 7px 10px; border-bottom: 1px solid #e2e2f5; }
      tr:last-child td { border-bottom: none; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; }
      .badge-success { background: #d1fae5; color: #065f46; }
      .badge-warning { background: #fef3c7; color: #92400e; }
      .badge-error { background: #fee2e2; color: #991b1b; }
      .badge-purple { background: #ede9fe; color: #5b21b6; }
      .badge-info { background: #dbeafe; color: #1e40af; }
      .section-title { font-size: 14px; font-weight: 600; color: #1a1a2e; margin-bottom: 12px; }
      .text-muted { color: #6c6c8a; }
      .text-sm { font-size: 11px; }
      .bar-chart { display: none; }
      .chart-inline-progress { display: flex; align-items: center; gap: 8px; }
      .progress-bar { flex: 1; height: 6px; background: #e2e2f5; border-radius: 3px; overflow: hidden; }
      .progress-bar-fill { height: 100%; background: #a48fff; border-radius: 3px; }
    `;

    const styleEl = document.createElement('style');
    styleEl.id = 'pdf-print-style';
    styleEl.textContent = printStyles;
    document.head.appendChild(styleEl);

    window.print();

    setTimeout(() => {
      document.getElementById('pdf-print-style')?.remove();
    }, 1000);
  };

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div ref={printRef}>
      <div className="pdf-header hidden print:flex items-center gap-4 mb-6 pb-4 border-b-2 border-primary">
        <BrandMark className="pdf-brand-logo w-12 h-12 rounded-lg bg-white p-1" />
        <div>
          <div className="pdf-brand-name font-bold text-xl text-gray-900">Instituto Bíblico Vinha Nova</div>
          <div className="pdf-brand-sub text-xs text-gray-500 uppercase tracking-widest">Seminário Teológico - Relatórios Acadêmicos</div>
        </div>
        <div className="ml-auto text-xs text-gray-400">Emitido em {today}</div>
      </div>

      <div className="page-header page-header-split print-hide">
        <div>
          <h1>Relatórios</h1>
          <p>Métricas de engajamento, desempenho e acesso do seminário.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={handlePrintPDF} type="button">
            <AppIcon name="reports" size={14} />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {error && <div className="inline-feedback warning">{error}</div>}

      {loading ? (
        <div className="skeleton" style={{ height: 400 }} />
      ) : data ? (
        <>
          <div className="card mb-3">
            <div className="content-panel-toolbar admin-toolbar-compact">
              <h3 className="section-title" style={{ marginBottom: 0 }}>Relatório de engajamento por aula</h3>
              <button
                className="btn btn-outline btn-sm print-hide"
                onClick={() => {
                  const rows = [
                    ['Aula', 'Visualizacoes', '% Medio Conclusao', 'Media Quiz', 'Total Quizzes'],
                    ...(data.engajamento || []).map((aula: any) => [
                      aula.titulo,
                      String(aula.totalVisualizacoes),
                      `${aula.mediaConclusao}%`,
                      `${aula.mediaQuiz}%`,
                      String(aula.totalQuizzes)
                    ])
                  ];
                  exportCSV(rows, 'relatorio-engajamento.csv');
                }}
                type="button"
              >
                Exportar CSV
              </button>
            </div>

            <div className="bar-chart print-hide" style={{ marginBottom: '1.5rem' }}>
              {data.engajamento?.map((aula: any, index: number) => (
                <div key={aula.id} className="bar" style={{ height: `${Math.max(aula.mediaConclusao, 5)}%` }}>
                  <div className="bar-value">{aula.mediaConclusao}%</div>
                  <div className="bar-label">A{index + 1}</div>
                </div>
              ))}
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Aula</th>
                    <th>Visualizações</th>
                    <th>% Medio</th>
                    <th>Media Quiz</th>
                    <th>Quizzes feitos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.engajamento?.map((aula: any) => (
                    <tr key={aula.id}>
                      <td style={{ fontWeight: 500 }}>{aula.titulo}</td>
                      <td>{aula.totalVisualizacoes}</td>
                      <td>
                        <div className="chart-inline-progress">
                          <div className="progress-bar">
                            <div className="progress-bar-fill" style={{ width: `${aula.mediaConclusao}%` }} />
                          </div>
                          <span className="text-sm">{aula.mediaConclusao}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${aula.mediaQuiz >= 80 ? 'badge-success' : aula.mediaQuiz >= 60 ? 'badge-warning' : 'badge-error'}`}>
                          {aula.mediaQuiz}%
                        </span>
                      </td>
                      <td>{aula.totalQuizzes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="content-panel-toolbar admin-toolbar-compact">
              <h3 className="section-title" style={{ marginBottom: 0 }}>Relatório de acesso</h3>
              <button
                className="btn btn-outline btn-sm print-hide"
                onClick={() => {
                  const rows = [
                    ['Usuario', 'Email', 'Data/Hora', 'IP', 'Dispositivo'],
                    ...(data.logins || []).map((login: any) => [
                      login.usuario?.nome,
                      login.usuario?.email,
                      new Date(login.dataHora).toLocaleString('pt-BR'),
                      login.ip || '',
                      login.dispositivo?.substring(0, 50) || ''
                    ])
                  ];
                  exportCSV(rows, 'relatorio-acesso.csv');
                }}
                type="button"
              >
                Exportar CSV
              </button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Email</th>
                    <th>Data/Hora</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logins?.map((login: any) => (
                    <tr key={login.id}>
                      <td style={{ fontWeight: 500 }}>{login.usuario?.nome}</td>
                      <td className="text-muted">{login.usuario?.email}</td>
                      <td className="text-muted">{new Date(login.dataHora).toLocaleString('pt-BR')}</td>
                      <td className="text-muted">{login.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card mt-3">
            <div className="content-panel-toolbar admin-toolbar-compact">
              <h3 className="section-title" style={{ marginBottom: 0 }}>Relatório acadêmico por aluno</h3>
              <div className="page-header-actions print-hide">
                <div className="search-field compact">
                  <AppIcon name="search" size={16} />
                  <input
                    aria-label="Buscar aluno por nome ou email"
                    placeholder="Buscar aluno..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </div>
              <button
                className="btn btn-outline btn-sm print-hide"
                onClick={() => {
                  const rows = [
                    ['Aluno', 'Email', 'Aulas', 'Avaliacoes', 'Geral', 'Aulas atrasadas', 'Avaliacoes atrasadas', 'Frequencia', 'Entregas', 'Corrigidas', 'Media notas'],
                    ...academicByStudent.map((item: any) => [
                      item.nome,
                      item.email,
                      `${item.progressoAulas}%`,
                      `${item.progressoAvaliacoes}%`,
                      `${item.progressoGeral}%`,
                      String(item.aulasAtrasadas),
                      String(item.avaliacoesAtrasadas),
                      `${item.frequenciaGeral}%`,
                      String(item.entregues),
                      String(item.corrigidas),
                      item.mediaNotas == null ? 'N/A' : String(item.mediaNotas)
                    ])
                  ];
                  exportCSV(rows, 'relatorio-academico.csv');
                }}
                type="button"
              >
                Exportar CSV
              </button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Aulas</th>
                    <th>Avaliações</th>
                    <th>Geral</th>
                    <th>Atrasos</th>
                    <th>Frequência</th>
                    <th>Entregas</th>
                    <th>Média notas</th>
                  </tr>
                </thead>
                <tbody>
                  {academicByStudent.map((item: any) => (
                    <tr key={item.alunoId}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.nome}</div>
                        <div className="text-muted text-sm">{item.email}</div>
                      </td>
                      <td>{item.progressoAulas}%</td>
                      <td>{item.progressoAvaliacoes}%</td>
                      <td><span className="badge badge-purple">{item.progressoGeral}%</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {item.aulasAtrasadas > 0 && <span className="badge badge-error">{item.aulasAtrasadas} aulas</span>}
                          {item.avaliacoesAtrasadas > 0 && <span className="badge badge-warning">{item.avaliacoesAtrasadas} avaliacoes</span>}
                          {item.aulasAtrasadas === 0 && item.avaliacoesAtrasadas === 0 && (
                            <span className="badge badge-success">Em dia</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${item.frequenciaGeral >= 75 ? 'badge-success' : item.frequenciaGeral >= 50 ? 'badge-warning' : 'badge-error'}`}>
                          {item.frequenciaGeral}%
                        </span>
                      </td>
                      <td>{item.entregues}/{item.totalAtividades}</td>
                      <td>{item.mediaNotas ?? 'N/A'}</td>
                    </tr>
                  ))}

                  {!academicByStudent.length && (
                    <tr>
                      <td className="text-muted" colSpan={8}>Nenhum aluno corresponde ao filtro atual.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card mt-3">
            <div className="content-panel-toolbar admin-toolbar-compact">
              <h3 className="section-title" style={{ marginBottom: 0 }}>Desempenho por avaliacao</h3>
              <button
                className="btn btn-outline btn-sm print-hide"
                onClick={() => {
                  const rows = [
                    ['Avaliacao', 'Tipo', 'Formato', 'Vinculo', 'Entregas', 'Corrigidas', 'Media notas', 'Media acerto objetivo'],
                    ...performanceByAssessment.map((item: any) => [
                      item.titulo,
                      item.tipo,
                      item.formato,
                      item.modulo,
                      String(item.totalEntregas),
                      String(item.corrigidas),
                      item.mediaNotas == null ? 'N/A' : String(item.mediaNotas),
                      item.mediaAcertoObjetivo == null ? 'N/A' : `${item.mediaAcertoObjetivo}%`
                    ])
                  ];
                  exportCSV(rows, 'relatorio-avaliacoes.csv');
                }}
                type="button"
              >
                Exportar CSV
              </button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Avaliação</th>
                    <th>Tipo</th>
                    <th>Formato</th>
                    <th>Vínculo</th>
                    <th>Entregas</th>
                    <th>Corrigidas</th>
                    <th>Media notas</th>
                    <th>Media acerto</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceByAssessment.map((item: any) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.titulo}</td>
                      <td>{item.tipo}</td>
                      <td>
                        <span className={`badge ${item.formato === 'objetiva' ? 'badge-purple' : 'badge-info'}`}>
                          {item.formato}
                        </span>
                      </td>
                      <td className="text-muted">{item.modulo}</td>
                      <td>{item.totalEntregas}</td>
                      <td>{item.corrigidas}</td>
                      <td>{item.mediaNotas ?? 'N/A'}</td>
                      <td>
                        {item.mediaAcertoObjetivo == null ? 'N/A' : (
                          <span className={`badge ${item.mediaAcertoObjetivo >= 75 ? 'badge-success' : item.mediaAcertoObjetivo >= 50 ? 'badge-warning' : 'badge-error'}`}>
                            {item.mediaAcertoObjetivo}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {!performanceByAssessment.length && (
                    <tr>
                      <td className="text-muted" colSpan={8}>Nenhuma avaliacao publicada ainda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="hidden print:block mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
            Instituto Bíblico Vinha Nova - Seminário Teológico | Documento gerado em {today} | Uso interno
          </div>
        </>
      ) : (
        <div className="empty-panel">
          <AppIcon name="reports" size={20} />
          <p>Nenhum relatorio consolidado ainda.</p>
        </div>
      )}
    </div>
  );
}
