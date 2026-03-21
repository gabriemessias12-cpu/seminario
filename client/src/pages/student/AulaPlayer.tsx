import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import AppIcon from '../../components/AppIcon';
import { apiUrl } from '../../lib/api';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: (() => void) | undefined;
  }
}

type AssistantMessage = {
  id: string;
  pergunta: string;
  resposta: string;
  detalhes?: {
    destaques?: string[];
    proximosPassos?: string[];
    nivelConfianca?: string;
    provider?: string;
  };
};
function parseJSON<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    return JSON.parse(value) as T[];
  } catch {
    return [];
  }
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
}

function getYoutubeIdFromEmbedUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/embed\/([A-Za-z0-9_-]{11})/);
  return match?.[1] ?? null;
}

export default function StudentAulaPlayer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken');
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeHostRef = useRef<HTMLDivElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const progressInterval = useRef<number | null>(null);
  const demoInterval = useRef<number | null>(null);
  const youtubeInterval = useRef<number | null>(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);

  const [aula, setAula] = useState<any>(null);
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [maxWatched, setMaxWatched] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState('resumo');
  const [notes, setNotes] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState('');
  const [completionLoading, setCompletionLoading] = useState(false);
  const [lessonFeedback, setLessonFeedback] = useState('');

  const lessonControlsUnlocked = Boolean(aula?.controleVideo?.liberaSeek);
  const isYoutubeLesson = aula?.videoTipo === 'youtube';
  const youtubeVideoId = getYoutubeIdFromEmbedUrl(aula?.videoEmbedUrl);
  const demoMode = Boolean(aula && aula.videoTipo === 'none');

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/aluno/aula/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()),
      fetch('/api/aluno/aulas', { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json())
    ])
      .then(([lessonData, modules]) => {
        setPlaying(false);
        setAula(lessonData);
        setAssistantMessages(lessonData.interacoesIA || []);

        const progress = lessonData.progressos?.[0];
        if (progress) {
          setMaxWatched(progress.percentualAssistido);
          setCompleted(progress.concluido);
          setCurrentTime(progress.posicaoAtualSegundos || 0);
        }

        if (lessonData.anotacoes?.[0]) setNotes(lessonData.anotacoes[0].conteudo);
        if (lessonData.melhorResultado) {
          setQuizSubmitted(true);
          setQuizScore(lessonData.melhorResultado.pontuacao);
        }
        if (lessonData.duracaoSegundos) setDuration(lessonData.duracaoSegundos);

        const moduloAtual = modules.find((module: any) => module.id === lessonData.moduloId);
        setPlaylist(moduloAtual?.aulas || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, token]);

  const saveProgress = useCallback((percentual: number, posicao: number, pausou = false) => {
    if (!id) return;

    fetch('/api/aluno/progresso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        aulaId: id,
        percentualAssistido: percentual,
        posicaoAtualSegundos: posicao,
        pausou
      })
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.concluido) setCompleted(true);
        setMaxWatched((current: number) => Math.max(current, data.percentualAssistido || percentual));
      })
      .catch(console.error);
  }, [id, token]);

  const saveCurrentProgress = useCallback((pausou = false) => {
    if (!durationRef.current) return;

    if (isYoutubeLesson) {
      const player = youtubePlayerRef.current;
      if (!player?.getCurrentTime || !player?.getDuration) return;

      const youtubeDuration = player.getDuration();
      const youtubeCurrentTime = player.getCurrentTime();
      if (!youtubeDuration) return;

      const percentual = Math.round((youtubeCurrentTime / youtubeDuration) * 100);
      saveProgress(percentual, youtubeCurrentTime, pausou);
      return;
    }

    if (demoMode) {
      const percentual = Math.round((currentTimeRef.current / durationRef.current) * 100);
      saveProgress(percentual, currentTimeRef.current, pausou);
      return;
    }

    const video = videoRef.current;
    if (!video || !video.duration) return;

    const percentual = Math.round((video.currentTime / video.duration) * 100);
    saveProgress(percentual, video.currentTime, pausou);
  }, [demoMode, isYoutubeLesson, saveProgress]);

  useEffect(() => {
    if (!playing) return;
    progressInterval.current = window.setInterval(() => saveCurrentProgress(false), 5000);
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [playing, saveCurrentProgress]);

  useEffect(() => {
    if (!demoMode || !playing) return;
    demoInterval.current = window.setInterval(() => {
      setCurrentTime((current) => Math.min(current + 1, durationRef.current || current + 1));
    }, 1000);
    return () => {
      if (demoInterval.current) clearInterval(demoInterval.current);
    };
  }, [demoMode, playing]);

  useEffect(() => {
    if (!isYoutubeLesson || !playing) return;

    youtubeInterval.current = window.setInterval(() => {
      const player = youtubePlayerRef.current;
      if (!player?.getCurrentTime || !player?.getDuration) return;

      const nextCurrentTime = player.getCurrentTime();
      const nextDuration = player.getDuration();
      if (Number.isFinite(nextDuration) && nextDuration > 0) {
        setDuration(nextDuration);
      }
      setCurrentTime(nextCurrentTime);

      if (nextDuration > 0) {
        const percentual = Math.round((nextCurrentTime / nextDuration) * 100);
        setMaxWatched((current) => Math.max(current, percentual));
        if (percentual >= 95) {
          setCompleted(true);
        }
      }
    }, 1000);

    return () => {
      if (youtubeInterval.current) clearInterval(youtubeInterval.current);
    };
  }, [isYoutubeLesson, playing]);

  useEffect(() => {
    if (!demoMode || !duration) return;
    const percentual = Math.round((currentTime / duration) * 100);
    setMaxWatched((current) => Math.max(current, percentual));
    if (percentual >= 95) setCompleted(true);
    if (currentTime >= duration && playing) {
      setPlaying(false);
      saveProgress(100, duration);
    }
  }, [currentTime, demoMode, duration, playing, saveProgress]);

  useEffect(() => {
    if (!isYoutubeLesson) return;

    const player = youtubePlayerRef.current;
    if (!player?.setVolume) return;

    if (volume === 0) {
      player.mute?.();
      return;
    }

    player.unMute?.();
    player.setVolume(Math.round(volume * 100));
  }, [isYoutubeLesson, volume]);

  useEffect(() => {
    if (!isYoutubeLesson || !youtubeVideoId || !youtubeHostRef.current) return;

    let cancelled = false;

    const initializePlayer = () => {
      if (cancelled || !window.YT?.Player || !youtubeHostRef.current) return;

      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = new window.YT.Player(youtubeHostRef.current, {
        videoId: youtubeVideoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0
        },
        events: {
          onReady: (event: any) => {
            if (cancelled) return;

            const nextDuration = event.target.getDuration?.() || 0;
            if (nextDuration > 0) {
              setDuration(nextDuration);
            }

            const progress = aula?.progressos?.[0];
            if (progress?.posicaoAtualSegundos) {
              event.target.seekTo(progress.posicaoAtualSegundos, true);
            }

            event.target.setVolume(Math.round(volume * 100));
          },
          onStateChange: (event: any) => {
            if (cancelled || !window.YT?.PlayerState) return;

            if (event.data === window.YT.PlayerState.PLAYING) {
              setPlaying(true);
              return;
            }

            if (event.data === window.YT.PlayerState.PAUSED) {
              setPlaying(false);
              saveCurrentProgress(true);
              return;
            }

            if (event.data === window.YT.PlayerState.ENDED) {
              setPlaying(false);
              saveProgress(100, durationRef.current || duration);
            }
          }
        }
      });
    };

    if (window.YT?.Player) {
      initializePlayer();
    } else {
      const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        initializePlayer();
      };

      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
    };
  }, [aula?.id, aula?.progressos, isYoutubeLesson, saveCurrentProgress, saveProgress, youtubeVideoId]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    const percentual = video.duration > 0 ? Math.round((video.currentTime / video.duration) * 100) : 0;
    setMaxWatched((current) => Math.max(current, percentual));
    if (percentual >= 95) setCompleted(true);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    const progress = aula?.progressos?.[0];
    if (progress?.posicaoAtualSegundos) video.currentTime = progress.posicaoAtualSegundos;
  };

  const togglePlay = useCallback(() => {
    if (isYoutubeLesson) {
      const player = youtubePlayerRef.current;
      if (!player?.playVideo || !player?.pauseVideo || !player?.getPlayerState) {
        return;
      }

      const playerState = player.getPlayerState();
      if (playerState === window.YT?.PlayerState?.PLAYING) {
        player.pauseVideo();
        setPlaying(false);
        saveCurrentProgress(true);
      } else {
        player.playVideo();
        setPlaying(true);
      }
      return;
    }

    if (demoMode) {
      if (playing) {
        setPlaying(false);
        saveCurrentProgress(true);
      } else {
        setPlaying(true);
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
      saveCurrentProgress(true);
    }
  }, [demoMode, isYoutubeLesson, playing, saveCurrentProgress]);

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((!completed && !lessonControlsUnlocked) || !durationRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const nextTime = ((event.clientX - rect.left) / rect.width) * durationRef.current;

    if (isYoutubeLesson) {
      youtubePlayerRef.current?.seekTo?.(nextTime, true);
      setCurrentTime(nextTime);
      return;
    }

    if (demoMode) {
      setCurrentTime(nextTime);
      return;
    }
    if (videoRef.current) videoRef.current.currentTime = nextTime;
  };

  const handleVideoSeeking = () => {
    if (demoMode || completed || lessonControlsUnlocked) return;
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - currentTimeRef.current) > 1) {
      video.currentTime = currentTimeRef.current;
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowLeft', 'j', 'J', 'l', 'L'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (event.key === ' ' || event.key === 'k' || event.key === 'K') {
        event.preventDefault();
        togglePlay();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  const quizData = useMemo(() => {
    if (!aula?.quizzes?.[0]?.questoes) return [];
    try {
      return JSON.parse(aula.quizzes[0].questoes);
    } catch {
      return [];
    }
  }, [aula]);

  const pontosChave = parseJSON<string>(aula?.pontosChave);
  const versiculos = parseJSON<{ referencia: string; texto: string }>(aula?.versiculos);
  const glossario = parseJSON<{ termo: string; definicao: string }>(aula?.glossario);
  const materiais = aula?.materiaisAula?.map((item: any) => item.material) || [];

  const handleSubmitQuiz = () => {
    let score = 0;
    quizData.forEach((question: any, index: number) => {
      const selected = quizAnswers[index];
      if (selected !== undefined && question.alternativas[selected]?.correta) score += 1;
    });

    fetch('/api/aluno/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ aulaId: id, respostas: quizAnswers, pontuacao: score, totalQuestoes: quizData.length })
    }).catch(console.error);

    setQuizScore(score);
    setQuizSubmitted(true);
  };

  const saveNotes = () => {
    fetch('/api/aluno/anotacao', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ aulaId: id, conteudo: notes })
    }).catch(console.error);
  };

  const handleManualComplete = async () => {
    if (!id) return;

    setCompletionLoading(true);
    setLessonFeedback('');

    try {
      const response = await fetch(`/api/aluno/aula/${id}/concluir`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        setLessonFeedback(data.error || 'Nao foi possivel concluir a aula.');
        return;
      }

      setCompleted(true);
      setMaxWatched(100);
      if (durationRef.current) {
        setCurrentTime(durationRef.current);
      }
      setAula((current: any) => current ? ({
        ...current,
        progressos: [
          {
            ...(current.progressos?.[0] || {}),
            percentualAssistido: 100,
            concluido: true,
            posicaoAtualSegundos: durationRef.current || duration
          }
        ]
      }) : current);
      setPlaylist((current) => current.map((item: any) => (
        item.id === id
          ? {
              ...item,
              progressos: [
                {
                  ...(item.progressos?.[0] || {}),
                  percentualAssistido: 100,
                  concluido: true
                }
              ]
            }
          : item
      )));
      setLessonFeedback('Aula concluida com base na presenca confirmada.');
    } catch {
      setLessonFeedback('Erro ao comunicar com o servidor.');
    } finally {
      setCompletionLoading(false);
    }
  };

  const handleAssistantAsk = async () => {
    if (!assistantQuestion.trim()) return;
    setAssistantLoading(true);
    setAssistantError('');

    try {
      const response = await fetch('/api/aluno/ia/perguntar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ aulaId: id, pergunta: assistantQuestion })
      });
      const data = await response.json();

      if (!response.ok) {
        setAssistantError(data.error || 'Nao foi possivel consultar o assistente.');
        return;
      }

      setAssistantMessages((current) => [
        {
          id: data.interacao?.id || `${Date.now()}`,
          pergunta: assistantQuestion,
          resposta: data.resposta,
          detalhes: {
            destaques: data.destaques,
            proximosPassos: data.proximosPassos,
            nivelConfianca: data.nivelConfianca,
            provider: data.provider
          }
        },
        ...current
      ]);
      setAssistantQuestion('');
    } catch {
      setAssistantError('Erro ao comunicar com o servidor.');
    } finally {
      setAssistantLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="layout student-layout">
        <Sidebar type="student" />
        <main className="main-content student-main">
          <div className="skeleton" style={{ height: 360 }} />
        </main>
      </div>
    );
  }

  if (!aula) {
    return (
      <div className="layout student-layout">
        <Sidebar type="student" />
        <main className="main-content student-main">
          <div className="empty-panel">
            <AppIcon name="lock" size={20} />
            <p>Aula nao encontrada.</p>
          </div>
        </main>
      </div>
    );
  }

  const tabs: Array<{ key: string; label: string; icon: React.ComponentProps<typeof AppIcon>['name'] }> = [
    { key: 'resumo', label: 'Resumo', icon: 'book' as const },
    { key: 'transcricao', label: 'Transcricao', icon: 'notes' as const },
    { key: 'pontos', label: 'Pontos-chave', icon: 'target' as const },
    { key: 'versiculos', label: 'Versiculos', icon: 'shield' as const },
    { key: 'glossario', label: 'Glossario', icon: 'library' as const },
    { key: 'materiais', label: 'Materiais', icon: 'folder' as const },
    { key: 'notas', label: 'Minhas notas', icon: 'notes' as const },
    { key: 'assistente', label: 'Assistente IA', icon: 'search' as const }
  ];
  if (completed || maxWatched >= 95) tabs.push({ key: 'quiz', label: 'Questionario', icon: 'quiz' as const });

  return (
    <div className="layout student-layout">
      <Sidebar type="student" />
      <main className="main-content student-main">
        <section className="student-topbar">
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <button className="text-link-button" type="button" onClick={() => navigate('/aulas')}>
                <AppIcon name="arrow-left" size={16} />
                <span>Voltar para conteudos</span>
              </button>
            </div>
            <span className="section-kicker">{aula.modulo?.titulo ? `MÓDULO ${aula.modulo.ordem} — ${aula.modulo.titulo}` : 'AULA AVULSA'}</span>
            <h1 className="student-page-title">{aula.titulo}</h1>
            <p className="student-page-subtitle">Player protegido com progresso salvo e quiz bloqueado ate 95%.</p>
          </div>
        </section>

        {lessonFeedback && (
          <div className={`inline-feedback ${lessonFeedback.includes('concluida') ? 'success' : 'warning'}`}>
            {lessonFeedback}
          </div>
        )}

        <div className="lesson-player-shell">
          <section className="lesson-player-main">
            <div
              className="lesson-player-stage"
              onContextMenu={(event) => event.preventDefault()}
              onCopy={(event) => event.preventDefault()}
              onCut={(event) => event.preventDefault()}
              onDragStart={(event) => event.preventDefault()}
            >
              {isYoutubeLesson ? (
                <div className="youtube-player-shell">
                  <div className="youtube-player-host" ref={youtubeHostRef} />
                </div>
              ) : !demoMode ? (
                <video
                  ref={videoRef}
                  src={aula.videoStreamUrl ? apiUrl(aula.videoStreamUrl) : undefined}
                  controlsList="nodownload noremoteplayback nofullscreen"
                  disablePictureInPicture
                  disableRemotePlayback
                  playsInline
                  preload="metadata"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onSeeking={handleVideoSeeking}
                  onEnded={() => {
                    setPlaying(false);
                    saveProgress(100, durationRef.current || duration);
                  }}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onContextMenu={(event) => event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                  style={{ width: '100%', height: '100%', background: '#050507' }}
                />
              ) : (
                <div className="demo-player-state">
                  <div className="demo-player-badge">modo demonstracao</div>
                  <AppIcon name="play" size={44} />
                  <h3>{aula.titulo}</h3>
                  <p>Mesmo sem video real, o fluxo de progresso, trava da barra e liberacao do questionario permanece ativo.</p>
                </div>
              )}

              <div className={`player-progress-badge ${completed || lessonControlsUnlocked ? 'completed' : ''}`}>
                {completed
                  ? 'Conteudo concluido'
                  : lessonControlsUnlocked
                    ? 'Presenca confirmada: navegacao livre'
                    : `Assistido ate ${maxWatched}%`}
              </div>

              <div className="player-controls">
                <div className={`player-seekbar ${!completed && !lessonControlsUnlocked ? 'locked' : ''}`} onClick={handleSeek}>
                  <div className="player-seekbar-watched" style={{ width: `${maxWatched}%` }} />
                  <div className="player-seekbar-fill" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
                </div>

                <div className="player-control-row">
                  <div className="player-control-group">
                    <button className="player-circle-button" type="button" onClick={togglePlay}>
                      <AppIcon name={playing ? 'pause' : 'play'} size={16} />
                    </button>
                    <button
                      className="player-circle-button"
                      type="button"
                      onClick={() => {
                        const nextVolume = volume === 0 ? 1 : 0;
                        setVolume(nextVolume);
                        if (isYoutubeLesson) {
                          if (nextVolume === 0) {
                            youtubePlayerRef.current?.mute?.();
                          } else {
                            youtubePlayerRef.current?.unMute?.();
                            youtubePlayerRef.current?.setVolume?.(Math.round(nextVolume * 100));
                          }
                        } else if (videoRef.current) {
                          videoRef.current.volume = nextVolume;
                        }
                      }}
                    >
                      <AppIcon name={volume === 0 ? 'mute' : 'volume'} size={16} />
                    </button>
                    <input
                      className="volume-range"
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={(event) => {
                        const nextVolume = parseFloat(event.target.value);
                        setVolume(nextVolume);
                        if (isYoutubeLesson) {
                          youtubePlayerRef.current?.setVolume?.(Math.round(nextVolume * 100));
                        } else if (videoRef.current) {
                          videoRef.current.volume = nextVolume;
                        }
                      }}
                      disabled={demoMode}
                    />
                    <span className="player-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
                  </div>
                  <div className="player-status-text">
                    {completed
                      ? 'Conteudo concluido'
                      : lessonControlsUnlocked
                        ? `Seek liberado por presenca ${aula?.controleVideo?.origem || 'confirmada'}`
                        : isYoutubeLesson
                          ? 'Sem presenca confirmada: pausa liberada e navegacao travada no player.'
                          : 'Sem presenca confirmada: somente pausa, sem pular'}
                </div>
              </div>
            </div>
            </div>

            <div className="lesson-meta-band">
              <div className="lesson-meta-card">
                <span className="section-kicker">Descricao</span>
                <p>{aula.descricao || 'Sem descricao cadastrada para esta aula.'}</p>
              </div>
              <div className="lesson-meta-card">
                <span className="section-kicker">Controle da aula</span>
                <p>
                  {lessonControlsUnlocked
                    ? 'Presenca em Meet ou Presencial confirmada. Voce pode avancar, voltar e concluir esta aula manualmente.'
                    : 'Sem presenca confirmada nesta aula. O video segue protegido e sem liberacao de pulo.'}
                </p>
                {lessonControlsUnlocked && !completed && (
                  <button className="btn btn-accent" type="button" onClick={handleManualComplete} disabled={completionLoading}>
                    <AppIcon name="check" size={14} />
                    <span>{completionLoading ? 'Concluindo...' : 'Marcar aula como concluida'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="tabs tabs-advanced">
              {tabs.map((tab) => (
                <button key={tab.key} className={`tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
                  <AppIcon name={tab.icon} size={14} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="panel-card lesson-content-panel">
              {activeTab === 'resumo' && <div className="rich-text-block"><h3>Resumo</h3><div style={{ whiteSpace: 'pre-wrap' }}>{aula.resumo || 'Resumo nao disponivel.'}</div></div>}
              {activeTab === 'transcricao' && <div className="rich-text-block"><h3>Transcricao</h3><div style={{ whiteSpace: 'pre-wrap' }}>{aula.transcricao || 'Transcricao nao disponivel.'}</div></div>}

              {activeTab === 'pontos' && (
                <div className="rich-list-block">
                  <h3>Pontos-chave</h3>
                  <div className="stack-list">
                    {pontosChave.map((ponto, index) => (
                      <article className="bullet-card" key={index}>
                        <div className="bullet-card-index">{index + 1}</div>
                        <p>{ponto}</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'versiculos' && (
                <div className="rich-list-block">
                  <h3>Versiculos</h3>
                  <div className="stack-list">
                    {versiculos.map((versiculo, index) => (
                      <article className="verse-card" key={index}>
                        <strong>{versiculo.referencia}</strong>
                        <p>{versiculo.texto}</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'glossario' && (
                <div className="rich-list-block">
                  <h3>Glossario</h3>
                  <div className="stack-list">
                    {glossario.map((item, index) => (
                      <article className="glossary-card" key={index}>
                        <strong>{item.termo}</strong>
                        <p>{item.definicao}</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'materiais' && (
                <div className="rich-list-block">
                  <h3>Materiais</h3>
                  {materiais.length === 0 ? (
                    <div className="empty-panel"><AppIcon name="folder" size={20} /><p>Nenhum material vinculado a esta aula.</p></div>
                  ) : (
                    <div className="stack-list">
                      {materiais.map((material: any) => (
                        <article className="resource-card" key={material.id}>
                          <div>
                            <strong>{material.titulo}</strong>
                            <p>{material.descricao}</p>
                          </div>
                          <div className="resource-actions">
                            <a className="btn btn-outline btn-sm" href={apiUrl(material.urlArquivo)} target="_blank" rel="noreferrer">
                              <AppIcon name="external" size={14} />
                              <span>Abrir</span>
                            </a>
                            {material.permiteDownload && (
                              <a className="btn btn-primary btn-sm" href={apiUrl(material.urlArquivo)} download>
                                <AppIcon name="download" size={14} />
                                <span>Download</span>
                              </a>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'notas' && (
                <div className="rich-list-block">
                  <h3>Minhas notas</h3>
                  <textarea className="form-textarea lesson-notes-field" value={notes} onChange={(event) => setNotes(event.target.value)} rows={9} />
                  <button className="btn btn-primary" type="button" onClick={saveNotes}>
                    <AppIcon name="notes" size={14} />
                    <span>Salvar anotacoes</span>
                  </button>
                </div>
              )}

              {activeTab === 'assistente' && (
                <div className="assistant-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="assistant-header">
                    <h3>Assistente da aula</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Tire suas duvidas baseadas na transcricao desta aula.</p>
                  </div>
                  
                  <div className="assistant-ask-box" style={{ padding: '1.5rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                    <textarea className="form-textarea" value={assistantQuestion} onChange={(event) => setAssistantQuestion(event.target.value)} rows={4} placeholder="Digite sua pergunta sobre esta aula." style={{ marginBottom: '1rem' }} />
                    <button className="btn btn-accent" type="button" onClick={handleAssistantAsk} disabled={assistantLoading}>
                      <AppIcon name="search" size={14} />
                      <span>{assistantLoading ? 'Consultando...' : 'Perguntar ao assistente'}</span>
                    </button>
                    {assistantError && <div className="inline-feedback warning" style={{ marginTop: '1rem' }}>{assistantError}</div>}
                  </div>
                  
                  <div className="assistant-thread" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {assistantMessages.length ? assistantMessages.map((message) => (
                      <article className="assistant-entry" key={message.id} style={{ padding: '1.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
                        <div className="assistant-question" style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                          <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-primary)' }}>Sua pergunta</strong>
                          <p>{message.pergunta}</p>
                        </div>
                        <div className="assistant-answer">
                          <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-accent)' }}>Resposta</strong>
                          <p style={{ whiteSpace: 'pre-wrap' }}>{message.resposta}</p>
                        </div>
                      </article>
                    )) : (
                      <div className="empty-panel" style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>
                          <AppIcon name="notes" size={24} />
                        </div>
                        <p>Voce ainda nao fez perguntas nesta aula.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'quiz' && (
                <div className="rich-list-block">
                  <h3>Questionario</h3>
                  {quizSubmitted && quizScore !== null && (
                    <div className={`inline-feedback ${quizScore >= 4 ? 'success' : quizScore >= 3 ? 'warning' : 'error'}`}>
                      Resultado: {quizScore}/{quizData.length} acertos
                    </div>
                  )}
                  {quizData.map((question: any, questionIndex: number) => (
                    <div className="quiz-question" key={questionIndex}>
                      <h4>{questionIndex + 1}. {question.pergunta}</h4>
                      {question.alternativas.map((alternativa: any, alternativaIndex: number) => {
                        let className = 'quiz-option';
                        if (quizAnswers[questionIndex] === alternativaIndex) className += ' selected';
                        if (quizSubmitted) {
                          if (alternativa.correta) className += ' correct';
                          else if (quizAnswers[questionIndex] === alternativaIndex) className += ' incorrect';
                        }
                        return (
                          <div key={alternativaIndex} className={className} onClick={() => !quizSubmitted && setQuizAnswers({ ...quizAnswers, [questionIndex]: alternativaIndex })}>
                            <div className="quiz-option-radio" />
                            <span>{alternativa.texto}</span>
                          </div>
                        );
                      })}
                      {quizSubmitted && question.explicacao && <div className="quiz-explanation">{question.explicacao}</div>}
                    </div>
                  ))}
                  {!quizSubmitted && quizData.length > 0 && (
                    <button className="btn btn-primary" type="button" onClick={handleSubmitQuiz} disabled={Object.keys(quizAnswers).length < quizData.length}>
                      <AppIcon name="quiz" size={14} />
                      <span>Enviar respostas</span>
                    </button>
                  )}
                  {quizSubmitted && (
                    <button className="btn btn-outline" type="button" onClick={() => {
                      setQuizSubmitted(false);
                      setQuizAnswers({});
                      setQuizScore(null);
                    }}>
                      <AppIcon name="arrow-left" size={14} />
                      <span>Refazer questionario</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          <aside className="lesson-playlist">
            <div className="playlist-header">
              <div>
                <span className="section-kicker">Trilha</span>
                <h3>{aula.modulo?.titulo}</h3>
              </div>
              <AppIcon name="library" size={18} />
            </div>
            <div className="search-field compact">
              <AppIcon name="search" size={16} />
              <input placeholder="Buscar conteudo" readOnly value="" />
            </div>
            <div className="playlist-items">
              {playlist.map((item: any, index: number) => {
                const progresso = item.progressos?.[0];
                const percentual = progresso?.percentualAssistido ? Math.round(progresso.percentualAssistido) : 0;
                const ativo = item.id === aula.id;
                return (
                  <button className={`playlist-item ${ativo ? 'active' : ''}`} key={item.id} type="button" onClick={() => navigate(`/aula/${item.id}`)}>
                    <div className="playlist-item-index">{index + 1}</div>
                    <div className="playlist-item-body">
                      <strong>{item.titulo}</strong>
                      <div className="playlist-item-meta">
                        <span>{percentual}%</span>
                        <div className="progress-bar">
                          <div className={`progress-bar-fill ${progresso?.concluido ? 'completed' : ''}`} style={{ width: `${percentual}%` }} />
                        </div>
                      </div>
                    </div>
                    <AppIcon name={progresso?.concluido ? 'check' : ativo ? 'play' : 'chevron-right'} size={16} />
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
