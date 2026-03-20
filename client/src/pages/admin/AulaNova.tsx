import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../../components/AppIcon';

export default function AdminAulaNova() {
  const navigate = useNavigate();
  const [modulos, setModulos] = useState<any[]>([]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [moduloId, setModuloId] = useState('');
  const [publicar, setPublicar] = useState(true);
  const [video, setVideo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    fetch('/api/admin/modulos', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((data) => {
        setModulos(data);
        if (data.length > 0) setModuloId(data[0].id);
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setAiStatus('Enviando aula...');

    const formData = new FormData();
    formData.append('titulo', titulo);
    formData.append('descricao', descricao);
    formData.append('moduloId', moduloId);
    formData.append('publicado', String(publicar));
    if (video) formData.append('video', video);

    try {
      const response = await fetch('/api/admin/aula', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const aula = await response.json();
      setAiStatus('Aula criada com sucesso. Redirecionando...');

      setTimeout(() => navigate('/admin/aulas'), 1500);
    } catch {
      setAiStatus('Erro ao criar aula.');
      setSubmitting(false);
    }
  };

  return (
    <>
        <button className="btn btn-ghost mb-2" onClick={() => navigate('/admin/aulas')}>
          <AppIcon name="arrow-left" size={14} />
          <span>Voltar para aulas</span>
        </button>

        <div className="page-header">
          <h1>Nova Aula</h1>
          <p>Crie uma nova aula para adicionar a trilha desejada.</p>
        </div>

        <div className="card" style={{ maxWidth: 700 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Titulo da aula</label>
              <input className="form-input" value={titulo} onChange={(event) => setTitulo(event.target.value)} required />
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
              <label className="form-label">Video da aula</label>
              <input type="file" accept="video/mp4,video/quicktime,video/x-msvideo" onChange={(event) => setVideo(event.target.files?.[0] || null)} className="form-input" style={{ padding: '0.5rem' }} />
              {video && <p className="text-sm text-muted mt-1">{video.name} ({(video.size / 1024 / 1024).toFixed(1)} MB)</p>}
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={publicar} onChange={(event) => setPublicar(event.target.checked)} />
                <span className="form-label" style={{ margin: 0 }}>Publicar imediatamente</span>
              </label>
            </div>

            {aiStatus && (
              <div style={{ padding: '1rem', marginBottom: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                {aiStatus}
                {submitting && !aiStatus.includes('concluida') && !aiStatus.includes('Erro') && (
                  <div className="progress-bar mt-1">
                    <div className="progress-bar-fill" style={{ width: '70%', animation: 'shimmer 1.5s infinite' }} />
                  </div>
                )}
              </div>
            )}

            <button className="btn btn-accent btn-lg" type="submit" disabled={submitting || !titulo || !moduloId}>
              {submitting ? 'Processando...' : 'Criar aula'}
            </button>
          </form>
        </div>
    </>
  );
}
