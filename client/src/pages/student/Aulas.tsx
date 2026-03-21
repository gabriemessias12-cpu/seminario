import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import AppIcon from '../../components/AppIcon';

export default function StudentAulas() {
  const navigate = useNavigate();
  const [modulos, setModulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    fetch('/api/aluno/aulas', {
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
    })
      .then((response) => response.json())
      .then(setModulos)
      .catch(() => setError('Nao foi possivel carregar os conteudos agora.'))
      .finally(() => setLoading(false));
  }, []);

  const getStatus = (aula: any) => {
    const progresso = aula.progressos?.[0];
    if (!progresso) {
      return { label: 'Nao iniciada', pct: 0, variant: 'badge-info' };
    }

    if (progresso.concluido) {
      return { label: 'Concluida', pct: 100, variant: 'badge-success' };
    }

    return {
      label: 'Em andamento',
      pct: Math.round(progresso.percentualAssistido),
      variant: 'badge-warning'
    };
  };

  const modulosFiltrados = useMemo(() => {
    return modulos
      .map((modulo) => ({
        ...modulo,
        aulas: modulo.aulas.filter((aula: any) => {
          const status = getStatus(aula);
          const texto = `${aula.titulo} ${aula.descricao || ''}`.toLowerCase();
          const atendeBusca = !busca || texto.includes(busca.toLowerCase());

          if (!atendeBusca) {
            return false;
          }

          if (filtroStatus === 'nao_iniciada') {
            return status.pct === 0;
          }

          if (filtroStatus === 'em_andamento') {
            return status.pct > 0 && status.pct < 100;
          }

          if (filtroStatus === 'concluida') {
            return status.pct >= 95;
          }

          return true;
        })
      }))
      .filter((modulo) => modulo.aulas.length > 0);
  }, [busca, filtroStatus, modulos]);

  return (
    <div className="layout student-layout">
      <Sidebar type="student" />
      <main className="main-content student-main">
        {error && <div className="inline-feedback warning">{error}</div>}
        <section className="student-topbar">
          <div>
            <span className="section-kicker">Catalogo</span>
            <h1 className="student-page-title">Todos os conteudos</h1>
            <p className="student-page-subtitle">
              Navegue pelas trilhas, filtre por status e abra qualquer aula com progresso salvo automaticamente.
            </p>
          </div>
          <button className="btn btn-outline" type="button" onClick={() => navigate('/dashboard')}>
            <AppIcon name="arrow-left" size={16} />
            <span>Voltar ao painel</span>
          </button>
        </section>

        <section className="catalog-shell">
          <div className="catalog-highlight catalog-highlight-row">
            <div>
              <span className="section-kicker">Trilhas ativas</span>
              <h2>{modulos.length} modulos organizados para estudo continuo</h2>
            </div>
            <button className="btn btn-primary" type="button" onClick={() => navigate('/materiais')}>
              Abrir biblioteca
              <AppIcon name="chevron-right" size={16} />
            </button>
          </div>

          <div className="catalog-grid">
            {modulos.map((modulo: any, index: number) => (
              <article className="catalog-card" key={modulo.id}>
                <div className="catalog-card-visual" style={{ 
                  backgroundImage: modulo.capaUrl ? `url(${modulo.capaUrl})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}>
                  {!modulo.capaUrl && <span>{String(index + 1).padStart(2, '0')}</span>}
                </div>
                <strong>{modulo.titulo}</strong>
                <p>{modulo.descricao}</p>
                <small>{modulo.aulas.length} aulas</small>
              </article>
            ))}
          </div>
        </section>

        <section className="content-panel">
          <div className="content-panel-toolbar">
            <div className="search-field">
              <AppIcon name="search" size={16} />
              <input
                aria-label="Buscar conteudo"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar conteudo, assunto ou descricao"
              />
            </div>

            <select aria-label="Filtrar por status" className="filter-select" value={filtroStatus} onChange={(event) => setFiltroStatus(event.target.value)}>
              <option value="todos">Todos os status</option>
              <option value="nao_iniciada">Nao iniciadas</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Concluidas</option>
            </select>
          </div>

          {loading ? (
            <div className="card-grid">
              {[1, 2, 3, 4].map((item) => <div key={item} className="skeleton skeleton-card" />)}
            </div>
          ) : (
            <div className="lesson-groups">
              {modulosFiltrados.map((modulo: any, moduloIndex: number) => (
                <article className="lesson-group" key={modulo.id}>
                  <div className="lesson-group-header">
                    <div className="lesson-group-number">{String(moduloIndex + 1).padStart(2, '0')}</div>
                    <div>
                      <h2>{modulo.titulo}</h2>
                      <p>{modulo.descricao}</p>
                    </div>
                  </div>

                  <div className="lesson-list">
                    {modulo.aulas.map((aula: any, index: number) => {
                      const status = getStatus(aula);

                      return (
                        <button
                          key={aula.id}
                          className="lesson-list-item lesson-list-item-advanced"
                          type="button"
                          onClick={() => navigate(`/aula/${aula.id}`)}
                        >
                          <div className="lesson-index-circle">{index + 1}</div>
                          <div className="lesson-list-content">
                            <div className="lesson-list-title-row">
                              <strong>{aula.titulo}</strong>
                              <span className={`badge ${status.variant}`}>{status.label}</span>
                            </div>
                            <p>{aula.descricao}</p>
                            <div className="lesson-list-meta">
                              <span className="inline-meta-row">
                                <AppIcon name="clock" size={14} />
                                {Math.max(1, Math.floor(aula.duracaoSegundos / 60))} min
                              </span>
                              <span>{status.pct}% assistido</span>
                            </div>
                            <div className="progress-bar">
                              <div className={`progress-bar-fill ${status.pct >= 95 ? 'completed' : ''}`} style={{ width: `${status.pct}%` }} />
                            </div>
                          </div>
                          <AppIcon name="chevron-right" size={18} />
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}

              {!modulosFiltrados.length && (
                <div className="empty-panel">
                  <AppIcon name="search" size={20} />
                  <p>Nenhum conteudo corresponde aos filtros atuais.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
