import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import AppIcon from '../../components/AppIcon';
import { apiUrl } from '../../lib/api';

export default function StudentMateriais() {
  const [materiais, setMateriais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      .catch(() => setError('Nao foi possivel carregar a biblioteca agora.'))
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
        {error && <div className="inline-feedback warning">{error}</div>}
        <section className="student-topbar">
          <div>
            <span className="section-kicker">Biblioteca</span>
            <h1 className="student-page-title">Materiais de apoio</h1>
            <p className="student-page-subtitle">
              Acesse PDFs, apostilas e arquivos complementares com visualizacao integrada e download controlado.
            </p>
          </div>
        </section>

        <section className="library-shell surface-stack">
          <div className="panel-card surface-stack">
            <div>
              <span className="section-kicker">FILTROS</span>
              <h3>Refine a biblioteca</h3>
            </div>
            
            <div className="library-filter-toolbar">
              <div className="search-field">
                <AppIcon name="search" size={16} />
                <input aria-label="Buscar material" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar material" />
              </div>
            
              <div className="category-filter-list">
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

              <div className="library-filter-summary">
                <strong>{filtrados.length}</strong>
                <span>encontrados</span>
              </div>
            </div>
          </div>

          <section className="library-main">
            {loading ? (
              <div className="card-grid">
                {[1, 2, 3].map((item) => <div key={item} className="skeleton skeleton-card" />)}
              </div>
            ) : materiais.length === 0 ? (
              <div className="empty-panel">
                <AppIcon name="file" size={20} />
                <p>Nenhum material foi publicado ainda.</p>
              </div>
            ) : (
              <>
                <div className="resource-grid">
                  {filtrados.map((material) => (
                    <article className={`resource-browser-card ${materialSelecionado?.id === material.id ? 'active' : ''}`} key={material.id}>
                      <div className="resource-browser-body">
                        <div className="resource-card-head">
                          <div className="resource-browser-icon">
                            <AppIcon name="file" size={18} />
                          </div>
                          <strong>{material.titulo}</strong>
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

                {!filtrados.length && (
                  <div className="empty-panel">
                    <AppIcon name="search" size={20} />
                    <p>Nenhum material corresponde aos filtros atuais.</p>
                  </div>
                )}

                {materialSelecionado && filtrados.some((item) => item.id === materialSelecionado.id) ? (
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
                        src={materialSelecionado.urlArquivo.startsWith('/uploads/') ? `/api${materialSelecionado.urlArquivo}` : apiUrl(materialSelecionado.urlArquivo)}
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
