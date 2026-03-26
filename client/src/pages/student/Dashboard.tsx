import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AppIcon from '../../components/AppIcon';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPut } from '../../lib/apiClient';
import type { Modulo, StudentDashboardData } from '../../types/models';

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = () => {
    setLoading(true);
    setError('');
    Promise.all([
      apiGet<StudentDashboardData>('/api/aluno/dashboard'),
      apiGet<Modulo[]>('/api/aluno/aulas')
    ])
      .then(([dashboard, aulas]) => {
        setData(dashboard);
        setModulos(aulas);
      })
      .catch(() => setError('Não foi possível carregar o painel do aluno agora.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await apiPut(`/api/aluno/notificacao/${id}/lida`);
      loadData();
    } catch {
      setError('Não foi possível atualizar a notificação.');
    }
  };

  const firstName = user?.nome?.split(' ')[0] || 'Aluno';
  const totalTrilhas = modulos.length;

  const aulasEmFalta = useMemo(() => {
    const faltas: any[] = [];
    modulos.forEach(modulo => {
      (modulo.aulas ?? []).forEach((aula: any) => {
        const presenca = aula.presencas?.[0];
        const progresso = aula.progressos?.[0];
        if (presenca?.status === 'ausente' && !progresso?.concluido) {
          faltas.push({ ...aula, moduloTitulo: modulo.titulo });
        }
      });
    });
    return faltas;
  }, [modulos]);

  const cards = useMemo(() => {
    return [
      {
        label: 'Conteúdos concluídos',
        value: data ? `${data.aulasConcluidas}/${data.totalAulas}` : '--',
        icon: 'library' as const
      },
      {
        label: 'Progresso total',
        value: data ? `${data.percentualCurso}%` : '--',
        icon: 'dashboard' as const
      },
      {
        label: 'Média nos quizzes',
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
            <span className="section-kicker">IBVN - Seminário Teológico</span>
            <h1 className="student-page-title">Olá, {firstName}</h1>
            <p className="student-page-subtitle">
              Continue sua formação com conteúdo organizado por trilhas e materiais de apoio.
            </p>
          </div>

          <div className="student-topbar-actions">
            <button aria-label="Abrir conteúdos" className="icon-button" type="button" onClick={() => navigate('/aulas')}>
              <AppIcon name="search" size={18} />
            </button>
            <button aria-label="Abrir perfil e notificações" className="icon-button" type="button" onClick={() => navigate('/perfil')}>
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
              A plataforma agora separa seus conteúdos em uma estrutura mais profissional, com foco em continuidade e
              revisão de conteúdo por aula.
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
                <span>{data?.aulasConcluidas || 0} aulas concluídas</span>
                <span>{totalTrilhas} trilhas liberadas</span>
              </div>
            </div>

            <div className="student-hero-actions">
              <button className="btn btn-primary btn-lg" type="button" onClick={() => navigate(data?.proximaAula ? `/aula/${data.proximaAula.id}` : '/aulas')}>
                <AppIcon name="play" size={16} />
                <span>{data?.proximaAula ? 'Continuar assistindo' : 'Explorar conteúdos'}</span>
              </button>
            </div>
          </div>

          <div className="student-hero-side">
            <div className="hero-course-card">
              <div className="hero-course-card-header">
                <span className="pill">Próxima aula</span>
                <span className="pill subtle">{data?.proximaAula ? 'Liberada' : 'Concluída'}</span>
              </div>
              <h3>{data?.proximaAula?.titulo || 'Curso concluído'}</h3>
              <p>
                {data?.proximaAula?.descricao || 'Você terminou todas as aulas publicadas. Revise materiais e resultados.'}
              </p>
              {data?.proximaAula && (
                <button className="btn btn-accent" type="button" onClick={() => navigate(`/aula/${data.proximaAula!.id}`)}>
                  <AppIcon name="chevron-right" size={16} />
                  <span>Acessar aula</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {aulasEmFalta.length > 0 && (
          <section className="student-section" style={{ marginTop: '2rem' }}>
            <div className="student-section-header">
              <div>
                <span className="section-kicker" style={{ color: 'var(--color-error)' }}>Atenção</span>
                <h2>Aulas em falta</h2>
                <p className="text-muted text-sm">Você possui faltas registradas nestas aulas. Assista para revisar o conteúdo.</p>
              </div>
            </div>
            <div className="card-grid">
              {aulasEmFalta.map(aula => (
                <article key={aula.id} className="panel-card" style={{ borderLeft: '4px solid var(--color-error)' }}>
                  <div style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span className="pill subtle" style={{ fontSize: '0.7rem' }}>{aula.moduloTitulo}</span>
                      <span className="badge badge-error">Falta registrada</span>
                    </div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{aula.titulo}</h3>
                    <button className="btn btn-outline btn-sm" onClick={() => navigate(`/aula/${aula.id}`)}>
                      Assistir aula
                      <AppIcon name="chevron-right" size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

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
              Ver todos os conteúdos
              <AppIcon name="chevron-right" size={16} />
            </button>
          </div>

          <div className="track-grid">
            {modulos.length ? modulos.map((modulo: any, index: number) => {
              const aulasModulo = modulo.aulas ?? [];
              const totalAulas = aulasModulo.length;
              const concluidas = aulasModulo.filter((aula: any) => aula.progressos?.[0]?.concluido).length;
              const progresso = totalAulas > 0 ? Math.round((concluidas / totalAulas) * 100) : 0;
              const destaque = aulasModulo.find((aula: any) => !aula.progressos?.[0]?.concluido) || aulasModulo[0];

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
                      <span>{progresso}% concluído</span>
                    </div>
                    {destaque && <small>Próximo conteúdo: {destaque.titulo}</small>}
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
                <h2>Notificações recentes</h2>
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
                  <p>Não há notificações novas no momento.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
