import { useEffect, useState } from 'react';

import AppIcon from '../../components/AppIcon';
import { apiGet, apiPut, apiDelete, apiFetch } from '../../lib/apiClient';

interface EditState {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  permiteDownload: boolean;
  aulaId: string;
}

type MaterialListResponse = any[] | {
  data?: any[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

export default function AdminMateriais() {
  const [materiais, setMateriais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('geral');
  const [permiteDownload, setPermiteDownload] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [modulos, setModulos] = useState<any[]>([]);
  const [aulaSelecionada, setAulaSelecionada] = useState<string>('');
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
      .catch(() => setFeedback('Nao foi possivel carregar os materiais agora.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMateriais();
    apiGet<unknown[]>('/api/admin/aulas')
      .then((data) => { if (Array.isArray(data)) setModulos(data); })
      .catch(() => setFeedback('Nao foi possivel carregar a relacao de aulas.'));
  }, []);

  const handleUpload = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    if (!arquivo) return;
    setSubmitting(true);

    const formData = new FormData();
    formData.append('titulo', titulo);
    formData.append('descricao', descricao);
    formData.append('categoria', categoria);
    formData.append('permiteDownload', String(permiteDownload));
    if (aulaSelecionada) {
      formData.append('aulasRelacionadas', JSON.stringify([aulaSelecionada]));
    }
    formData.append('arquivo', arquivo);

    try {
      const response = await apiFetch('/api/admin/material', { method: 'POST', body: formData });

      if (!response.ok) {
        setFeedback('Nao foi possivel enviar o material.');
        return;
      }

      setTitulo('');
      setDescricao('');
      setCategoria('geral');
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
    if (!window.confirm('Excluir este material? Esta acao nao pode ser desfeita.')) return;
    setDeletingId(id);
    try {
      await apiDelete(`/api/admin/material/${id}`);
      setMateriais(prev => prev.filter((m: { id: string }) => m.id !== id));
      setFeedback('Material excluido com sucesso.');
    } catch {
      setFeedback('Erro ao excluir material.');
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (material: any) => {
    setEditState({
      id: material.id,
      titulo: material.titulo,
      descricao: material.descricao || '',
      categoria: material.categoria || 'geral',
      permiteDownload: material.permiteDownload,
      aulaId: material.materiaisAula?.[0]?.aula?.id || ''
    });
  };

  const handleSaveEdit = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    if (!editState) return;
    setSavingEdit(true);
    try {
      await apiPut(`/api/admin/material/${editState.id}`, {
        titulo: editState.titulo,
        descricao: editState.descricao,
        categoria: editState.categoria,
        permiteDownload: editState.permiteDownload,
        aulaId: editState.aulaId || null
      });
      setFeedback('Material atualizado com sucesso.');
      setEditState(null);
      loadMateriais();
    } catch {
      setFeedback('Erro ao atualizar material.');
    } finally {
      setSavingEdit(false);
    }
  };

  const allAulas = modulos.flatMap((m: any) => m.aulas?.map((a: any) => ({ id: a.id, titulo: a.titulo, modulo: m.titulo })) || []);

  return (
    <>
        <div className="page-header page-header-split">
          <div>
            <h1>Materiais de Apoio</h1>
            <p>{materiais.length} materiais cadastrados</p>
          </div>
          <button className="btn btn-accent" onClick={() => setShowForm(!showForm)} type="button">
            {showForm ? 'Fechar' : 'Upload'}
          </button>
        </div>

        {feedback && <div className="inline-feedback warning">{feedback}</div>}

        {showForm && (
          <div className="card mb-3 page-surface-narrow">
            <h3 className="section-title">Upload de material</h3>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label className="form-label" htmlFor="upload-titulo">Titulo</label>
                <input id="upload-titulo" className="form-input" value={titulo} onChange={(event) => setTitulo(event.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="upload-descricao">Descricao</label>
                <textarea id="upload-descricao" className="form-textarea" value={descricao} onChange={(event) => setDescricao(event.target.value)} rows={3} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="upload-categoria">Categoria</label>
                <select id="upload-categoria" className="form-select" value={categoria} onChange={(event) => setCategoria(event.target.value)}>
                  <option value="geral">Geral</option>
                  <option value="biblico">Biblico</option>
                  <option value="teologico">Teologico</option>
                  <option value="devocional">Devocional</option>
                  <option value="historico">Historico</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="upload-aula">Aula Relacionada (Opcional)</label>
                <select id="upload-aula" className="form-select" value={aulaSelecionada} onChange={(event) => setAulaSelecionada(event.target.value)}>
                  <option value="">Nenhuma aula vinculada</option>
                  {modulos.map(modulo => (
                    <optgroup key={modulo.id} label={modulo.titulo}>
                      {modulo.aulas?.map((aula: any) => (
                        <option key={aula.id} value={aula.id}>{aula.titulo}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="upload-arquivo">Arquivo</label>
                <input id="upload-arquivo" type="file" accept=".pdf,.epub,.docx" onChange={(event) => setArquivo(event.target.files?.[0] || null)} className="form-input file-input" />
              </div>
              <div className="form-group">
                <label className="checkbox-row">
                  <input type="checkbox" checked={permiteDownload} onChange={(event) => setPermiteDownload(event.target.checked)} />
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
              <button className="btn btn-ghost btn-sm" onClick={() => setEditState(null)} type="button">Cancelar</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-titulo">Titulo</label>
                <input id="edit-titulo" className="form-input" value={editState.titulo} onChange={e => setEditState(s => s && ({ ...s, titulo: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-descricao">Descricao</label>
                <textarea id="edit-descricao" className="form-textarea" value={editState.descricao} onChange={e => setEditState(s => s && ({ ...s, descricao: e.target.value }))} rows={3} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-categoria">Categoria</label>
                <select id="edit-categoria" className="form-select" value={editState.categoria} onChange={e => setEditState(s => s && ({ ...s, categoria: e.target.value }))}>
                  <option value="geral">Geral</option>
                  <option value="biblico">Biblico</option>
                  <option value="teologico">Teologico</option>
                  <option value="devocional">Devocional</option>
                  <option value="historico">Historico</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-aula">Aula Relacionada</label>
                <select id="edit-aula" className="form-select" value={editState.aulaId} onChange={e => setEditState(s => s && ({ ...s, aulaId: e.target.value }))}>
                  <option value="">Nenhuma aula vinculada</option>
                  {allAulas.map(a => (
                    <option key={a.id} value={a.id}>{a.modulo} — {a.titulo}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="checkbox-row">
                  <input type="checkbox" checked={editState.permiteDownload} onChange={e => setEditState(s => s && ({ ...s, permiteDownload: e.target.checked }))} />
                  <span>Permitir download pelos alunos</span>
                </label>
              </div>
              <button className="btn btn-primary" type="submit" disabled={savingEdit}>
                {savingEdit ? 'Salvando...' : 'Salvar alteracoes'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="card-grid">{[1, 2, 3].map((item) => <div key={item} className="skeleton skeleton-card" />)}</div>
        ) : (
          <>
            {/* Desktop table */}
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
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {materiais.length ? materiais.map((material) => (
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
                      <td><span className="badge badge-purple">{material.categoria}</span></td>
                      <td className="text-muted">{material.tipo?.toUpperCase()}</td>
                      <td>{material.permiteDownload ? <span className="badge badge-success">Sim</span> : <span className="badge badge-error">Nao</span>}</td>
                      <td className="text-muted">{material.materiaisAula?.map((item: any) => item.aula?.titulo).join(', ') || '-'}</td>
                      <td className="text-muted">{new Date(material.criadoEm).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(material)} type="button">Editar</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error, #ef4444)' }} onClick={() => handleDelete(material.id)} disabled={deletingId === material.id} type="button">
                            {deletingId === material.id ? '...' : 'Excluir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td className="text-muted" colSpan={7}>Nenhum material cadastrado ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="admin-card-list">
              {materiais.length ? materiais.map((material) => (
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
                    {material.permiteDownload
                      ? <span className="badge badge-success">Download: Sim</span>
                      : <span className="badge badge-error">Download: Nao</span>}
                  </div>
                  {material.materiaisAula?.length > 0 && (
                    <span className="text-muted text-sm">
                      Aula: {material.materiaisAula.map((item: any) => item.aula?.titulo).join(', ')}
                    </span>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(material)} type="button">Editar</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error, #ef4444)' }} onClick={() => handleDelete(material.id)} disabled={deletingId === material.id} type="button">
                      {deletingId === material.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </div>
              )) : (
                <p className="text-muted">Nenhum material cadastrado ainda.</p>
              )}
            </div>
          </>
        )}
    </>
  );
}
