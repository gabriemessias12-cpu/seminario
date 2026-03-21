import { useEffect, useState } from 'react';
import AppIcon from '../../components/AppIcon';

export default function AdminRelatorios() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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

  return (
    <>
        <div className="page-header">
          <h1>Relatorios</h1>
          <p>Metricas de engajamento, desempenho e acesso do seminario.</p>
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
          </>
        )}
    </>
  );
}
