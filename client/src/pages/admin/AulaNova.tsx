import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../../components/AppIcon';

type MediaSourceType = 'youtube' | 'upload';

export default function AdminAulaNova() {
  const navigate = useNavigate();
  const [modulos, setModulos] = useState<any[]>([]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [moduloId, setModuloId] = useState('');
  const [publicar, setPublicar] = useState(true);
  const [sourceType, setSourceType] = useState<MediaSourceType>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [duracaoMinutos, setDuracaoMinutos] = useState('30');
  const [video, setVideo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    fetch('/api/admin/modulos', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((data) => {
        setModulos(data);
        if (data.length > 0) {
          setModuloId(data[0].id);
        }
      })
      .catch(console.error);
  }, [token]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setAiStatus('Enviando aula...');

    const formData = new FormData();
    formData.append('titulo', titulo);
    formData.append('descricao', descricao);
    formData.append('moduloId', moduloId);
    formData.append('publicado', String(publicar));
    formData.append('duracaoMinutos', duracaoMinutos);

    if (sourceType === 'upload' && video) {
      formData.append('video', video);
    }

    if (sourceType === 'youtube' && youtubeUrl.trim()) {
      formData.append('youtubeUrl', youtubeUrl.trim());
    }

    try {
      const response = await fetch('/api/admin/aula', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        setAiStatus(data.error || 'Erro ao criar aula.');
        setSubmitting(false);
        return;
      }

      setAiStatus('Aula criada com sucesso. Redirecionando...');
      setTimeout(() => navigate('/admin/aulas'), 1200);
    } catch {
      setAiStatus('Erro ao criar aula.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <button className="btn btn-ghost mb-2" onClick={() => navigate('/admin/aulas')} type="button">
        <AppIcon name="arrow-left" size={14} />
        <span>Voltar para aulas</span>
      </button>

      <div className="page-header">
        <h1>Nova Aula</h1>
        <p>Cadastre o conteudo do seminario com arquivo local ou link do YouTube nao listado.</p>
      </div>

      <div className="card content-form-card">
        <form className="content-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Titulo da aula</label>
            <input className="form-input" value={titulo} onChange={(event) => setTitulo(event.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Descricao</label>
            <textarea className="form-textarea" value={descricao} onChange={(event) => setDescricao(event.target.value)} rows={4} />
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
                  setVideo(null);
                }}
                type="button"
              >
                <span className="media-source-icon">
                  <AppIcon name="youtube" size={18} />
                </span>
                <div>
                  <strong>YouTube</strong>
                  <p>Recomendado para aulas grandes, economizando espaco na VPS.</p>
                </div>
              </button>

              <button
                className={`media-source-card ${sourceType === 'upload' ? 'active' : ''}`}
                onClick={() => {
                  setSourceType('upload');
                  setYoutubeUrl('');
                }}
                type="button"
              >
                <span className="media-source-icon">
                  <AppIcon name="play" size={18} />
                </span>
                <div>
                  <strong>Arquivo local</strong>
                  <p>Ideal para videos menores ou conteudos que precisam ficar hospedados aqui.</p>
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
                onChange={(event) => setYoutubeUrl(event.target.value)}
              />
              <p className="form-helper-text">Use preferencialmente um video nao listado. No player do aluno ele continua integrado a aula.</p>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Video da aula</label>
              <input
                accept="video/mp4,video/quicktime,video/x-msvideo"
                className="form-input file-input"
                onChange={(event) => setVideo(event.target.files?.[0] || null)}
                type="file"
              />
              {video ? (
                <p className="form-helper-text">{video.name} ({(video.size / 1024 / 1024).toFixed(1)} MB)</p>
              ) : (
                <p className="form-helper-text">O sistema protege esse video no player do aluno e evita download direto.</p>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="checkbox-row">
              <input checked={publicar} onChange={(event) => setPublicar(event.target.checked)} type="checkbox" />
              <span className="form-label checkbox-label">Publicar imediatamente</span>
            </label>
          </div>

          {aiStatus && (
            <div className="inline-feedback neutral">
              {aiStatus}
              {submitting && !aiStatus.includes('sucesso') && !aiStatus.includes('Erro') && (
                <div className="progress-bar mt-1">
                  <div className="progress-bar-fill" style={{ width: '70%', animation: 'shimmer 1.5s infinite' }} />
                </div>
              )}
            </div>
          )}

          <div className="content-form-actions">
            <button className="btn btn-accent btn-lg" disabled={submitting || !titulo || !moduloId} type="submit">
              {submitting ? 'Processando...' : 'Criar aula'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
