import { useEffect, useState } from 'react';
import AppIcon from '../../components/AppIcon';

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
  const token = localStorage.getItem('accessToken');

  const loadMateriais = () => {
    fetch('/api/admin/materiais', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then(setMateriais)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMateriais();
    fetch('/api/admin/aulas', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) setModulos(data);
      })
      .catch(console.error);
  }, []);

  const handleUpload = async (event: React.FormEvent) => {
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

    await fetch('/api/admin/material', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    setTitulo('');
    setDescricao('');
    setCategoria('geral');
    setAulaSelecionada('');
    setArquivo(null);
    setShowForm(false);
    setSubmitting(false);
    loadMateriais();
  };

  return (
    <>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Materiais de Apoio</h1>
            <p>{materiais.length} materiais cadastrados</p>
          </div>
          <button className="btn btn-accent" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Fechar' : 'Upload'}
          </button>
        </div>

        {showForm && (
          <div className="card mb-3" style={{ maxWidth: 600 }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Upload de material</h3>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label className="form-label">Titulo</label>
                <input className="form-input" value={titulo} onChange={(event) => setTitulo(event.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Descricao</label>
                <textarea className="form-textarea" value={descricao} onChange={(event) => setDescricao(event.target.value)} rows={3} />
              </div>
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select className="form-select" value={categoria} onChange={(event) => setCategoria(event.target.value)}>
                  <option value="geral">Geral</option>
                  <option value="biblico">Biblico</option>
                  <option value="teologico">Teologico</option>
                  <option value="devocional">Devocional</option>
                  <option value="historico">Historico</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Aula Relacionada (Opcional)</label>
                <select className="form-select" value={aulaSelecionada} onChange={(event) => setAulaSelecionada(event.target.value)}>
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
                <label className="form-label">Arquivo</label>
                <input type="file" accept=".pdf,.epub,.docx" onChange={(event) => setArquivo(event.target.files?.[0] || null)} className="form-input" style={{ padding: '0.5rem' }} />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
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

        {loading ? (
          <div className="card-grid">{[1, 2, 3].map((item) => <div key={item} className="skeleton skeleton-card" />)}</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Download</th>
                  <th>Aulas</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {materiais.map((material) => (
                  <tr key={material.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AppIcon name="file" size={16} />
                        <div>
                          <div style={{ fontWeight: 500 }}>{material.titulo}</div>
                          {material.descricao && <div className="text-muted text-sm">{material.descricao.substring(0, 50)}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-purple">{material.categoria}</span></td>
                    <td className="text-muted">{material.tipo?.toUpperCase()}</td>
                    <td>{material.permiteDownload ? <span className="badge badge-success">Sim</span> : <span className="badge badge-error">Nao</span>}</td>
                    <td className="text-muted">{material.materiaisAula?.map((item: any) => item.aula?.titulo).join(', ') || '-'}</td>
                    <td className="text-muted">{new Date(material.criadoEm).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}
