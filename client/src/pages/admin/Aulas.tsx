import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../../components/AppIcon';
import { clearDraft, readDraft, writeDraft } from '../../lib/draft-storage';

type FeedbackTone = 'success' | 'warning';

interface ModuleDraft {
  title: string;
  description: string;
  coverUrl: string;
  open: boolean;
  savedAt: number;
}

interface ContentHistoryItem {
  id: string;
  usuarioNome: string;
  entidade: 'modulo' | 'aula';
  entidadeTitulo: string;
  acao: 'criado' | 'atualizado' | 'excluido';
  criadoEm: string;
  detalhes?: Record<string, unknown> | null;
}

const MODULE_DRAFT_KEY = 'admin:aulas:new-module-draft';

function formatHistoryAction(item: ContentHistoryItem): string {
  const actionLabel =
    item.acao === 'criado' ? 'criou' : item.acao === 'atualizado' ? 'atualizou' : 'removeu';
  const entityLabel = item.entidade === 'modulo' ? 'o modulo' : 'a aula';
  return `${item.usuarioNome} ${actionLabel} ${entityLabel}`;
}

export default function AdminAulas() {
  const navigate = useNavigate();
  const [modulos, setModulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('warning');
  const [history, setHistory] = useState<ContentHistoryItem[]>([]);
  const token = localStorage.getItem('accessToken');

  const [showNewModule, setShowNewModule] = useState(false);
  const [newModTitle, setNewModTitle] = useState('');
  const [newModDesc, setNewModDesc] = useState('');
  const [newModCapa, setNewModCapa] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [],
  );

  const loadData = () => {
    setLoading(true);
    setHistoryLoading(true);

    Promise.all([
      fetch('/api/admin/aulas', { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()),
      fetch('/api/admin/conteudo-historico?limit=12', { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()),
    ])
      .then(([modulosData, historyData]) => {
        setModulos(Array.isArray(modulosData) ? modulosData : []);
        setHistory(Array.isArray(historyData) ? historyData : []);
      })
      .catch(() => {
        setFeedbackTone('warning');
        setFeedback('Nao foi possivel carregar os modulos e o historico agora.');
      })
      .finally(() => {
        setLoading(false);
        setHistoryLoading(false);
      });
  };

  useEffect(() => {
    const draft = readDraft<ModuleDraft>(MODULE_DRAFT_KEY);
    if (draft) {
      setShowNewModule(draft.open || Boolean(draft.title || draft.description || draft.coverUrl));
      setNewModTitle(draft.title || '');
      setNewModDesc(draft.description || '');
      setNewModCapa(draft.coverUrl || '');
      setDraftSavedAt(draft.savedAt || null);
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!draftReady) {
      return;
    }

    const hasDraft = Boolean(showNewModule || newModTitle.trim() || newModDesc.trim() || newModCapa.trim());
    if (!hasDraft) {
      clearDraft(MODULE_DRAFT_KEY);
      setDraftSavedAt(null);
      return;
    }

    const nextSavedAt = Date.now();
    writeDraft<ModuleDraft>(MODULE_DRAFT_KEY, {
      title: newModTitle,
      description: newModDesc,
      coverUrl: newModCapa,
      open: showNewModule,
      savedAt: nextSavedAt,
    });
    setDraftSavedAt(nextSavedAt);
  }, [draftReady, newModCapa, newModDesc, newModTitle, showNewModule]);

  const clearModuleDraft = () => {
    clearDraft(MODULE_DRAFT_KEY);
    setNewModTitle('');
    setNewModDesc('');
    setNewModCapa('');
    setShowNewModule(false);
    setDraftSavedAt(null);
  };

  const handleCreateModulo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newModTitle.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/admin/modulo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          titulo: newModTitle.trim(),
          descricao: newModDesc.trim(),
          capaUrl: newModCapa.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Nao foi possivel criar o modulo.');
      }

      clearModuleDraft();
      setFeedbackTone('success');
      setFeedback('Modulo criado, registrado no historico e sincronizado com a lista.');
      loadData();
    } catch (error) {
      setFeedbackTone('warning');
      setFeedback(error instanceof Error ? error.message : 'Nao foi possivel criar o modulo.');
    }
  };

  const handleDeleteModulo = async (id: string) => {
    if (!confirm('Deseja realmente excluir este modulo e todas as suas aulas? Esta acao e irreversivel.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/modulo/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Nao foi possivel excluir o modulo.');
      }

      setFeedbackTone('success');
      setFeedback('Modulo removido e historico atualizado em tempo real.');
      loadData();
    } catch (error) {
      setFeedbackTone('warning');
      setFeedback(error instanceof Error ? error.message : 'Nao foi possivel excluir o modulo.');
    }
  };

  return (
    <>
      <div className="page-header page-header-split">
        <div>
          <h1>Gestao de Conteudo</h1>
          <p>Gerencie modulos, aulas por arquivo ou YouTube e a estrutura do Seminario Teologico.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => setShowNewModule((current) => !current)} type="button">
            {showNewModule ? 'Cancelar' : 'Novo Modulo'}
          </button>
          <button className="btn btn-accent" onClick={() => navigate('/admin/aula/nova')} type="button">
            Nova Aula
          </button>
        </div>
      </div>

      {feedback && <div className={`inline-feedback ${feedbackTone}`}>{feedback}</div>}

      {showNewModule && (
        <form className="panel-card page-surface-narrow mb-3" onSubmit={handleCreateModulo}>
          <div className="page-header-split mb-2">
            <h3 className="section-title">Cadastrar Novo Modulo</h3>
            <button className="btn btn-outline btn-sm" onClick={clearModuleDraft} type="button">
              Limpar rascunho
            </button>
          </div>

          <div className="search-field mb-3">
            <input
              aria-label="Titulo do modulo"
              placeholder="Titulo do modulo"
              value={newModTitle}
              onChange={(event) => setNewModTitle(event.target.value)}
            />
          </div>

          <div className="search-field mb-3">
            <input
              aria-label="URL da imagem de capa"
              placeholder="URL da imagem de capa (Opcional)"
              value={newModCapa}
              onChange={(event) => setNewModCapa(event.target.value)}
            />
          </div>

          <textarea
            aria-label="Descricao do modulo"
            className="filter-select"
            placeholder="Descricao curta"
            style={{ width: '100%', minHeight: '96px', marginBottom: '1rem', padding: '0.85rem' }}
            value={newModDesc}
            onChange={(event) => setNewModDesc(event.target.value)}
          />

          <div className="surface-stack">
            <div className="inline-feedback neutral">
              {draftSavedAt
                ? `Rascunho salvo automaticamente em ${dateTimeFormatter.format(draftSavedAt)}.`
                : 'Este formulario salva o rascunho automaticamente enquanto voce digita.'}
            </div>
            <button className="btn btn-primary" type="submit">Salvar Modulo</button>
          </div>
        </form>
      )}

      <div className="panel-card page-surface-narrow mb-3">
        <div className="page-header-split mb-2">
          <div>
            <h3 className="section-title">Historico de Conteudo</h3>
            <p className="text-muted">Cada criacao, edicao ou exclusao de modulo e aula fica registrada no servidor.</p>
          </div>
        </div>

        {historyLoading ? (
          <div className="skeleton" style={{ height: 160 }} />
        ) : history.length ? (
          <div className="surface-stack">
            {history.map((item) => (
              <div className="surface-muted" key={item.id}>
                <strong style={{ display: 'block', marginBottom: '0.2rem' }}>{formatHistoryAction(item)}</strong>
                <p className="text-muted" style={{ marginBottom: '0.2rem' }}>
                  {item.entidadeTitulo}
                  {item.entidade === 'aula' && item.detalhes?.videoTipo ? ` · ${String(item.detalhes.videoTipo)}` : ''}
                </p>
                <span className="text-muted text-sm">{dateTimeFormatter.format(new Date(item.criadoEm))}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <AppIcon name="clock" size={18} />
            <p>Nenhuma alteracao de modulo ou aula foi registrada ainda.</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 300 }} />
      ) : modulos.length ? (
        modulos.map((modulo) => (
          <div className="module-section" key={modulo.id}>
            <div className="page-header-split" style={{ marginBottom: '0.5rem' }}>
              <h2>{modulo.titulo}</h2>
              <button
                className="btn btn-outline btn-sm"
                style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                type="button"
                onClick={() => handleDeleteModulo(modulo.id)}
              >
                Excluir Modulo
              </button>
            </div>
            <p className="module-desc">{modulo.descricao}</p>

            {/* Desktop table */}
            <div className="table-container admin-desktop-table" style={{ marginBottom: '1.5rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Aula</th>
                    <th>Status</th>
                    <th>Video</th>
                    <th>Alunos</th>
                    <th>% Medio</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {modulo.aulas.map((aula: any) => {
                    const totalAlunos = aula.progressos?.length || 0;
                    const mediaConclusao = totalAlunos > 0
                      ? Math.round(aula.progressos.reduce((sum: number, p: any) => sum + p.percentualAssistido, 0) / totalAlunos)
                      : 0;
                    const videoLabel = String(aula.urlVideo || '').includes('youtube.com') ? 'YouTube' : aula.urlVideo ? 'Arquivo' : 'Sem video';
                    const videoBadge = String(aula.urlVideo || '').includes('youtube.com') ? 'badge-info' : aula.urlVideo ? 'badge-success' : 'badge-warning';
                    return (
                      <tr key={aula.id}>
                        <td style={{ fontWeight: 500 }}>{aula.titulo}</td>
                        <td><span className={`badge ${aula.publicado ? 'badge-success' : 'badge-warning'}`}>{aula.publicado ? 'Publicado' : 'Rascunho'}</span></td>
                        <td><span className={`badge ${videoBadge}`}>{videoLabel}</span></td>
                        <td>{totalAlunos}</td>
                        <td>
                          <div className="chart-inline-progress">
                            <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${mediaConclusao}%` }} /></div>
                            <span className="text-sm">{mediaConclusao}%</span>
                          </div>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button aria-label={`Editar aula ${aula.titulo}`} className="btn btn-outline btn-sm" title="Editar Aula" onClick={() => navigate(`/admin/aula/${aula.id}/editar`)} type="button"><AppIcon name="settings" size={14} /></button>
                            <button aria-label={`Fazer chamada da aula ${aula.titulo}`} className="btn btn-outline btn-sm" title="Fazer Chamada" onClick={() => navigate(`/admin/chamada?aulaId=${aula.id}`)} type="button"><AppIcon name="shield" size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="admin-card-list" style={{ marginBottom: '1.5rem' }}>
              {modulo.aulas.map((aula: any) => {
                const totalAlunos = aula.progressos?.length || 0;
                const mediaConclusao = totalAlunos > 0
                  ? Math.round(aula.progressos.reduce((sum: number, p: any) => sum + p.percentualAssistido, 0) / totalAlunos)
                  : 0;
                const videoLabel = String(aula.urlVideo || '').includes('youtube.com') ? 'YouTube' : aula.urlVideo ? 'Arquivo' : 'Sem video';
                const videoBadge = String(aula.urlVideo || '').includes('youtube.com') ? 'badge-info' : aula.urlVideo ? 'badge-success' : 'badge-warning';
                return (
                  <div className="admin-list-card" key={aula.id}>
                    <strong style={{ fontSize: '0.95rem' }}>{aula.titulo}</strong>
                    <div className="admin-list-card-meta">
                      <span className={`badge ${aula.publicado ? 'badge-success' : 'badge-warning'}`}>{aula.publicado ? 'Publicado' : 'Rascunho'}</span>
                      <span className={`badge ${videoBadge}`}>{videoLabel}</span>
                      <span className="text-muted text-sm">{totalAlunos} aluno{totalAlunos !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="chart-inline-progress">
                      <div className="progress-bar" style={{ flex: 1 }}><div className="progress-bar-fill" style={{ width: `${mediaConclusao}%` }} /></div>
                      <span className="text-sm">{mediaConclusao}% medio</span>
                    </div>
                    <div className="admin-list-card-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/aula/${aula.id}/editar`)} type="button"><AppIcon name="settings" size={14} /><span>Editar</span></button>
                      <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/chamada?aulaId=${aula.id}`)} type="button"><AppIcon name="shield" size={14} /><span>Chamada</span></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      ) : (
        <div className="empty-panel">
          <AppIcon name="book" size={20} />
          <p>Nenhum modulo foi cadastrado ainda.</p>
        </div>
      )}
    </>
  );
}
