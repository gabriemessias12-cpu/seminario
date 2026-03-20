import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppIcon from '../../components/AppIcon';

export default function AdminAlunoDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aluno, setAluno] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    fetch(`/api/admin/aluno/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then(setAluno)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div className="skeleton skeleton-title" />
        </div>
        <div className="skeleton skeleton-card" style={{ height: 400 }} />
      </>
    );
  }

  if (!aluno) {
    return (
      <>
        <p>Aluno nao encontrado.</p>
      </>
    );
  }

  const initials = aluno.nome?.split(' ').map((item: string) => item[0]).slice(0, 2).join('').toUpperCase() || 'SV';
  const avgProgress = aluno.progressos?.length
    ? Math.round(aluno.progressos.reduce((sum: number, progresso: any) => sum + progresso.percentualAssistido, 0) / aluno.progressos.length)
    : 0;

  return (
    <>
        <button className="btn btn-ghost mb-2" onClick={() => navigate('/admin/alunos')}>
          <AppIcon name="arrow-left" size={14} />
          <span>Voltar para lista</span>
        </button>

        <div className="card mb-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ width: 72, height: 72, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 700, color: 'white' }}>
              {initials}
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.15rem' }}>{aluno.nome}</h2>
              <p className="text-muted">{aluno.email} • {aluno.telefone}</p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <span className={`badge ${aluno.ativo ? 'badge-success' : 'badge-error'}`}>{aluno.ativo ? 'Ativo' : 'Inativo'}</span>
                <span className="badge badge-purple">{aluno.papel}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { icon: 'reports' as const, className: 'purple', value: `${avgProgress}%`, label: 'Progresso geral' },
            { icon: 'check' as const, className: 'green', value: aluno.progressos?.filter((item: any) => item.concluido).length || 0, label: 'Aulas concluidas' },
            { icon: 'target' as const, className: 'orange', value: aluno.resultadosQuiz?.length ? `${Math.round(aluno.resultadosQuiz.reduce((sum: number, item: any) => sum + ((item.pontuacao / item.totalQuestoes) * 100), 0) / aluno.resultadosQuiz.length)}%` : 'N/A', label: 'Media quizzes' },
            { icon: 'attendance' as const, className: 'blue', value: aluno.progressos?.reduce((sum: number, item: any) => sum + item.sessoes, 0) || 0, label: 'Total sessoes' }
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

        <div className="card mb-3">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Progresso por aula</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Aula</th>
                  <th>Modulo</th>
                  <th>Progresso</th>
                  <th>Sessoes</th>
                  <th>Pausas</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {aluno.progressos?.map((progresso: any) => (
                  <tr key={progresso.id}>
                    <td style={{ fontWeight: 500 }}>{progresso.aula?.titulo}</td>
                    <td className="text-muted">{progresso.aula?.modulo?.titulo}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="progress-bar" style={{ width: 80 }}>
                          <div className={`progress-bar-fill ${progresso.concluido ? 'completed' : ''}`} style={{ width: `${progresso.percentualAssistido}%` }} />
                        </div>
                        <span className="text-sm">{Math.round(progresso.percentualAssistido)}%</span>
                      </div>
                    </td>
                    <td>{progresso.sessoes}</td>
                    <td>{progresso.vezesQueParou}</td>
                    <td>
                      <span className={`badge ${progresso.concluido ? 'badge-success' : progresso.percentualAssistido > 0 ? 'badge-warning' : 'badge-info'}`}>
                        {progresso.concluido ? 'Concluida' : progresso.percentualAssistido > 0 ? 'Em progresso' : 'Nao iniciada'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card mb-3">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Presenca</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Aula</th>
                  <th>Status</th>
                  <th>Percentual</th>
                </tr>
              </thead>
              <tbody>
                {aluno.presencas?.map((presenca: any) => (
                  <tr key={presenca.id}>
                    <td>{presenca.aula?.titulo}</td>
                    <td>
                      <span className={`badge ${presenca.status === 'presente' ? 'badge-success' : presenca.status === 'parcial' ? 'badge-warning' : 'badge-error'}`}>
                        {presenca.status}
                      </span>
                    </td>
                    <td>{Math.round(presenca.percentual)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {aluno.resultadosQuiz?.length > 0 && (
          <div className="card mb-3">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Resultados dos quizzes</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Aula</th>
                    <th>Pontuacao</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {aluno.resultadosQuiz.map((resultado: any) => (
                    <tr key={resultado.id}>
                      <td>{resultado.aula?.titulo}</td>
                      <td><span className={`badge ${resultado.pontuacao >= 4 ? 'badge-success' : resultado.pontuacao >= 3 ? 'badge-warning' : 'badge-error'}`}>{resultado.pontuacao}/{resultado.totalQuestoes}</span></td>
                      <td className="text-muted">{new Date(resultado.feitoEm).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Historico de login</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>IP</th>
                  <th>Dispositivo</th>
                </tr>
              </thead>
              <tbody>
                {aluno.loginHistorico?.map((login: any) => (
                  <tr key={login.id}>
                    <td>{new Date(login.dataHora).toLocaleString('pt-BR')}</td>
                    <td className="text-muted">{login.ip}</td>
                    <td className="text-muted" style={{ fontSize: '0.8rem', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{login.dispositivo?.substring(0, 50)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    </>
  );
}
