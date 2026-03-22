import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../../components/AppIcon';
import { clearDraft, readDraft, writeDraft } from '../../lib/draft-storage';

type MediaSourceType = 'youtube' | 'upload';

interface LessonDraft {
  titulo: string;
  descricao: string;
  moduloId: string;
  publicar: boolean;
  sourceType: MediaSourceType;
  youtubeUrl: string;
  savedAt: number;
}

const LESSON_DRAFT_KEY = 'admin:aula:nova:draft';

export default function AdminAulaNova() {
  const navigate = useNavigate();
  const [modulos, setModulos] = useState<any[]>([]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [moduloId, setModuloId] = useState('');
  const [publicar, setPublicar] = useState(true);
  const [sourceType, setSourceType] = useState<MediaSourceType>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [video, setVideo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const token = localStorage.getItem('accessToken');

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [],
  );

  useEffect(() => {
    fetch('/api/admin/modulos', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((data) => {
        const moduleList = Array.isArray(data) ? data : [];
        const storedDraft = readDraft<LessonDraft>(LESSON_DRAFT_KEY);

        setModulos(moduleList);
        if (storedDraft) {
          setTitulo(storedDraft.titulo || '');
          setDescricao(storedDraft.descricao || '');
          setPublicar(storedDraft.publicar);
          setSourceType(storedDraft.sourceType || 'youtube');
          setYoutubeUrl(storedDraft.youtubeUrl || '');
          setDraftSavedAt(storedDraft.savedAt || null);

          const draftModuleExists = moduleList.some((moduleItem) => moduleItem.id === storedDraft.moduloId);
          setModuloId(draftModuleExists ? storedDraft.moduloId : moduleList[0]?.id || '');
        } else if (moduleList.length > 0) {
          setModuloId(moduleList[0].id);
        }
      })
      .catch(() => setAiStatus('Nao foi possivel carregar os modulos agora.'))
      .finally(() => setDraftReady(true));
  }, [token]);

  useEffect(() => {
    if (!draftReady) {
      return;
    }

    const hasDraft = Boolean(
      titulo.trim() ||
      descricao.trim() ||
      moduloId ||
      youtubeUrl.trim() ||
      sourceType !== 'youtube' ||
      publicar !== true,
    );

    if (!hasDraft) {
      clearDraft(LESSON_DRAFT_KEY);
      setDraftSavedAt(null);
      return;
    }

    const nextSavedAt = Date.now();
    writeDraft<LessonDraft>(LESSON_DRAFT_KEY, {
      titulo,
      descricao,
      moduloId,
      publicar,
      sourceType,
      youtubeUrl,
      savedAt: nextSavedAt,
    });
    setDraftSavedAt(nextSavedAt);
  }, [descricao, draftReady, moduloId, publicar, sourceType, titulo, youtubeUrl]);

  const clearLessonDraft = () => {
    clearDraft(LESSON_DRAFT_KEY);
    setTitulo('');
    setDescricao('');
    setModuloId(modulos[0]?.id || '');
    setPublicar(true);
    setSourceType('youtube');
    setYoutubeUrl('');
    setVideo(null);
    setDraftSavedAt(null);
    setAiStatus('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setAiStatus('Enviando aula...');

    const formData = new FormData();
    formData.append('titulo', titulo);
    formData.append('descricao', descricao);
    formData.append('moduloId', moduloId);
    formData.append('publicado', String(publicar));

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
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        setAiStatus(data.error || 'Erro ao criar aula.');
        setSubmitting(false);
        return;
      }

      clearDraft(LESSON_DRAFT_KEY);
      setDraftSavedAt(null);
      setAiStatus('Aula criada com sucesso, registrada no historico e sincronizada. Redirecionando...');
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
          <div className="page-header-split mb-2">
            <div>
              <h3 className="section-title">Conteudo da aula</h3>
              <p className="text-muted">
                O rascunho textual e salvo automaticamente para sobreviver a atualizacoes de pagina.
              </p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={clearLessonDraft} type="button">
              Limpar rascunho
            </button>
          </div>

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
                <p className="form-helper-text">
                  O sistema protege esse video no player do aluno e evita download direto. Se voce atualizar a pagina,
                  o navegador exige selecionar o arquivo novamente.
                </p>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="checkbox-row">
              <input checked={publicar} onChange={(event) => setPublicar(event.target.checked)} type="checkbox" />
              <span className="form-label checkbox-label">Publicar imediatamente</span>
            </label>
          </div>

          <div className="inline-feedback neutral">
            {draftSavedAt
              ? `Rascunho salvo automaticamente em ${dateTimeFormatter.format(draftSavedAt)}.`
              : 'Cada campo textual desta aula fica salvo automaticamente enquanto voce digita.'}
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
