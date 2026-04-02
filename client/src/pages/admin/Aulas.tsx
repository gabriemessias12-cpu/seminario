import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AppIcon from '../../components/AppIcon';
import AvatarCropModal from '../../components/AvatarCropModal';
import { apiDelete, apiFetch, apiGet, apiPost, apiPut } from '../../lib/apiClient';
import { clearDraft, readDraft, writeDraft } from '../../lib/draft-storage';

type FeedbackTone = 'success' | 'warning';

interface ModuleDraft {
  title: string;
  description: string;
  order: string;
  coverUrl: string;
  obrigatorio: boolean;
  open: boolean;
  savedAt: number;
}

interface ModuleEditState {
  titulo: string;
  descricao: string;
  ordem: string;
  obrigatorio: boolean;
}

interface AulaItem {
  id: string;
  titulo: string;
  publicado: boolean;
  urlVideo: string | null;
  progressos?: Array<{ percentualAssistido: number }>;
}

interface ModuloItem {
  id: string;
  titulo: string;
  descricao: string | null;
  capaUrl: string | null;
  ordem: number;
  obrigatorio: boolean;
  aulas: AulaItem[];
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

function buildModuleEditState(modulo: ModuloItem): ModuleEditState {
  return {
    titulo: modulo.titulo,
    descricao: modulo.descricao || '',
    ordem: String(modulo.ordem ?? 0),
    obrigatorio: modulo.obrigatorio,
  };
}

function formatHistoryAction(item: ContentHistoryItem): string {
  const actionLabel =
    item.acao === 'criado' ? 'criou' : item.acao === 'atualizado' ? 'atualizou' : 'removeu';
  const entityLabel = item.entidade === 'modulo' ? 'o módulo' : 'a aula';
  return `${item.usuarioNome} ${actionLabel} ${entityLabel}`;
}

export default function AdminAulas() {
  const navigate = useNavigate();
  const [modulos, setModulos] = useState<ModuloItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('warning');
  const [history, setHistory] = useState<ContentHistoryItem[]>([]);
  const [showNewModule, setShowNewModule] = useState(false);
  const [newModTitle, setNewModTitle] = useState('');
  const [newModDesc, setNewModDesc] = useState('');
  const [newModOrder, setNewModOrder] = useState('0');
  const [newModObrigatorio, setNewModObrigatorio] = useState(true);
  const [newModCapaFile, setNewModCapaFile] = useState<File | null>(null);
  const [cropCapaFile, setCropCapaFile] = useState<File | null>(null);
  const [cropCapaTarget, setCropCapaTarget] = useState<'new' | string>('new');
  const [uploadingCapaId, setUploadingCapaId] = useState<string | null>(null);
  const [editingModuloId, setEditingModuloId] = useState<string | null>(null);
  const [moduleEditState, setModuleEditState] = useState<ModuleEditState | null>(null);
  const [savingModuloId, setSavingModuloId] = useState<string | null>(null);
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
      apiGet<ModuloItem[]>('/api/admin/aulas'),
      apiGet<ContentHistoryItem[]>('/api/admin/conteudo-historico?limit=12'),
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

  const refreshHistory = () => {
    apiGet<ContentHistoryItem[]>('/api/admin/conteudo-historico?limit=12')
      .then((historyData) => {
        setHistory(Array.isArray(historyData) ? historyData : []);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    const draft = readDraft<ModuleDraft>(MODULE_DRAFT_KEY);
    if (draft) {
      setShowNewModule(draft.open || Boolean(draft.title || draft.description));
      setNewModTitle(draft.title || '');
      setNewModDesc(draft.description || '');
      setNewModOrder(draft.order || '0');
      setNewModObrigatorio(typeof draft.obrigatorio === 'boolean' ? draft.obrigatorio : true);
      setDraftSavedAt(draft.savedAt || null);
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const hasDraft = Boolean(
      showNewModule
      || newModTitle.trim()
      || newModDesc.trim()
      || newModOrder.trim() !== '0'
    );
    if (!hasDraft) {
      clearDraft(MODULE_DRAFT_KEY);
      setDraftSavedAt(null);
      return;
    }

    const nextSavedAt = Date.now();
    writeDraft<ModuleDraft>(MODULE_DRAFT_KEY, {
      title: newModTitle,
      description: newModDesc,
      order: newModOrder,
      coverUrl: '',
      obrigatorio: newModObrigatorio,
      open: showNewModule,
      savedAt: nextSavedAt,
    });
    setDraftSavedAt(nextSavedAt);
  }, [draftReady, newModDesc, newModObrigatorio, newModOrder, newModTitle, showNewModule]);

  const clearModuleDraft = () => {
    clearDraft(MODULE_DRAFT_KEY);
    setNewModTitle('');
    setNewModDesc('');
    setNewModOrder('0');
    setNewModObrigatorio(true);
    setNewModCapaFile(null);
    if (newModCapaRef.current) newModCapaRef.current.value = '';
    setShowNewModule(false);
    setDraftSavedAt(null);
  };

  const closeModuleEditor = () => {
    setEditingModuloId(null);
    setModuleEditState(null);
  };

  const openModuleEditor = (modulo: ModuloItem) => {
    if (editingModuloId === modulo.id) {
      closeModuleEditor();
      return;
    }

    setEditingModuloId(modulo.id);
    setModuleEditState(buildModuleEditState(modulo));
  };

  const updateModuleEditState = <K extends keyof ModuleEditState>(field: K, value: ModuleEditState[K]) => {
    setModuleEditState((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleCreateModulo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newModTitle.trim()) return;

    try {
      const created = await apiPost<{ id: string }>('/api/admin/modulo', {
        titulo: newModTitle.trim(),
        descricao: newModDesc.trim(),
        ordem: newModOrder.trim() || '0',
        obrigatorio: newModObrigatorio,
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

  const handleSaveModulo = async (event: React.FormEvent, moduloId: string) => {
    event.preventDefault();
    if (!moduleEditState || editingModuloId !== moduloId) return;
    if (!moduleEditState.titulo.trim()) {
      setFeedbackTone('warning');
      setFeedback('Informe o nome do módulo antes de salvar.');
      return;
    }

    setSavingModuloId(moduloId);
    try {
      await apiPut(`/api/admin/modulo/${moduloId}`, {
        titulo: moduleEditState.titulo.trim(),
        descricao: moduleEditState.descricao.trim(),
        ordem: moduleEditState.ordem.trim() || '0',
        obrigatorio: moduleEditState.obrigatorio,
      });

      setFeedbackTone('success');
      setFeedback('Módulo atualizado com sucesso.');
      closeModuleEditor();
      loadData();
    } catch (error) {
      setFeedbackTone('warning');
      setFeedback(error instanceof Error ? error.message : 'Não foi possível atualizar o módulo.');
    } finally {
      setSavingModuloId(null);
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

      setModulos((prev) => prev.map((modulo) => (
        modulo.id === target ? { ...modulo, capaUrl: data.capaUrl } : modulo
      )));
      setFeedbackTone('success');
      setFeedback('Capa do módulo atualizada.');
      refreshHistory();
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

  const handleRemoveCapa = async (modulo: ModuloItem) => {
    if (!modulo.capaUrl) return;
    if (!confirm(`Deseja remover a capa do módulo "${modulo.titulo}"?`)) {
      return;
    }

    const editBase = editingModuloId === modulo.id && moduleEditState
      ? moduleEditState
      : buildModuleEditState(modulo);

    setUploadingCapaId(modulo.id);
    try {
      await apiPut(`/api/admin/modulo/${modulo.id}`, {
        titulo: editBase.titulo.trim(),
        descricao: editBase.descricao.trim(),
        ordem: editBase.ordem.trim() || '0',
        obrigatorio: editBase.obrigatorio,
        capaUrl: null,
      });

      setFeedbackTone('success');
      setFeedback('Capa do módulo removida.');
      loadData();
    } catch (error) {
      setFeedbackTone('warning');
      setFeedback(error instanceof Error ? error.message : 'Não foi possível remover a capa.');
    } finally {
      setUploadingCapaId(null);
    }
  };

  const handleDeleteModulo = async (id: string) => {
    if (!confirm('Deseja realmente excluir este módulo e todas as suas aulas? Esta ação é irreversível.')) {
      return;
    }

    try {
      await apiDelete(`/api/admin/modulo/${id}`);
      if (editingModuloId === id) {
        closeModuleEditor();
      }

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
          onCancel={() => {
            setCropCapaFile(null);
            editingCapaIdRef.current = null;
          }}
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

          <div className="form-row form-row-compact mb-3">
            <div className="form-group">
              <label className="form-label" htmlFor="novo-modulo-titulo">Título do módulo</label>
              <input
                id="novo-modulo-titulo"
                className="form-select"
                placeholder="Nome do módulo"
                value={newModTitle}
                onChange={(event) => setNewModTitle(event.target.value)}
              />
            </div>

            <div className="form-group" style={{ maxWidth: '180px' }}>
              <label className="form-label" htmlFor="novo-modulo-ordem">Ordem</label>
              <input
                id="novo-modulo-ordem"
                className="form-select"
                inputMode="numeric"
                min="0"
                type="number"
                value={newModOrder}
                onChange={(event) => setNewModOrder(event.target.value)}
              />
            </div>
          </div>

          <div className="form-group mb-3">
            <label className="form-label" htmlFor="novo-modulo-capa">Imagem de capa (opcional)</label>
            <input
              id="novo-modulo-capa"
              accept="image/*"
              className="file-input"
              ref={newModCapaRef}
              type="file"
              onChange={handleNewCapaSelect}
            />
            {newModCapaFile && (
              <p className="form-helper-text">{newModCapaFile.name}</p>
            )}
          </div>

          <div className="form-group mb-3">
            <label className="form-label" htmlFor="novo-modulo-descricao">Descrição</label>
            <textarea
              id="novo-modulo-descricao"
              aria-label="Descrição do módulo"
              className="form-select"
              placeholder="Descrição curta"
              style={{ width: '100%', minHeight: '96px', padding: '0.85rem' }}
              value={newModDesc}
              onChange={(event) => setNewModDesc(event.target.value)}
            />
          </div>

          <label className="checkbox-row mb-3">
            <input
              checked={newModObrigatorio}
              onChange={(event) => setNewModObrigatorio(event.target.checked)}
              type="checkbox"
            />
            <span>Módulo obrigatório para o progresso principal do aluno</span>
          </label>

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

      <input accept="image/*" ref={editCapaRef} style={{ display: 'none' }} type="file" onChange={handleEditCapa} />

      {loading ? (
        <div className="skeleton" style={{ height: 300 }} />
      ) : modulos.length ? (
        modulos.map((modulo) => (
          <div className="module-section" key={modulo.id}>
            <div className="page-header-split" style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                {modulo.capaUrl && (
                  <img
                    alt=""
                    src={modulo.capaUrl}
                    style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0 }}
                  />
                )}

                <div style={{ minWidth: 0 }}>
                  <h2>{modulo.titulo}</h2>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                    <span className={`badge ${modulo.obrigatorio ? 'badge-success' : 'badge-info'}`}>
                      {modulo.obrigatorio ? 'Obrigatório' : 'Opcional'}
                    </span>
                    <span className="badge badge-purple">Ordem {modulo.ordem}</span>
                    <span className="badge badge-warning">{modulo.aulas.length} aula{modulo.aulas.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-outline btn-sm"
                  type="button"
                  onClick={() => openModuleEditor(modulo)}
                >
                  {editingModuloId === modulo.id ? 'Fechar edição' : 'Editar módulo'}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  disabled={uploadingCapaId === modulo.id}
                  type="button"
                  onClick={() => {
                    editingCapaIdRef.current = modulo.id;
                    editCapaRef.current?.click();
                  }}
                >
                  {uploadingCapaId === modulo.id ? 'Enviando...' : modulo.capaUrl ? 'Trocar capa' : 'Adicionar capa'}
                </button>
                {modulo.capaUrl && (
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={uploadingCapaId === modulo.id}
                    type="button"
                    onClick={() => handleRemoveCapa(modulo)}
                  >
                    {uploadingCapaId === modulo.id ? 'Salvando...' : 'Remover capa'}
                  </button>
                )}
                <button
                  className="btn btn-outline btn-sm"
                  style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                  type="button"
                  onClick={() => handleDeleteModulo(modulo.id)}
                >
                  Excluir módulo
                </button>
              </div>
            </div>

            {editingModuloId === modulo.id && moduleEditState && (
              <form className="panel-card page-surface-narrow mb-3" onSubmit={(event) => handleSaveModulo(event, modulo.id)}>
                <div className="page-header-split mb-2">
                  <div>
                    <h3 className="section-title">Editar Módulo</h3>
                    <p className="text-muted">Atualize nome, ordem, descrição, tipo e capa sempre que houver ajuste do pastor.</p>
                  </div>
                </div>

                <div className="form-row form-row-compact mb-3">
                  <div className="form-group">
                    <label className="form-label" htmlFor={`editar-modulo-titulo-${modulo.id}`}>Título do módulo</label>
                    <input
                      id={`editar-modulo-titulo-${modulo.id}`}
                      className="form-select"
                      value={moduleEditState.titulo}
                      onChange={(event) => updateModuleEditState('titulo', event.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ maxWidth: '180px' }}>
                    <label className="form-label" htmlFor={`editar-modulo-ordem-${modulo.id}`}>Ordem</label>
                    <input
                      id={`editar-modulo-ordem-${modulo.id}`}
                      className="form-select"
                      inputMode="numeric"
                      min="0"
                      type="number"
                      value={moduleEditState.ordem}
                      onChange={(event) => updateModuleEditState('ordem', event.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label" htmlFor={`editar-modulo-descricao-${modulo.id}`}>Descrição</label>
                  <textarea
                    id={`editar-modulo-descricao-${modulo.id}`}
                    className="form-select"
                    style={{ width: '100%', minHeight: '96px', padding: '0.85rem' }}
                    value={moduleEditState.descricao}
                    onChange={(event) => updateModuleEditState('descricao', event.target.value)}
                  />
                </div>

                <label className="checkbox-row mb-3">
                  <input
                    checked={moduleEditState.obrigatorio}
                    onChange={(event) => updateModuleEditState('obrigatorio', event.target.checked)}
                    type="checkbox"
                  />
                  <span>Manter módulo obrigatório no progresso principal</span>
                </label>

                {modulo.capaUrl && (
                  <div className="inline-feedback neutral mb-3">
                    A capa atual já está vinculada a este módulo. Você pode trocar ou remover usando os botões acima.
                  </div>
                )}

                <div className="page-header-actions">
                  <button className="btn btn-primary btn-sm" disabled={savingModuloId === modulo.id} type="submit">
                    {savingModuloId === modulo.id ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={closeModuleEditor} type="button">
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <p className="module-desc">{modulo.descricao || 'Sem descrição cadastrada para este módulo.'}</p>

            <div className="table-container admin-desktop-table" style={{ marginBottom: '1.5rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Aula</th>
                    <th>Status</th>
                    <th>Vídeo</th>
                    <th>Alunos</th>
                    <th>% Médio</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {modulo.aulas.map((aula) => {
                    const totalAlunos = aula.progressos?.length || 0;
                    const mediaConclusao = totalAlunos > 0
                      ? Math.round(
                        aula.progressos!.reduce((sum, progresso) => sum + progresso.percentualAssistido, 0) / totalAlunos,
                      )
                      : 0;
                    const videoLabel = String(aula.urlVideo || '').includes('youtube.com')
                      ? 'YouTube'
                      : aula.urlVideo
                        ? 'Arquivo'
                        : 'Sem vídeo';
                    const videoBadge = String(aula.urlVideo || '').includes('youtube.com')
                      ? 'badge-info'
                      : aula.urlVideo
                        ? 'badge-success'
                        : 'badge-warning';

                    return (
                      <tr key={aula.id}>
                        <td style={{ fontWeight: 500 }}>{aula.titulo}</td>
                        <td>
                          <span className={`badge ${aula.publicado ? 'badge-success' : 'badge-warning'}`}>
                            {aula.publicado ? 'Publicado' : 'Rascunho'}
                          </span>
                        </td>
                        <td><span className={`badge ${videoBadge}`}>{videoLabel}</span></td>
                        <td>{totalAlunos}</td>
                        <td>
                          <div className="chart-inline-progress">
                            <div className="progress-bar">
                              <div className="progress-bar-fill" style={{ width: `${mediaConclusao}%` }} />
                            </div>
                            <span className="text-sm">{mediaConclusao}%</span>
                          </div>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              aria-label={`Editar aula ${aula.titulo}`}
                              className="btn btn-outline btn-sm"
                              title="Editar Aula"
                              onClick={() => navigate(`/admin/aula/${aula.id}/editar`)}
                              type="button"
                            >
                              <AppIcon name="settings" size={14} />
                            </button>
                            <button
                              aria-label={`Fazer chamada da aula ${aula.titulo}`}
                              className="btn btn-outline btn-sm"
                              title="Fazer Chamada"
                              onClick={() => navigate(`/admin/chamada?aulaId=${aula.id}`)}
                              type="button"
                            >
                              <AppIcon name="shield" size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="admin-card-list" style={{ marginBottom: '1.5rem' }}>
              {modulo.aulas.map((aula) => {
                const totalAlunos = aula.progressos?.length || 0;
                const mediaConclusao = totalAlunos > 0
                  ? Math.round(
                    aula.progressos!.reduce((sum, progresso) => sum + progresso.percentualAssistido, 0) / totalAlunos,
                  )
                  : 0;
                const videoLabel = String(aula.urlVideo || '').includes('youtube.com')
                  ? 'YouTube'
                  : aula.urlVideo
                    ? 'Arquivo'
                    : 'Sem vídeo';
                const videoBadge = String(aula.urlVideo || '').includes('youtube.com')
                  ? 'badge-info'
                  : aula.urlVideo
                    ? 'badge-success'
                    : 'badge-warning';

                return (
                  <div className="admin-list-card" key={aula.id}>
                    <strong style={{ fontSize: '0.95rem' }}>{aula.titulo}</strong>
                    <div className="admin-list-card-meta">
                      <span className={`badge ${aula.publicado ? 'badge-success' : 'badge-warning'}`}>
                        {aula.publicado ? 'Publicado' : 'Rascunho'}
                      </span>
                      <span className={`badge ${videoBadge}`}>{videoLabel}</span>
                      <span className="text-muted text-sm">{totalAlunos} aluno{totalAlunos !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="chart-inline-progress">
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div className="progress-bar-fill" style={{ width: `${mediaConclusao}%` }} />
                      </div>
                      <span className="text-sm">{mediaConclusao}% médio</span>
                    </div>
                    <div className="admin-list-card-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => navigate(`/admin/aula/${aula.id}/editar`)}
                        type="button"
                      >
                        <AppIcon name="settings" size={14} />
                        <span>Editar</span>
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => navigate(`/admin/chamada?aulaId=${aula.id}`)}
                        type="button"
                      >
                        <AppIcon name="shield" size={14} />
                        <span>Chamada</span>
                      </button>
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
