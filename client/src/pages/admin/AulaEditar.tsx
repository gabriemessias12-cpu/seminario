import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppIcon from '../../components/AppIcon';

export default function AdminAulaEditar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aula, setAula] = useState<any>(null);
  const [modulos, setModulos] = useState<any[]>([]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [moduloId, setModuloId] = useState('');
  const [publicado, setPublicado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/aula/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()),
      fetch('/api/admin/modulos', { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json())
    ])
      .then(([aulaData, modulosData]) => {
        setAula(aulaData);
        setModulos(modulosData);
        setTitulo(aulaData.titulo);
        setDescricao(aulaData.descricao || '');
        setModuloId(aulaData.moduloId);
        setPublicado(aulaData.publicado);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/admin/aula/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ titulo, descricao, moduloId, publicado })
    });
    setSaving(false);
    navigate('/admin/aulas');
  };

  if (loading) {
    return (
      <>
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-card" style={{ height: 300 }} />
      </>
    );
  }

  return (
    <>
        <button className="btn btn-ghost mb-2" onClick={() => navigate('/admin/aulas')}>
          <AppIcon name="arrow-left" size={14} />
          <span>Voltar para aulas</span>
        </button>

        <div className="page-header">
          <h1>Editar Aula</h1>
          <p>Atualize as informacoes da aula.</p>
        </div>

        <div className="card" style={{ maxWidth: 700 }}>
          <div className="form-group">
            <label className="form-label">Titulo</label>
            <input className="form-input" value={titulo} onChange={(event) => setTitulo(event.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Descricao</label>
            <textarea className="form-textarea" value={descricao} onChange={(event) => setDescricao(event.target.value)} rows={4} />
          </div>

          <div className="form-group">
            <label className="form-label">Modulo</label>
            <select className="form-select" value={moduloId} onChange={(event) => setModuloId(event.target.value)}>
              {modulos.map((modulo) => (
                <option key={modulo.id} value={modulo.id}>{modulo.titulo}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={publicado} onChange={(event) => setPublicado(event.target.checked)} />
              <span className="form-label" style={{ margin: 0 }}>Publicado</span>
            </label>
          </div>

          {aula && (
            <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
              <p><strong>Status IA:</strong> <span className={`badge ${aula.statusIA === 'concluido' ? 'badge-success' : 'badge-warning'}`}>{aula.statusIA}</span></p>
              <p className="mt-1"><strong>Duracao:</strong> {Math.round(aula.duracaoSegundos / 60)} min</p>
              <p className="mt-1"><strong>Alunos que assistiram:</strong> {aula.progressos?.length || 0}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alteracoes'}
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/admin/aulas')}>
              Cancelar
            </button>
          </div>
        </div>
    </>
  );
}
