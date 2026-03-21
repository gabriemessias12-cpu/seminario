import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppIcon from '../../components/AppIcon';

type MediaSourceType = 'youtube' | 'upload';

function inferSourceType(aula: any): MediaSourceType {
  return aula?.videoTipo === 'youtube' ? 'youtube' : 'upload';
}

export default function AdminAulaEditar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aula, setAula] = useState<any>(null);
  const [modulos, setModulos] = useState<any[]>([]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [moduloId, setModuloId] = useState('');
  const [publicado, setPublicado] = useState(false);
  const [duracaoMinutos, setDuracaoMinutos] = useState('30');
  const [sourceType, setSourceType] = useState<MediaSourceType>('upload');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [video, setVideo] = useState<File | null>(null);
  const [clearVideo, setClearVideo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
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
        setDuracaoMinutos(String(Math.max(1, Math.round((aulaData.duracaoSegundos || 1800) / 60))));
        setSourceType(inferSourceType(aulaData));
        setYoutubeUrl(aulaData.youtubeUrl || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, token]);

  const handleSave = async () => {
    if (!id) {
      return;
    }

    setSaving(true);
    setFeedback('');

    const formData = new FormData();
    formData.append('titulo', titulo);
    formData.append('descricao', descricao);
    formData.append('moduloId', moduloId);
    formData.append('publicado', String(publicado));
    formData.append('duracaoMinutos', duracaoMinutos);

    if (sourceType === 'youtube' && youtubeUrl.trim()) {
      formData.append('youtubeUrl', youtubeUrl.trim());
    }

    if (sourceType === 'upload' && video) {
      formData.append('video', video);
    }

    if (clearVideo) {
      formData.append('clearVideo', 'true');
    }

    try {
      const response = await fetch(`/api/admin/aula/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        setFeedback(data.error || 'Nao foi possivel salvar a aula.');
        return;
      }

      navigate('/admin/aulas');
    } catch {
      setFeedback('Erro ao salvar a aula.');
    } finally {
      setSaving(false);
    }
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
      <button className="btn btn-ghost mb-2" onClick={() => navigate('/admin/aulas')} type="button">
        <AppIcon name="arrow-left" size={14} />
        <span>Voltar para aulas</span>
      </button>

      <div className="page-header">
        <h1>Editar Aula</h1>
        <p>Atualize o conteudo, a origem do video e o comportamento de publicacao.</p>
      </div>

      <div className="card content-form-card">
        <div className="content-form">
          <div className="form-group">
            <label className="form-label">Titulo</label>
            <input className="form-input" value={titulo} onChange={(event) => setTitulo(event.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Descricao</label>
            <textarea className="form-textarea" rows={4} value={descricao} onChange={(event) => setDescricao(event.target.value)} />
          </div>

          <div className="form-row form-row-compact">
            <div className="form-group">
              <label className="form-label">Modulo</label>
              <select className="form-select" value={moduloId} onChange={(event) => setModuloId(event.target.value)}>
                {modulos.map((modulo) => (
                  <option key={modulo.id} value={modulo.id}>{modulo.titulo}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Duracao estimada</label>
              <input
                className="form-input"
                inputMode="numeric"
                min={1}
                type="number"
                value={duracaoMinutos}
                onChange={(event) => setDuracaoMinutos(event.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Origem do video</label>
            <div className="media-source-grid">
              <button
                className={`media-source-card ${sourceType === 'youtube' ? 'active' : ''}`}
                onClick={() => {
                  setSourceType('youtube');
                  setClearVideo(false);
                  setVideo(null);
                }}
                type="button"
              >
                <span className="media-source-icon">
                  <AppIcon name="youtube" size={18} />
                </span>
                <div>
                  <strong>YouTube</strong>
                  <p>Use para aulas longas hospedadas fora da VPS.</p>
                </div>
              </button>

              <button
                className={`media-source-card ${sourceType === 'upload' ? 'active' : ''}`}
                onClick={() => {
                  setSourceType('upload');
                  setClearVideo(false);
                }}
                type="button"
              >
                <span className="media-source-icon">
                  <AppIcon name="play" size={18} />
                </span>
                <div>
                  <strong>Arquivo local</strong>
                  <p>Troque o video hospedado no proprio servidor quando precisar.</p>
                </div>
              </button>
            </div>
          </div>

          {sourceType === 'youtube' ? (
            <div className="form-group">
              <label className="form-label">Link do YouTube</label>
              <input
                className="form-input"
                placeholder="https://www.youtube.com/watch?v=..."
                type="url"
                value={youtubeUrl}
                onChange={(event) => {
                  setYoutubeUrl(event.target.value);
                  setClearVideo(false);
                }}
              />
              <p className="form-helper-text">Se este campo for preenchido, o aluno assistira a aula por um player incorporado.</p>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Substituir video local</label>
              <input
                accept="video/mp4,video/quicktime,video/x-msvideo"
                className="form-input file-input"
                onChange={(event) => {
                  setVideo(event.target.files?.[0] || null);
                  setClearVideo(false);
                }}
                type="file"
              />
              <p className="form-helper-text">
                {video ? `${video.name} (${(video.size / 1024 / 1024).toFixed(1)} MB)` : 'Selecione um novo arquivo apenas se quiser substituir o atual.'}
              </p>
            </div>
          )}

          <div className="form-row form-row-compact">
            <div className="form-group">
              <label className="checkbox-row">
                <input checked={publicado} onChange={(event) => setPublicado(event.target.checked)} type="checkbox" />
                <span className="form-label checkbox-label">Publicado</span>
              </label>
            </div>

            <div className="form-group">
              <label className="checkbox-row">
                <input checked={clearVideo} onChange={(event) => setClearVideo(event.target.checked)} type="checkbox" />
                <span className="form-label checkbox-label">Remover video atual</span>
              </label>
            </div>
          </div>

          {aula && (
            <div className="content-status-card">
              <p><strong>Status IA:</strong> <span className={`badge ${aula.statusIA === 'concluido' ? 'badge-success' : 'badge-warning'}`}>{aula.statusIA}</span></p>
              <p><strong>Origem atual:</strong> {aula.videoTipo === 'youtube' ? 'YouTube' : aula.urlVideo ? 'Arquivo local' : 'Sem video'}</p>
              <p><strong>Alunos que assistiram:</strong> {aula.progressos?.length || 0}</p>
            </div>
          )}

          {feedback && <div className="inline-feedback warning">{feedback}</div>}

          <div className="content-form-actions">
            <button className="btn btn-primary" disabled={saving} onClick={handleSave} type="button">
              {saving ? 'Salvando...' : 'Salvar alteracoes'}
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/admin/aulas')} type="button">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
