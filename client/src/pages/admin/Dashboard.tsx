import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../../components/AppIcon';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    fetch('/api/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then(setData)
      .catch(() => setError('Nao foi possivel carregar o painel administrativo agora.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
        <div className="page-header">
          <h1>Painel Administrativo</h1>
          <p>Visao geral do IBVN e do Seminario Teologico.</p>
        </div>

        {error && <div className="inline-feedback warning">{error}</div>}

        {loading ? (
          <div className="stat-grid-auto">
            {[1, 2, 3, 4].map((item) => <div key={item} className="skeleton" style={{ height: 100 }} />)}
          </div>
        ) : data ? (
          <>
            <div className="stat-grid-auto mb-3">
              {[
                { icon: 'students' as const, className: 'purple', value: data.totalAlunos, label: 'Total de alunos' },
                { icon: 'check' as const, className: 'green', value: data.alunosAtivos, label: 'Ativos nos ultimos 7 dias' },
                { icon: 'play' as const, className: 'orange', value: data.aulasPublicadas, label: 'Aulas publicadas' },
                { icon: 'reports' as const, className: 'blue', value: `${data.taxaConclusao}%`, label: 'Taxa de conclusao' }
              ].map((item) => (
                <div className="stat-card" key={item.label}>
                  <div className={`stat-icon ${item.className}`}><AppIcon name={item.icon} size={18} /></div>
                  <div>
                    <div className="stat-value">{item.value}</div>
                    <div className="stat-label">{item.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid-2">
              <div className="card">
                <h3 className="section-title">Percentual medio assistido por aula</h3>
                <div className="bar-chart">
                  {data.aulasStats?.map((aula: any, index: number) => (
                    <div key={aula.id} className="bar" style={{ height: `${Math.max(aula.mediaConclusao, 5)}%` }}>
                      <div className="bar-value">{aula.mediaConclusao}%</div>
                      <div className="bar-label">A{index + 1}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="section-title">Alunos que precisam de atencao</h3>
                {data.alunosAtencao?.length ? (
                  <div className="attention-list">
                    {data.alunosAtencao.map((aluno: any) => (
                      <div
                        key={aluno.id}
                        className="attention-item"
                        onClick={() => navigate(`/admin/aluno/${aluno.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            navigate(`/admin/aluno/${aluno.id}`);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="table-entity">
                          <div className="attention-item-avatar">
                            {aluno.nome?.[0]}
                          </div>
                          <div className="attention-item-copy">
                            <div className="table-entity-copy">{aluno.nome}</div>
                            <div className="text-muted text-sm">{aluno.email}</div>
                          </div>
                        </div>
                        <span className="badge badge-error">{aluno.progressoMedio}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted text-sm">Todos os alunos estao com bom progresso.</p>
                )}
              </div>
            </div>

            <div className="card mt-3">
              <h3 className="section-title">Atividade recente</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Acao</th>
                      <th>Data/Hora</th>
                      <th>Dispositivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.atividadeRecente?.length ? data.atividadeRecente.map((item: any) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 500 }}>{item.usuario?.nome}</td>
                        <td><span className="badge badge-success">Login</span></td>
                        <td className="text-muted">{new Date(item.dataHora).toLocaleString('pt-BR')}</td>
                        <td className="text-muted">
                          <span className="table-device-text">{item.dispositivo?.substring(0, 40)}</span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td className="text-muted" colSpan={4}>Nenhuma atividade recente encontrada.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-panel">
            <AppIcon name="reports" size={20} />
            <p>Os dados do painel ainda nao estao disponiveis.</p>
          </div>
        )}
    </>
  );
}
