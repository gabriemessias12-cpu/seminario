import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import AppIcon from '../../components/AppIcon';
import { apiUrl } from '../../lib/api';

export default function StudentMateriais() {
  const [materiais, setMateriais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [busca, setBusca] = useState('');
  const [materialSelecionado, setMaterialSelecionado] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/aluno/materiais', {
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
    })
      .then((response) => response.json())
      .then((data) => {
        setMateriais(data);
        setMaterialSelecionado(data[0] || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const categorias = useMemo(() => ['todos', ...new Set(materiais.map((material) => material.categoria))], [materiais]);

  const filtrados = useMemo(() => {
    return materiais.filter((material) => {
      const atendeCategoria = filtroCategoria === 'todos' || material.categoria === filtroCategoria;
      const atendeBusca = !busca || `${material.titulo} ${material.descricao || ''}`.toLowerCase().includes(busca.toLowerCase());
      return atendeCategoria && atendeBusca;
    });
  }, [busca, filtroCategoria, materiais]);

  return (
    <div className="layout student-layout">
      <Sidebar type="student" />
      <main className="main-content student-main">
        <section className="student-topbar">
          <div>
            <span className="section-kicker">Biblioteca</span>
            <h1 className="student-page-title">Materiais de apoio</h1>
            <p className="student-page-subtitle">
              Acesse PDFs, apostilas e arquivos complementares com visualizacao integrada e download controlado.
            </p>
          </div>
        </section>

        <section className="library-shell" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <span className="section-kicker">FILTROS</span>
              <h3 style={{ margin: 0 }}>Refine a biblioteca</h3>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
              <div className="search-field" style={{ flex: '1 1 250px' }}>
                <AppIcon name="search" size={16} />
              <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar material" />
            </div>
            
            <div className="category-filter-list" style={{ flex: '2 1 auto', display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {categorias.map((categoria) => (
                <button
                  className={`category-filter-chip ${filtroCategoria === categoria ? 'active' : ''}`}
                  key={categoria}
                  type="button"
                  onClick={() => setFiltroCategoria(categoria)}
                >
                  {categoria === 'todos' ? 'Todas as categorias' : categoria}
                </button>
              ))}
            </div>

              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                <strong>{filtrados.length}</strong> encontrados
              </div>
            </div>
          </div>

          <section className="library-main" style={{ width: '100%', maxWidth: '100%' }}>
            {loading ? (
              <div className="card-grid">
                {[1, 2, 3].map((item) => <div key={item} className="skeleton skeleton-card" />)}
              </div>
            ) : (
              <>
                <div className="resource-grid">
                  {filtrados.map((material) => (
                    <article className={`resource-browser-card ${materialSelecionado?.id === material.id ? 'active' : ''}`} key={material.id}>
                      <div className="resource-browser-body">
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                          <div className="resource-browser-icon" style={{ margin: 0 }}>
                            <AppIcon name="file" size={18} />
                          </div>
                          <strong style={{ fontSize: '1.1rem', marginTop: '2px' }}>{material.titulo}</strong>
                        </div>
                        <p>{material.descricao}</p>
                        <div className="resource-browser-meta">
                          <span className="badge badge-purple">{material.categoria}</span>
                          <span>{material.tipo.toUpperCase()}</span>
                        </div>
                      </div>
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => setMaterialSelecionado(material)}>
                        Abrir
                      </button>
                    </article>
                  ))}
                </div>

                {materialSelecionado ? (
                  <div className="panel-card material-preview-panel">
                    <div className="material-preview-header">
                      <div>
                        <span className="section-kicker">Visualizacao</span>
                        <h3>{materialSelecionado.titulo}</h3>
                        <p>{materialSelecionado.descricao}</p>
                      </div>
                      <div className="resource-actions">
                        <a className="btn btn-outline btn-sm" href={apiUrl(materialSelecionado.urlArquivo)} target="_blank" rel="noreferrer">
                          <AppIcon name="external" size={14} />
                          <span>Nova guia</span>
                        </a>
                        {materialSelecionado.permiteDownload && (
                          <a className="btn btn-primary btn-sm" href={apiUrl(materialSelecionado.urlArquivo)} download>
                            <AppIcon name="download" size={14} />
                            <span>Download</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {materialSelecionado.tipo === 'pdf' ? (
                      <iframe
                        title={materialSelecionado.titulo}
                        src={apiUrl(materialSelecionado.urlArquivo)}
                        className="material-preview-frame"
                      />
                    ) : (
                      <div className="empty-panel">
                        <AppIcon name="external" size={20} />
                        <p>Preview indisponivel para este formato. Abra o arquivo em uma nova guia.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty-panel">
                    <AppIcon name="file" size={20} />
                    <p>Selecione um material para visualizar.</p>
                  </div>
                )}
              </>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
