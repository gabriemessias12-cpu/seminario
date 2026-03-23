import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import AppIcon from '../../components/AppIcon';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

interface DashboardData {
  totalAulas: number;
  aulasConcluidas: number;
  percentualCurso: number;
  mediaQuiz: number;
  notificacoes: Array<{ id: string; titulo: string; mensagem: string }>;
  proximaAula: any;
  atividadeRecente: any[];
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [modulos, setModulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = () => {
    const token = localStorage.getItem('accessToken');
    setLoading(true);
    setError('');
    Promise.all([
      fetchWithTimeout('/api/aluno/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      }).then((response) => response.json()),
      fetchWithTimeout('/api/aluno/aulas', {
        headers: { Authorization: `Bearer ${token}` }
      }).then((response) => response.json())
    ])
      .then(([dashboard, aulas]) => {
        setData(dashboard);
        setModulos(aulas);
      })
      .catch(() => {
        setError('Nao foi possivel carregar o painel do aluno agora.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkRead = async (id: string) => {
    const token = localStorage.getItem('accessToken');
    try {
      const res = await fetch(`/api/aluno/notificacao/${id}/lida`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        // Optimistic update or reload
        loadData();
      }
    } catch (err) {
      setError('Nao foi possivel atualizar a notificacao.');
    }
  };

  const firstName = user?.nome?.split(' ')[0] || 'Aluno';
  const totalTrilhas = modulos.length;

  const cards = useMemo(() => {
    return [
      {
        label: 'Conteudos concluidos',
        value: data ? `${data.aulasConcluidas}/${data.totalAulas}` : '--',
        icon: 'library' as const
      },
      {
        label: 'Progresso total',
        value: data ? `${data.percentualCurso}%` : '--',
        icon: 'dashboard' as const
      },
      {
        label: 'Media nos quizzes',
        value: data ? `${data.mediaQuiz}%` : '--',
        icon: 'target' as const
      }
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="layout student-layout">
        <Sidebar type="student" />
        <main className="main-content student-main">
          <div className="skeleton" style={{ height: 320, marginBottom: '1.5rem' }} />
          <div className="card-grid">
            {[1, 2, 3, 4].map((item) => <div key={item} className="skeleton skeleton-card" />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="layout student-layout">
      <Sidebar type="student" />
      <main className="main-content student-main">
        {error && <div className="inline-feedback warning">{error}</div>}
        <section className="student-topbar">
          <div>
            <span className="section-kicker">IBVN - Seminario Teologico</span>
            <h1 className="student-page-title">Ola, {firstName}</h1>
            <p className="student-page-subtitle">
              Continue sua formacao com conteudo organizado por trilhas e materiais de apoio.
            </p>
          </div>

          <div className="student-topbar-actions">
            <button aria-label="Abrir conteudos" className="icon-button" type="button" onClick={() => navigate('/aulas')}>
              <AppIcon name="search" size={18} />
            </button>
            <button aria-label="Abrir perfil e notificacoes" className="icon-button" type="button" onClick={() => navigate('/perfil')}>
              <AppIcon name="bell" size={18} />
            </button>
            <button aria-label="Abrir perfil" className="profile-chip" type="button" onClick={() => navigate('/perfil')}>
              <span>{firstName.slice(0, 1).toUpperCase()}</span>
            </button>
          </div>
        </section>

        <section className="student-hero">
          <div className="student-hero-copy">
            <h2>Ambiente de estudos com trilhas e materiais completos.</h2>
            <p>
              A plataforma agora separa seus conteudos em uma estrutura mais profissional, com foco em continuidade e
              revisao de conteudo por aula.
            </p>

            <div className="hero-progress-panel">
              <div className="hero-progress-header">
                <span>Progresso geral</span>
                <strong>{data?.percentualCurso || 0}%</strong>
              </div>
              <div className="progress-bar progress-bar-large">
                <div className="progress-bar-fill" style={{ width: `${data?.percentualCurso || 0}%` }} />
              </div>
              <div className="hero-progress-meta">
                <span>{data?.aulasConcluidas || 0} aulas concluidas</span>
                <span>{totalTrilhas} trilhas liberadas</span>
              </div>
            </div>

            <div className="student-hero-actions">
              <button className="btn btn-primary btn-lg" type="button" onClick={() => navigate(data?.proximaAula ? `/aula/${data.proximaAula.id}` : '/aulas')}>
                <AppIcon name="play" size={16} />
                <span>{data?.proximaAula ? 'Continuar assistindo' : 'Explorar conteudos'}</span>
              </button>
            </div>
          </div>

          <div className="student-hero-side">
            <div className="hero-course-card">
              <div className="hero-course-card-header">
                <span className="pill">Proxima aula</span>
                <span className="pill subtle">{data?.proximaAula ? 'Liberada' : 'Concluida'}</span>
              </div>
              <h3>{data?.proximaAula?.titulo || 'Curso concluido'}</h3>
              <p>
                {data?.proximaAula?.descricao || 'Voce terminou todas as aulas publicadas. Revise materiais e resultados.'}
              </p>
              {data?.proximaAula && (
                <button className="btn btn-accent" type="button" onClick={() => navigate(`/aula/${data.proximaAula.id}`)}>
                  <AppIcon name="chevron-right" size={16} />
                  <span>Acessar aula</span>
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="student-stats-grid">
          {cards.map((card) => (
            <article key={card.label} className="student-stat-tile">
              <div className="student-stat-icon">
                <AppIcon name={card.icon} size={18} />
              </div>
              <div>
                <strong>{card.value}</strong>
                <span>{card.label}</span>
              </div>
            </article>
          ))}
        </section>

        <section className="student-section">
          <div className="student-section-header">
            <div>
              <span className="section-kicker">Trilhas</span>
              <h2>Estrutura do curso</h2>
            </div>
            <button className="text-link-button" type="button" onClick={() => navigate('/aulas')}>
              Ver todos os conteudos
              <AppIcon name="chevron-right" size={16} />
            </button>
          </div>

          <div className="track-grid">
            {modulos.length ? modulos.map((modulo: any, index: number) => {
              const totalAulas = modulo.aulas.length;
              const concluidas = modulo.aulas.filter((aula: any) => aula.progressos?.[0]?.concluido).length;
              const progresso = totalAulas > 0 ? Math.round((concluidas / totalAulas) * 100) : 0;
              const destaque = modulo.aulas.find((aula: any) => !aula.progressos?.[0]?.concluido) || modulo.aulas[0];

              return (
                <article
                  className="track-card"
                  key={modulo.id}
                  onClick={() => navigate('/aulas')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      navigate('/aulas');
                    }
                  }}
                >
                  <div className="track-card-visual" style={{ 
                    backgroundImage: modulo.capaUrl ? `url(${modulo.capaUrl})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {!modulo.capaUrl && <span className="track-card-index">{String(index + 1).padStart(2, '0')}</span>}
                    {modulo.capaUrl && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />}
                    <div className="track-card-glow" />
                  </div>
                  <div className="track-card-body">
                    <span className="pill subtle">Trilha</span>
                    <h3>{modulo.titulo}</h3>
                    <p>{modulo.descricao}</p>
                    <div className="track-card-progress">
                      <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${progresso}%` }} />
                      </div>
                      <span>{progresso}% concluido</span>
                    </div>
                    {destaque && <small>Proximo conteudo: {destaque.titulo}</small>}
                  </div>
                </article>
              );
            }) : (
              <div className="empty-panel">
                <AppIcon name="book" size={20} />
                <p>Nenhuma trilha foi publicada ainda.</p>
              </div>
            )}
          </div>
        </section>

        <section className="student-grid-two">
          <div className="panel-card">
            <div className="student-section-header compact">
              <div>
                <span className="section-kicker">Atividade</span>
                <h2>Retomar de onde parou</h2>
              </div>
            </div>

            <div className="lesson-list">
              {data?.atividadeRecente?.length ? (
                data.atividadeRecente.map((item: any) => (
                  <button
                    key={item.id}
                    className="lesson-list-item"
                    type="button"
                    onClick={() => navigate(`/aula/${item.aulaId}`)}
                  >
                    <div className="lesson-index-circle">
                      <AppIcon name={item.concluido ? 'check' : 'play'} size={16} />
                    </div>
                    <div className="lesson-list-content">
                      <strong>{item.aula?.titulo}</strong>
                      <div className="progress-bar">
                        <div className={`progress-bar-fill ${item.concluido ? 'completed' : ''}`} style={{ width: `${item.percentualAssistido}%` }} />
                      </div>
                    </div>
                    <span>{Math.round(item.percentualAssistido)}%</span>
                  </button>
                ))
              ) : (
                <div className="empty-panel">
                  <AppIcon name="play" size={20} />
                  <p>Nenhuma atividade recente ainda. Abra sua primeira aula para iniciar.</p>
                </div>
              )}
            </div>
          </div>

          <div className="panel-card">
            <div className="student-section-header compact">
              <div>
                <span className="section-kicker">Avisos</span>
                <h2>Notificacoes recentes</h2>
              </div>
            </div>

            <div className="notice-stack">
              {data?.notificacoes?.length ? (
                data.notificacoes.map((item) => (
                  <article key={item.id} className="notice-card">
                    <div className="notice-icon">
                      <AppIcon name="bell" size={16} />
                    </div>
                    <div className="notice-card-body">
                      <strong>{item.titulo}</strong>
                      <p>{item.mensagem}</p>
                    </div>
                    <button 
                      aria-label={`Marcar aviso ${item.titulo} como lido`}
                      className="icon-button" 
                      onClick={() => handleMarkRead(item.id)}
                      title="Marcar como lida"
                      type="button"
                    >
                      <AppIcon name="check" size={14} />
                    </button>
                  </article>
                ))
              ) : (
                <div className="empty-panel">
                  <AppIcon name="check" size={20} />
                  <p>Nao ha notificacoes novas no momento.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
