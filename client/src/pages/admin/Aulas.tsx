import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AppIcon from '../../components/AppIcon';
import AvatarCropModal from '../../components/AvatarCropModal';
import { apiGet, apiPost, apiDelete, apiFetch } from '../../lib/apiClient';
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
  const entityLabel = item.entidade === 'modulo' ? 'o módulo' : 'a aula';
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
  const [showNewModule, setShowNewModule] = useState(false);
  const [newModTitle, setNewModTitle] = useState('');
  const [newModDesc, setNewModDesc] = useState('');
  const [newModCapaFile, setNewModCapaFile] = useState<File | null>(null);
  const [cropCapaFile, setCropCapaFile] = useState<File | null>(null);
  const [cropCapaTarget, setCropCapaTarget] = useState<'new' | string>('new'); // 'new' or moduloId
  const [uploadingCapaId, setUploadingCapaId] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const newModCapaRef = useRef<HTMLInputElement>(null);
  const editCapaRef = useRef<HTMLInputElement>(null);
  const editingCapaIdRef = useRef<string | null>(null);

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
      apiGet<any[]>('/api/admin/aulas'),
      apiGet<any[]>('/api/admin/conteudo-historico?limit=12'),
    ])
      .then(([modulosData, historyData]) => {
        setModulos(Array.isArray(modulosData) ? modulosData : []);
        setHistory(Array.isArray(historyData) ? historyData : []);
      })
      .catch(() => {
        setFeedbackTone('warning');
        setFeedback('Não foi possível carregar os módulos e o histórico agora.');
      })
      .finally(() => {
        setLoading(false);
        setHistoryLoading(false);
      });
  };

  useEffect(() => {
    const draft = readDraft<ModuleDraft>(MODULE_DRAFT_KEY);
    if (draft) {
      setShowNewModule(draft.open || Boolean(draft.title || draft.description));
      setNewModTitle(draft.title || '');
      setNewModDesc(draft.description || '');
      setDraftSavedAt(draft.savedAt || null);
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const hasDraft = Boolean(showNewModule || newModTitle.trim() || newModDesc.trim());
    if (!hasDraft) {
      clearDraft(MODULE_DRAFT_KEY);
      setDraftSavedAt(null);
      return;
    }
    const nextSavedAt = Date.now();
    writeDraft<ModuleDraft>(MODULE_DRAFT_KEY, {
      title: newModTitle,
      description: newModDesc,
      coverUrl: '',
      open: showNewModule,
      savedAt: nextSavedAt,
    });
    setDraftSavedAt(nextSavedAt);
  }, [draftReady, newModDesc, newModTitle, showNewModule]);

  const clearModuleDraft = () => {
    clearDraft(MODULE_DRAFT_KEY);
    setNewModTitle('');
    setNewModDesc('');
    setNewModCapaFile(null);
    if (newModCapaRef.current) newModCapaRef.current.value = '';
    setShowNewModule(false);
    setDraftSavedAt(null);
  };

  const handleCreateModulo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newModTitle.trim()) return;
    try {
      const created = await apiPost<{ id: string }>('/api/admin/modulo', {
        titulo: newModTitle.trim(),
        descricao: newModDesc.trim()
      });
      if (newModCapaFile && created.id) {
        const fd = new FormData();
        fd.append('capa', newModCapaFile);
        await apiFetch(`/api/admin/modulo/${created.id}/capa`, { method: 'PUT', body: fd });
      }
      clearModuleDraft();
      setFeedbackTone('success');
      setFeedback('Módulo criado com sucesso.');
      loadData();
    } catch (error) {
      setFeedbackTone('warning');
      setFeedback(error instanceof Error ? error.message : 'Não foi possível criar o módulo.');
    }
  };

  const handleCropCapaConfirm = async (blob: Blob) => {
    const target = cropCapaTarget;
    setCropCapaFile(null);
    if (target === 'new') {
      setNewModCapaFile(new File([blob], 'capa.jpg', { type: 'image/jpeg' }));
      return;
    }
    setUploadingCapaId(target);
    try {
      const fd = new FormData();
      fd.append('capa', blob, 'capa.jpg');
      const response = await apiFetch(`/api/admin/modulo/${target}/capa`, { method: 'PUT', body: fd });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erro ao salvar capa.');
      setModulos((prev) => prev.map((m) => m.id === target ? { ...m, capaUrl: data.capaUrl } : m));
      setFeedbackTone('success');
      setFeedback('Capa do módulo atualizada.');
    } catch (error) {
      setFeedbackTone('warning');
      setFeedback(error instanceof Error ? error.message : 'Erro ao salvar capa.');
    } finally {
      setUploadingCapaId(null);
      editingCapaIdRef.current = null;
    }
  };

  const handleEditCapa = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const moduloId = editingCapaIdRef.current;
    if (!file || !moduloId) return;
    if (editCapaRef.current) editCapaRef.current.value = '';
    setCropCapaTarget(moduloId);
    setCropCapaFile(file);
  };

  const handleNewCapaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (newModCapaRef.current) newModCapaRef.current.value = '';
    setCropCapaTarget('new');
    setCropCapaFile(file);
  };

  const handleDeleteModulo = async (id: string) => {
    if (!confirm('Deseja realmente excluir este módulo e todas as suas aulas? Esta ação é irreversível.')) {
      return;
    }

    try {
      await apiDelete(`/api/admin/modulo/${id}`);

      setFeedbackTone('success');
      setFeedback('Módulo removido e histórico atualizado em tempo real.');
      loadData();
    } catch (error) {
      setFeedbackTone('warning');
      setFeedback(error instanceof Error ? error.message : 'Não foi possível excluir o módulo.');
    }
  };

  return (
    <>
      {cropCapaFile && (
        <AvatarCropModal
          file={cropCapaFile}
          shape="rect"
          aspectRatio={16 / 9}
          outputSize={960}
          onConfirm={handleCropCapaConfirm}
          onCancel={() => { setCropCapaFile(null); editingCapaIdRef.current = null; }}
        />
      )}

      <div className="page-header page-header-split">
        <div>
          <h1>Gestão de Conteúdo</h1>
          <p>Gerencie módulos, aulas por arquivo ou YouTube e a estrutura do Seminário Teológico.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => setShowNewModule((current) => !current)} type="button">
            {showNewModule ? 'Cancelar' : 'Novo Módulo'}
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
            <h3 className="section-title">Cadastrar Novo Módulo</h3>
            <button className="btn btn-outline btn-sm" onClick={clearModuleDraft} type="button">
              Limpar rascunho
            </button>
          </div>

          <div className="search-field mb-3">
            <input
              aria-label="Título do módulo"
              placeholder="Título do módulo"
              value={newModTitle}
              onChange={(event) => setNewModTitle(event.target.value)}
            />
          </div>

          <div className="form-group mb-3">
            <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>Imagem de capa (opcional)</label>
            <input
              accept="image/*"
              ref={newModCapaRef}
              style={{ display: 'block' }}
              type="file"
              onChange={handleNewCapaSelect}
            />
            {newModCapaFile && <p style={{ fontSize: '0.75rem', marginTop: '0.3rem', opacity: 0.7 }}>{newModCapaFile.name}</p>}
          </div>

          <textarea
            aria-label="Descrição do módulo"
            className="filter-select"
            placeholder="Descrição curta"
            style={{ width: '100%', minHeight: '96px', marginBottom: '1rem', padding: '0.85rem' }}
            value={newModDesc}
            onChange={(event) => setNewModDesc(event.target.value)}
          />

          <div className="surface-stack">
            <div className="inline-feedback neutral">
              {draftSavedAt
                ? `Rascunho salvo automaticamente em ${dateTimeFormatter.format(draftSavedAt)}.`
                : 'Este formulário salva o rascunho automaticamente enquanto você digita.'}
            </div>
            <button className="btn btn-primary" type="submit">Salvar Módulo</button>
          </div>
        </form>
      )}

      <div className="panel-card page-surface-narrow mb-3">
        <div className="page-header-split mb-2">
          <div>
            <h3 className="section-title">Histórico de Conteúdo</h3>
            <p className="text-muted">Cada criação, edição ou exclusão de módulo e aula fica registrada no servidor.</p>
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
            <p>Nenhuma alteração de módulo ou aula foi registrada ainda.</p>
          </div>
        )}
      </div>

      {/* Hidden shared file input for editing existing module covers */}
      <input accept="image/*" ref={editCapaRef} style={{ display: 'none' }} type="file" onChange={handleEditCapa} />

      {loading ? (
        <div className="skeleton" style={{ height: 300 }} />
      ) : modulos.length ? (
        modulos.map((modulo) => (
          <div className="module-section" key={modulo.id}>
            <div className="page-header-split" style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {modulo.capaUrl && (
                  <img
                    alt=""
                    src={modulo.capaUrl}
                    style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0 }}
                  />
                )}
                <h2>{modulo.titulo}</h2>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-outline btn-sm"
                  disabled={uploadingCapaId === modulo.id}
                  type="button"
                  onClick={() => {
                    editingCapaIdRef.current = modulo.id;
                    editCapaRef.current?.click();
                  }}
                >
                  {uploadingCapaId === modulo.id ? 'Enviando...' : modulo.capaUrl ? 'Trocar Capa' : 'Adicionar Capa'}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                  type="button"
                  onClick={() => handleDeleteModulo(modulo.id)}
                >
                  Excluir Módulo
                </button>
              </div>
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
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {modulo.aulas.map((aula: any) => {
                    const totalAlunos = aula.progressos?.length || 0;
                    const mediaConclusao = totalAlunos > 0
                      ? Math.round(aula.progressos.reduce((sum: number, p: any) => sum + p.percentualAssistido, 0) / totalAlunos)
                      : 0;
                    const videoLabel = String(aula.urlVideo || '').includes('youtube.com') ? 'YouTube' : aula.urlVideo ? 'Arquivo' : 'Sem vídeo';
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
                const videoLabel = String(aula.urlVideo || '').includes('youtube.com') ? 'YouTube' : aula.urlVideo ? 'Arquivo' : 'Sem vídeo';
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
                      <span className="text-sm">{mediaConclusao}% médio</span>
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
          <p>Nenhum módulo foi cadastrado ainda.</p>
        </div>
      )}
    </>
  );
}
