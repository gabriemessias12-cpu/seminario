import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppIcon from '../../components/AppIcon';
import { clearDraft, readDraft, writeDraft } from '../../lib/draft-storage';

type MediaSourceType = 'youtube' | 'upload';

interface LessonDraft {
  titulo: string;
  descricao: string;
  moduloId: string;
  publicado: boolean;
  duracaoMinutos: string;
  sourceType: MediaSourceType;
  youtubeUrl: string;
  clearVideo: boolean;
  savedAt: number;
}

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
  const [generatingTranscript, setGeneratingTranscript] = useState(false);
  const [transcriptFeedback, setTranscriptFeedback] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const token = localStorage.getItem('accessToken');
  const draftKey = `admin:aula:editar:${id}`;

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [],
  );

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/aula/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()),
      fetch('/api/admin/modulos', { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()),
    ])
      .then(([aulaData, modulosData]) => {
        const moduleList = Array.isArray(modulosData) ? modulosData : [];
        const storedDraft = readDraft<LessonDraft>(draftKey);

        setAula(aulaData);
        setModulos(moduleList);

        if (storedDraft) {
          setTitulo(storedDraft.titulo || aulaData.titulo);
          setDescricao(storedDraft.descricao || '');
          setPublicado(storedDraft.publicado);
          setDuracaoMinutos(storedDraft.duracaoMinutos || String(Math.max(1, Math.round((aulaData.duracaoSegundos || 1800) / 60))));
          setSourceType(storedDraft.sourceType || inferSourceType(aulaData));
          setYoutubeUrl(storedDraft.youtubeUrl || '');
          setClearVideo(Boolean(storedDraft.clearVideo));
          setDraftSavedAt(storedDraft.savedAt || null);

          const draftModuleExists = moduleList.some((moduleItem) => moduleItem.id === storedDraft.moduloId);
          setModuloId(draftModuleExists ? storedDraft.moduloId : aulaData.moduloId);
        } else {
          setTitulo(aulaData.titulo);
          setDescricao(aulaData.descricao || '');
          setModuloId(aulaData.moduloId);
          setPublicado(aulaData.publicado);
          setDuracaoMinutos(String(Math.max(1, Math.round((aulaData.duracaoSegundos || 1800) / 60))));
          setSourceType(inferSourceType(aulaData));
          setYoutubeUrl(aulaData.youtubeUrl || '');
        }
      })
      .catch(() => setFeedback('Nao foi possivel carregar os dados da aula.'))
      .finally(() => {
        setLoading(false);
        setDraftReady(true);
      });
  }, [draftKey, id, token]);

  useEffect(() => {
    if (!draftReady || !id) {
      return;
    }

    const hasDraft = Boolean(
      titulo.trim() ||
      descricao.trim() ||
      moduloId ||
      duracaoMinutos.trim() ||
      youtubeUrl.trim() ||
      clearVideo ||
      sourceType !== 'upload' ||
      publicado !== false,
    );

    if (!hasDraft) {
      clearDraft(draftKey);
      setDraftSavedAt(null);
      return;
    }

    const nextSavedAt = Date.now();
    writeDraft<LessonDraft>(draftKey, {
      titulo,
      descricao,
      moduloId,
      publicado,
      duracaoMinutos,
      sourceType,
      youtubeUrl,
      clearVideo,
      savedAt: nextSavedAt,
    });
    setDraftSavedAt(nextSavedAt);
  }, [clearVideo, descricao, draftKey, draftReady, duracaoMinutos, id, moduloId, publicado, sourceType, titulo, youtubeUrl]);

  const clearEditDraft = () => {
    if (!aula) {
      return;
    }

    clearDraft(draftKey);
    setTitulo(aula.titulo);
    setDescricao(aula.descricao || '');
    setModuloId(aula.moduloId);
    setPublicado(aula.publicado);
    setDuracaoMinutos(String(Math.max(1, Math.round((aula.duracaoSegundos || 1800) / 60))));
    setSourceType(inferSourceType(aula));
    setYoutubeUrl(aula.youtubeUrl || '');
    setVideo(null);
    setClearVideo(false);
    setDraftSavedAt(null);
    setFeedback('');
  };

  const handleGenerateTranscript = async () => {
    if (!id) return;
    setGeneratingTranscript(true);
    setTranscriptFeedback('');
    try {
      const response = await fetch(`/api/admin/aula/${id}/gerar-transcricao`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erro ao gerar transcricao');
      setTranscriptFeedback(`Transcricao gerada com sucesso (${data.chars} caracteres). Ja esta disponivel na aula.`);
    } catch (error) {
      setTranscriptFeedback(error instanceof Error ? error.message : 'Nao foi possivel gerar a transcricao.');
    } finally {
      setGeneratingTranscript(false);
    }
  };

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
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setFeedback(data.error || 'Nao foi possivel salvar a aula.');
        return;
      }

      clearDraft(draftKey);
      setDraftSavedAt(null);
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
          <div className="page-header-split mb-2">
            <div>
              <h3 className="section-title">Ajustes da aula</h3>
              <p className="text-muted">
                O rascunho desta edicao e salvo automaticamente para nao se perder em refresh.
              </p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={clearEditDraft} type="button">
              Restaurar original
            </button>
          </div>

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
                {video
                  ? `${video.name} (${(video.size / 1024 / 1024).toFixed(1)} MB)`
                  : 'Selecione um novo arquivo apenas se quiser substituir o atual. Em refresh, o arquivo precisa ser escolhido de novo.'}
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

          <div className="inline-feedback neutral">
            {draftSavedAt
              ? `Rascunho salvo automaticamente em ${dateTimeFormatter.format(draftSavedAt)}.`
              : 'Alteracoes locais desta aula ficam guardadas automaticamente ate o envio.'}
          </div>

          {feedback && <div className="inline-feedback warning">{feedback}</div>}

          {aula?.videoTipo === 'youtube' && (
            <div className="surface-stack">
              {transcriptFeedback && (
                <div className={`inline-feedback ${transcriptFeedback.startsWith('Transcricao gerada') ? 'success' : 'warning'}`}>
                  {transcriptFeedback}
                </div>
              )}
              <button className="btn btn-outline" disabled={generatingTranscript} onClick={handleGenerateTranscript} type="button">
                {generatingTranscript ? 'Baixando audio e transcrevendo via Whisper (pode levar 1-3 min)...' : 'Gerar transcricao via OpenAI Whisper'}
              </button>
            </div>
          )}

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
