import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AppIcon from '../../components/AppIcon';
import { apiGet, apiPut } from '../../lib/apiClient';
import type { AdminDashboardData, SecurityAlert } from '../../types/models';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alertas, setAlertas] = useState<SecurityAlert[]>([]);

  useEffect(() => {
    Promise.allSettled([
      apiGet<AdminDashboardData>('/api/admin/dashboard'),
      apiGet<SecurityAlert[]>('/api/admin/alertas-seguranca')
    ])
      .then(([dashResult, alertasResult]) => {
        if (dashResult.status === 'fulfilled') {
          setData(dashResult.value);
        } else {
          setError('Nao foi possivel carregar o painel administrativo agora.');
        }

        if (alertasResult.status === 'fulfilled' && Array.isArray(alertasResult.value)) {
          setAlertas(alertasResult.value);
        } else if (dashResult.status === 'fulfilled') {
          setError('Painel carregado, mas os alertas de seguranca estao indisponiveis no momento.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const marcarLido = async (id: string) => {
    await apiPut(`/api/admin/alerta-seguranca/${id}/ler`).catch(() => undefined);
    setAlertas((prev) => prev.map((alerta) => (
      alerta.id === id ? { ...alerta, lido: true } : alerta
    )));
  };

  const naoLidos = alertas.filter((alerta) => !alerta.lido);
  const totalAlertasAcademicos = (data?.alertasAulasAtrasadas || 0) + (data?.alertasAvaliacoesAtrasadas || 0);

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
          {naoLidos.length > 0 && (
            <div className="panel-card mb-3" style={{ borderLeft: '3px solid var(--color-error, #ef4444)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <AppIcon name="alert-triangle" size={18} />
                <h3 className="section-title" style={{ margin: 0, color: 'var(--color-error, #ef4444)' }}>
                  Alertas de seguranca ({naoLidos.length})
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {naoLidos.map((alerta) => (
                  <div
                    key={alerta.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      flexWrap: 'wrap',
                      background: 'rgba(239,68,68,0.07)',
                      borderRadius: 8,
                      padding: '0.6rem 0.75rem'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>{alerta.mensagem}</p>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', opacity: 0.6 }}>
                        {new Date(alerta.criadoEm).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="alert-action-row" style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/aluno/${alerta.usuario.id}`)} type="button">
                        Ver aluno
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => marcarLido(alerta.id)} type="button">
                        Dispensar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="stat-grid-auto mb-3">
            {[
              { icon: 'students' as const, className: 'purple', value: data.totalAlunos, label: 'Total de alunos' },
              { icon: 'check' as const, className: 'green', value: data.alunosAtivos, label: 'Ativos nos ultimos 7 dias' },
              { icon: 'play' as const, className: 'orange', value: data.aulasPublicadas, label: 'Aulas publicadas' },
              { icon: 'alert-triangle' as const, className: 'blue', value: totalAlertasAcademicos, label: 'Alertas academicos' }
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

          <div className="stat-grid-auto mb-3">
            {[
              { icon: 'library' as const, className: 'purple', value: `${data.progressoMedioAulas}%`, label: 'Progresso medio nas aulas' },
              { icon: 'quiz' as const, className: 'orange', value: `${data.progressoMedioAvaliacoes}%`, label: 'Progresso medio em avaliacoes' },
              { icon: 'reports' as const, className: 'green', value: `${data.progressoMedioGeral}%`, label: 'Progresso medio geral' },
              { icon: 'clock' as const, className: 'blue', value: `${data.alertasAvaliacoesAtrasadas}/${data.alertasAulasAtrasadas}`, label: 'Avaliacoes/Aulas atrasadas' }
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
                {data.aulasStats?.map((aula, index) => (
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
                  {data.alunosAtencao.map((aluno) => (
                    <div
                      key={aluno.id}
                      aria-label={`Ver detalhes de ${aluno.nome}`}
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
                          <div className="text-muted text-sm">
                            Aulas {aluno.progressoAulas}% · Avaliacoes {aluno.progressoAvaliacoes}% · Geral {aluno.progressoGeral}%
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {aluno.aulasAtrasadas > 0 && <span className="badge badge-error">{aluno.aulasAtrasadas} aulas atrasadas</span>}
                        {aluno.avaliacoesAtrasadas > 0 && <span className="badge badge-warning">{aluno.avaliacoesAtrasadas} avaliacoes atrasadas</span>}
                        <span className="badge badge-purple">{aluno.progressoGeral}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm">Todos os alunos estao com bom progresso no momento.</p>
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
                  {data.atividadeRecente?.length ? data.atividadeRecente.map((item) => (
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
