import { useEffect, useMemo, useState } from 'react';

import AppIcon from '../../components/AppIcon';
import { apiDelete, apiFetch, apiGet, apiPut } from '../../lib/apiClient';

interface EditState {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  permiteDownload: boolean;
  moduloId: string;
  aulaId: string;
}

interface MaterialItem {
  id: string;
  titulo: string;
  descricao?: string | null;
  categoria: string;
  tipo: string;
  permiteDownload: boolean;
  criadoEm: string;
  materiaisAula?: Array<{
    aula?: {
      id: string;
      titulo: string;
      modulo?: {
        id: string;
        titulo: string;
      } | null;
    } | null;
  }>;
}

type MaterialListResponse =
  | MaterialItem[]
  | {
      data?: MaterialItem[];
      total?: number;
      page?: number;
      pageSize?: number;
      totalPages?: number;
    };

export default function AdminMateriais() {
  const [materiais, setMateriais] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('geral');
  const [permiteDownload, setPermiteDownload] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [modulos, setModulos] = useState<any[]>([]);
  const [moduloSelecionado, setModuloSelecionado] = useState<string>('');
  const [aulaSelecionada, setAulaSelecionada] = useState<string>('');
  const [filtroModulo, setFiltroModulo] = useState<string>('todos');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadMateriais = () => {
    apiGet<MaterialListResponse>('/api/admin/materiais')
      .then((response) => {
        const lista = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];
        setMateriais(lista);
      })
      .catch(() => setFeedback('Não foi possível carregar os materiais agora.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMateriais();
    apiGet<unknown[]>('/api/admin/aulas')
      .then((data) => {
        if (Array.isArray(data)) {
          setModulos(data);
        }
      })
      .catch(() => setFeedback('Não foi possível carregar a relação de aulas.'));
  }, []);

  const allAulas = useMemo(
    () =>
      modulos.flatMap((modulo: any) =>
        modulo.aulas?.map((aula: any) => ({
          id: aula.id,
          titulo: aula.titulo,
          modulo: modulo.titulo,
          moduloId: modulo.id
        })) || []
      ),
    [modulos]
  );

  const aulasFiltradasCriacao = useMemo(
    () => (moduloSelecionado ? allAulas.filter((aula: any) => aula.moduloId === moduloSelecionado) : allAulas),
    [allAulas, moduloSelecionado]
  );

  const aulasFiltradasEdicao = useMemo(
    () => (editState?.moduloId ? allAulas.filter((aula: any) => aula.moduloId === editState.moduloId) : allAulas),
    [allAulas, editState?.moduloId]
  );

  const getModuleEntries = (material: MaterialItem) =>
    Array.from(
      new Map(
        (material.materiaisAula || [])
          .map((item) => item.aula?.modulo)
          .filter((modulo): modulo is { id: string; titulo: string } => Boolean(modulo))
          .map((modulo) => [modulo.id, modulo] as const)
      ).values()
    );

  const getModuleNames = (material: MaterialItem) => getModuleEntries(material).map((modulo) => modulo.titulo);

  const getLessonNames = (material: MaterialItem) =>
    (material.materiaisAula || [])
      .map((item) => item.aula?.titulo)
      .filter((value): value is string => Boolean(value));

  const materiaisFiltrados = useMemo(() => {
    if (filtroModulo === 'todos') {
      return materiais;
    }
    if (filtroModulo === 'sem-modulo') {
      return materiais.filter((material) => getModuleEntries(material).length === 0);
    }
    return materiais.filter((material) =>
      getModuleEntries(material).some((modulo) => modulo.id === filtroModulo)
    );
  }, [filtroModulo, materiais]);

  const handleUpload = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    if (!arquivo) return;
    setSubmitting(true);
    setFeedback('');

    const formData = new FormData();
    formData.append('titulo', titulo);
    formData.append('descricao', descricao);
    formData.append('categoria', categoria);
    formData.append('permiteDownload', String(permiteDownload));
    if (moduloSelecionado) {
      formData.append('moduloId', moduloSelecionado);
    }
    if (aulaSelecionada) {
      formData.append('aulasRelacionadas', JSON.stringify([aulaSelecionada]));
    }
    formData.append('arquivo', arquivo);

    try {
      const response = await apiFetch('/api/admin/material', { method: 'POST', body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: string }));
        setFeedback(body.error || 'Não foi possível enviar o material.');
        return;
      }

      setTitulo('');
      setDescricao('');
      setCategoria('geral');
      setModuloSelecionado('');
      setAulaSelecionada('');
      setArquivo(null);
      setShowForm(false);
      setFeedback('Material enviado com sucesso.');
      loadMateriais();
    } catch {
      setFeedback('Erro ao enviar o material.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este material? Esta ação não pode ser desfeita.')) return;
    setDeletingId(id);
    setFeedback('');
    try {
      await apiDelete(`/api/admin/material/${id}`);
      setMateriais((prev) => prev.filter((material) => material.id !== id));
      setFeedback('Material excluído com sucesso.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Erro ao excluir material.');
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (material: MaterialItem) => {
    setEditState({
      id: material.id,
      titulo: material.titulo,
      descricao: material.descricao || '',
      categoria: material.categoria || 'geral',
      permiteDownload: material.permiteDownload,
      moduloId: material.materiaisAula?.[0]?.aula?.modulo?.id || '',
      aulaId: material.materiaisAula?.[0]?.aula?.id || ''
    });
  };

  const handleSaveEdit = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    if (!editState) return;
    setSavingEdit(true);
    setFeedback('');

    try {
      await apiPut(`/api/admin/material/${editState.id}`, {
        titulo: editState.titulo,
        descricao: editState.descricao,
        categoria: editState.categoria,
        permiteDownload: editState.permiteDownload,
        moduloId: editState.moduloId || null,
        aulaId: editState.aulaId || null
      });

      setFeedback('Material atualizado com sucesso.');
      setEditState(null);
      loadMateriais();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Erro ao atualizar material.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <>
      <div className="page-header page-header-split">
        <div>
          <h1>Materiais de Apoio</h1>
          <p>{materiaisFiltrados.length} de {materiais.length} materiais exibidos</p>
        </div>
        <button className="btn btn-accent" onClick={() => setShowForm(!showForm)} type="button">
          {showForm ? 'Fechar' : 'Upload'}
        </button>
      </div>

      {feedback && <div className="inline-feedback warning">{feedback}</div>}

      <div className="content-panel-toolbar admin-toolbar-compact mb-3">
        <div className="page-header-actions" style={{ width: '100%', justifyContent: 'flex-start' }}>
          <select
            aria-label="Filtrar materiais por módulo"
            className="filter-select"
            value={filtroModulo}
            onChange={(event) => setFiltroModulo(event.target.value)}
          >
            <option value="todos">Todos os módulos</option>
            <option value="sem-modulo">Sem módulo</option>
            {modulos.map((modulo: any) => (
              <option key={modulo.id} value={modulo.id}>
                {modulo.titulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showForm && (
        <div className="card mb-3 page-surface-narrow">
          <h3 className="section-title">Upload de material</h3>
          <form onSubmit={handleUpload}>
            <div className="form-group">
              <label className="form-label" htmlFor="upload-titulo">Título</label>
              <input
                id="upload-titulo"
                className="form-input"
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="upload-descricao">Descrição</label>
              <textarea
                id="upload-descricao"
                className="form-textarea"
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                rows={3}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="upload-categoria">Categoria</label>
              <select
                id="upload-categoria"
                className="form-select"
                value={categoria}
                onChange={(event) => setCategoria(event.target.value)}
              >
                <option value="geral">Geral</option>
                <option value="biblico">Bíblico</option>
                <option value="teologico">Teológico</option>
                <option value="devocional">Devocional</option>
                <option value="historico">Histórico</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="upload-modulo">Módulo relacionado (opcional)</label>
              <select
                id="upload-modulo"
                className="form-select"
                value={moduloSelecionado}
                onChange={(event) => {
                  setModuloSelecionado(event.target.value);
                  setAulaSelecionada('');
                }}
              >
                <option value="">Nenhum módulo vinculado</option>
                {modulos.map((modulo: any) => (
                  <option key={modulo.id} value={modulo.id}>
                    {modulo.titulo}
                  </option>
                ))}
              </select>
              <p className="text-muted text-sm" style={{ marginTop: '0.4rem' }}>
                Se selecionar um módulo e não escolher aula específica, o material será vinculado às aulas já existentes desse módulo.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="upload-aula">Aula específica (opcional)</label>
              <select
                id="upload-aula"
                className="form-select"
                value={aulaSelecionada}
                onChange={(event) => setAulaSelecionada(event.target.value)}
              >
                <option value="">Sem aula específica</option>
                {aulasFiltradasCriacao.map((aula: any) => (
                  <option key={aula.id} value={aula.id}>
                    {aula.modulo} - {aula.titulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="upload-arquivo">Arquivo</label>
              <input
                id="upload-arquivo"
                type="file"
                accept=".pdf,.epub,.docx"
                onChange={(event) => setArquivo(event.target.files?.[0] || null)}
                className="form-input file-input"
              />
            </div>
            <div className="form-group">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={permiteDownload}
                  onChange={(event) => setPermiteDownload(event.target.checked)}
                />
                <span>Permitir download pelos alunos</span>
              </label>
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting || !arquivo}>
              {submitting ? 'Enviando...' : 'Fazer upload'}
            </button>
          </form>
        </div>
      )}

      {editState && (
        <div className="card mb-3 page-surface-narrow" style={{ borderLeft: '3px solid var(--color-accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Editar material</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditState(null)} type="button">
              Cancelar
            </button>
          </div>
          <form onSubmit={handleSaveEdit}>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-titulo">Título</label>
              <input
                id="edit-titulo"
                className="form-input"
                value={editState.titulo}
                onChange={(event) => setEditState((state) => state && ({ ...state, titulo: event.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-descricao">Descrição</label>
              <textarea
                id="edit-descricao"
                className="form-textarea"
                value={editState.descricao}
                onChange={(event) => setEditState((state) => state && ({ ...state, descricao: event.target.value }))}
                rows={3}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-categoria">Categoria</label>
              <select
                id="edit-categoria"
                className="form-select"
                value={editState.categoria}
                onChange={(event) => setEditState((state) => state && ({ ...state, categoria: event.target.value }))}
              >
                <option value="geral">Geral</option>
                <option value="biblico">Bíblico</option>
                <option value="teologico">Teológico</option>
                <option value="devocional">Devocional</option>
                <option value="historico">Histórico</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-modulo">Módulo relacionado</label>
              <select
                id="edit-modulo"
                className="form-select"
                value={editState.moduloId}
                onChange={(event) =>
                  setEditState((state) => state && ({ ...state, moduloId: event.target.value, aulaId: '' }))
                }
              >
                <option value="">Nenhum módulo vinculado</option>
                {modulos.map((modulo: any) => (
                  <option key={modulo.id} value={modulo.id}>
                    {modulo.titulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-aula">Aula relacionada</label>
              <select
                id="edit-aula"
                className="form-select"
                value={editState.aulaId}
                onChange={(event) => setEditState((state) => state && ({ ...state, aulaId: event.target.value }))}
              >
                <option value="">Sem aula específica</option>
                {aulasFiltradasEdicao.map((aula: any) => (
                  <option key={aula.id} value={aula.id}>
                    {aula.modulo} - {aula.titulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={editState.permiteDownload}
                  onChange={(event) =>
                    setEditState((state) => state && ({ ...state, permiteDownload: event.target.checked }))
                  }
                />
                <span>Permitir download pelos alunos</span>
              </label>
            </div>
            <button className="btn btn-primary" type="submit" disabled={savingEdit}>
              {savingEdit ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card-grid">
          {[1, 2, 3].map((item) => (
            <div key={item} className="skeleton skeleton-card" />
          ))}
        </div>
      ) : (
        <>
          <div className="table-container admin-desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Download</th>
                  <th>Aulas</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {materiaisFiltrados.length ? (
                  materiaisFiltrados.map((material) => (
                    <tr key={material.id}>
                      <td>
                        <div className="table-entity">
                          <AppIcon name="file" size={16} />
                          <div className="table-entity-copy">
                            <div style={{ fontWeight: 500 }}>{material.titulo}</div>
                            {material.descricao && <div className="text-muted text-sm table-device-text">{material.descricao}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-purple">{material.categoria}</span>
                      </td>
                      <td className="text-muted">{material.tipo?.toUpperCase()}</td>
                      <td>
                        {material.permiteDownload ? (
                          <span className="badge badge-success">Sim</span>
                        ) : (
                          <span className="badge badge-error">Não</span>
                        )}
                      </td>
                      <td className="text-muted">
                        {(() => {
                          const modules = getModuleNames(material);
                          const lessons = getLessonNames(material);
                          if (!modules.length && !lessons.length) return '-';
                          return [
                            modules.length ? `Módulo: ${modules.join(', ')}` : null,
                            lessons.length ? `Aulas: ${lessons.join(', ')}` : null
                          ]
                            .filter(Boolean)
                            .join(' | ');
                        })()}
                      </td>
                      <td className="text-muted">{new Date(material.criadoEm).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(material)} type="button">
                            Editar
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--color-error, #ef4444)' }}
                            onClick={() => handleDelete(material.id)}
                            disabled={deletingId === material.id}
                            type="button"
                          >
                            {deletingId === material.id ? '...' : 'Excluir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="text-muted" colSpan={7}>
                      Nenhum material cadastrado para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="admin-card-list">
            {materiaisFiltrados.length ? (
              materiaisFiltrados.map((material) => (
                <div className="admin-list-card" key={material.id}>
                  <div className="admin-list-card-header">
                    <AppIcon name="file" size={20} />
                    <div className="admin-list-card-info">
                      <strong>{material.titulo}</strong>
                      {material.descricao && <span className="text-muted text-sm">{material.descricao}</span>}
                      <span className="text-muted text-sm">{new Date(material.criadoEm).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <div className="admin-list-card-meta">
                    <span className="badge badge-purple">{material.categoria}</span>
                    <span className="text-muted text-sm">{material.tipo?.toUpperCase()}</span>
                    {material.permiteDownload ? (
                      <span className="badge badge-success">Download: Sim</span>
                    ) : (
                      <span className="badge badge-error">Download: Não</span>
                    )}
                  </div>
                  {(material.materiaisAula?.length || 0) > 0 && (
                    <span className="text-muted text-sm">
                      {(() => {
                        const modules = getModuleNames(material);
                        const lessons = getLessonNames(material);
                        return [
                          modules.length ? `Módulo: ${modules.join(', ')}` : null,
                          lessons.length ? `Aulas: ${lessons.join(', ')}` : null
                        ]
                          .filter(Boolean)
                          .join(' | ');
                      })()}
                    </span>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(material)} type="button">
                      Editar
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-error, #ef4444)' }}
                      onClick={() => handleDelete(material.id)}
                      disabled={deletingId === material.id}
                      type="button"
                    >
                      {deletingId === material.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted">Nenhum material cadastrado para este filtro.</p>
            )}
          </div>
        </>
      )}
    </>
  );
}
