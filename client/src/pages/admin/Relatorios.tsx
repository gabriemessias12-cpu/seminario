import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../components/AppIcon';

export default function AdminRelatorios() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    fetch('/api/admin/relatorios', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const exportCSV = (rows: string[][], filename: string) => {
    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  };

  const academicByStudent = useMemo(() => {
    return (data?.academicByStudent || []).filter((item: any) => {
      if (!search.trim()) {
        return true;
      }

      const haystack = `${item.nome} ${item.email}`.toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    });
  }, [data?.academicByStudent, search]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
        <div className="page-header page-header-split">
          <div>
            <h1>Relatorios</h1>
            <p>Metricas de engajamento, desempenho e acesso do seminario.</p>
          </div>
          <div className="page-header-actions print-hide">
            <button className="btn btn-outline" onClick={handlePrint} type="button">
              <AppIcon name="reports" size={14} />
              <span>Imprimir relatorios</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 400 }} />
        ) : data && (
          <>
            <div className="card mb-3">
              <div className="content-panel-toolbar admin-toolbar-compact">
                <h3 style={{ fontSize: '1.1rem' }}>Relatorio de engajamento por aula</h3>
                <button className="btn btn-outline btn-sm" onClick={() => {
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
                }}>
                  Exportar CSV
                </button>
              </div>

              <div className="bar-chart" style={{ marginBottom: '1.5rem' }}>
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
                      <th>Visualizacoes</th>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div className="progress-bar" style={{ width: 60 }}>
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
                <h3 style={{ fontSize: '1.1rem' }}>Relatorio de acesso</h3>
                <button className="btn btn-outline btn-sm" onClick={() => {
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
                }}>
                  Exportar CSV
                </button>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Usuario</th>
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
                <h3 style={{ fontSize: '1.1rem' }}>Relatorio academico por aluno</h3>
                <div className="page-header-actions print-hide">
                  <div className="search-field compact">
                    <AppIcon name="search" size={16} />
                    <input placeholder="Buscar aluno por nome ou email" value={search} onChange={(event) => setSearch(event.target.value)} />
                  </div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => {
                  const rows = [
                    ['Aluno', 'Email', 'Aulas concluidas', 'Frequencia geral', 'Entregas', 'Corrigidas', 'Media notas'],
                    ...academicByStudent.map((item: any) => [
                      item.nome,
                      item.email,
                      String(item.aulasConcluidas),
                      `${item.frequenciaGeral}%`,
                      String(item.entregues),
                      String(item.corrigidas),
                      item.mediaNotas == null ? 'N/A' : String(item.mediaNotas)
                    ])
                  ];
                  exportCSV(rows, 'relatorio-academico.csv');
                }}>
                  Exportar CSV
                </button>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Aluno</th>
                      <th>Frequencia</th>
                      <th>Aulas concluidas</th>
                      <th>Entregas</th>
                      <th>Corrigidas</th>
                      <th>Media notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicByStudent.map((item: any) => (
                      <tr key={item.alunoId}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{item.nome}</div>
                          <div className="text-muted text-sm">{item.email}</div>
                        </td>
                        <td>
                          <span className={`badge ${item.frequenciaGeral >= 75 ? 'badge-success' : item.frequenciaGeral >= 50 ? 'badge-warning' : 'badge-error'}`}>
                            {item.frequenciaGeral}%
                          </span>
                        </td>
                        <td>{item.aulasConcluidas}</td>
                        <td>{item.entregues}</td>
                        <td>{item.corrigidas}</td>
                        <td>{item.mediaNotas ?? 'N/A'}</td>
                      </tr>
                    ))}

                    {!academicByStudent.length && (
                      <tr>
                        <td className="text-muted" colSpan={6}>Nenhum aluno corresponde ao filtro atual.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
    </>
  );
}
