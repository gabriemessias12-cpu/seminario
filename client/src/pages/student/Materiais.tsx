import { useEffect, useMemo, useState } from 'react';

import AppIcon from '../../components/AppIcon';
import Sidebar from '../../components/Sidebar';
import { apiGet } from '../../lib/apiClient';
import { apiUrl } from '../../lib/api';
import type { Material } from '../../types/models';

type MaterialListResponse = Material[] | {
  data?: Material[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

function getFileUrl(urlArquivo: string) {
  return urlArquivo.startsWith('/uploads/') ? `/api${urlArquivo}` : apiUrl(urlArquivo);
}

export default function StudentMateriais() {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    apiGet<MaterialListResponse>('/api/aluno/materiais')
      .then((response) => {
        const lista = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];
        setMateriais(lista);
      })
      .catch(() => setError('Não foi possível carregar a biblioteca agora.'))
      .finally(() => setLoading(false));
  }, []);

  const categorias = useMemo(() => ['todos', ...new Set(materiais.map((m) => m.categoria))], [materiais]);

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
              Acesse PDFs, apostilas e arquivos complementares disponibilizados pelo seminario.
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
                <input aria-label="Buscar material" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar material" />
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
                {!filtrados.length ? (
                  <div className="empty-panel">
                    <AppIcon name="search" size={20} />
                    <p>Nenhum material corresponde aos filtros atuais.</p>
                  </div>
                ) : (
                  <div className="resource-grid">
                    {filtrados.map((material) => {
                      const fileUrl = getFileUrl(material.urlArquivo);
                      return (
                        <article className="resource-browser-card" key={material.id}>
                          <div className="resource-browser-body">
                            <div className="resource-card-head">
                              <div className="resource-browser-icon">
                                <AppIcon name="file" size={18} />
                              </div>
                              <strong>{material.titulo}</strong>
                            </div>
                            {material.descricao && <p>{material.descricao}</p>}
                            <div className="resource-browser-meta">
                              <span className="badge badge-purple">{material.categoria}</span>
                              <span>{material.tipo.toUpperCase()}</span>
                            </div>
                          </div>
                          <div className="resource-actions" style={{ marginTop: '0.75rem' }}>
                            <a className="btn btn-outline btn-sm" href={fileUrl} target="_blank" rel="noreferrer">
                              <AppIcon name="external" size={14} />
                              <span>Abrir</span>
                            </a>
                            {material.permiteDownload && (
                              <a className="btn btn-primary btn-sm" href={fileUrl} download>
                                <AppIcon name="download" size={14} />
                                <span>Download</span>
                              </a>
                            )}
                          </div>
                        </article>
                      );
                    })}
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
