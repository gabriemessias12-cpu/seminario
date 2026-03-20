import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../../components/AppIcon';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    fetch('/api/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
        <div className="page-header">
          <h1>Painel Administrativo</h1>
          <p>Visao geral do Seminario Vinha Nova.</p>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {[1, 2, 3, 4].map((item) => <div key={item} className="skeleton" style={{ height: 100 }} />)}
          </div>
        ) : data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
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
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Percentual medio assistido por aula</h3>
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
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Alunos que precisam de atencao</h3>
                {data.alunosAtencao?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {data.alunosAtencao.map((aluno: any) => (
                      <div
                        key={aluno.id}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                        onClick={() => navigate(`/admin/aluno/${aluno.id}`)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', background: 'var(--color-error)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>
                            {aluno.nome?.[0]}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{aluno.nome}</div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>{aluno.email}</div>
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
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Atividade recente</h3>
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
                    {data.atividadeRecente?.map((item: any) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 500 }}>{item.usuario?.nome}</td>
                        <td><span className="badge badge-success">Login</span></td>
                        <td className="text-muted">{new Date(item.dataHora).toLocaleString('pt-BR')}</td>
                        <td className="text-muted" style={{ fontSize: '0.8rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.dispositivo?.substring(0, 40)}
                        </td>
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
