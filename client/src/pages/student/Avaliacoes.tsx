import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import AppIcon from '../../components/AppIcon';
import Sidebar from '../../components/Sidebar';
import { downloadAuthenticatedFile } from '../../lib/auth-file';
import { apiGet, apiFetch } from '../../lib/apiClient';
import { clearDraft, readDraft, writeDraft } from '../../lib/draft-storage';
import type { ObjectiveReviewItem, StudentObjectiveQuestion } from '../../lib/objective-assessment';

type Avaliacao = {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  formato: 'discursiva' | 'objetiva';
  dataLimite?: string | null;
  notaMaxima: number;
  permiteArquivo: boolean;
  permiteTexto: boolean;
  resultadoImediato: boolean;
  quantidadeQuestoes: number;
  tempoLimiteMinutos?: number | null;
  modulo?: { id: string; titulo: string } | null;
  aula?: {
    id: string;
    titulo: string;
    modulo?: { id: string; titulo: string } | null;
  } | null;
  questoesObjetivas?: StudentObjectiveQuestion[] | null;
  resultadoObjetivo?: {
    totalQuestoes: number;
    acertosObjetivos: number;
    percentualObjetivo: number;
    respostas: ObjectiveReviewItem[];
  } | null;
  entregaAtual?: {
    id: string;
    status: string;
    nota?: number | null;
    comentarioCorrecao?: string | null;
    arquivoUrl?: string | null;
    respostaTexto?: string | null;
    enviadoEm?: string | null;
    criadoEm?: string | null;
    totalQuestoes?: number | null;
    acertosObjetivos?: number | null;
    percentualObjetivo?: number | null;
  } | null;
};

function formatCountdown(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getObjectiveDraftKey(avaliacaoId: string) {
  return `objective-exam:${avaliacaoId}`;
}

function getObjectiveDurationSeconds(avaliacao: Avaliacao) {
  return (avaliacao.tempoLimiteMinutos ?? 90) * 60;
}

function isObjectiveInProgress(avaliacao: Avaliacao) {
  return avaliacao.formato === 'objetiva'
    && avaliacao.entregaAtual?.status === 'pendente'
    && !avaliacao.entregaAtual?.enviadoEm;
}

function getRemainingObjectiveSeconds(avaliacao: Avaliacao, nowMs = Date.now()) {
  if (!isObjectiveInProgress(avaliacao) || !avaliacao.entregaAtual?.criadoEm) {
    return null;
  }

  const expiresAt = new Date(avaliacao.entregaAtual.criadoEm).getTime() + (getObjectiveDurationSeconds(avaliacao) * 1000);
  return Math.max(Math.ceil((expiresAt - nowMs) / 1000), 0);
}

function buildObjectiveAnswers(avaliacao: Avaliacao) {
  if (avaliacao.resultadoObjetivo?.respostas?.length) {
    return avaliacao.resultadoObjetivo.respostas.map((item) => item.respostaAluno ?? null);
  }

  const draft = readDraft<Array<number | string | null>>(getObjectiveDraftKey(avaliacao.id));
  if (draft?.length === avaliacao.quantidadeQuestoes) {
    return draft;
  }

  return avaliacao.questoesObjetivas?.map(() => null) || [];
}

function hydrateAvaliacaoState(data: Avaliacao[]) {
  const respostasTexto = Object.fromEntries(
    data.map((item) => [item.id, item.entregaAtual?.respostaTexto || ''])
  );
  const respostasObjetivas = Object.fromEntries(
    data.map((item) => [item.id, buildObjectiveAnswers(item)])
  );
  const timerSeconds = Object.fromEntries(
    data
      .map((item) => [item.id, getRemainingObjectiveSeconds(item)] as const)
      .filter((entry): entry is [string, number] => entry[1] !== null)
  );

  data.forEach((item) => {
    if (!isObjectiveInProgress(item)) {
      clearDraft(getObjectiveDraftKey(item.id));
    }
  });

  return { respostasTexto, respostasObjetivas, timerSeconds };
}

export default function StudentAvaliacoes() {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [respostasTexto, setRespostasTexto] = useState<Record<string, string>>({});
  const [respostasObjetivas, setRespostasObjetivas] = useState<Record<string, Array<number | string | null>>>({});
  const [arquivos, setArquivos] = useState<Record<string, File | null>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [startingExamId, setStartingExamId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterModulo, setFilterModulo] = useState('todos');
  const [pageError, setPageError] = useState('');
  const [timerSeconds, setTimerSeconds] = useState<Record<string, number>>({});
  const countdownRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const avaliacoesRef = useRef<Avaliacao[]>([]);

  const loadData = useCallback(() => {
    setLoading(true);
    setPageError('');
    apiGet<Avaliacao[]>('/api/aluno/avaliacoes')
      .then((data) => {
        const hydrated = hydrateAvaliacaoState(data);
        setAvaliacoes(data);
        setRespostasTexto(hydrated.respostasTexto);
        setRespostasObjetivas(hydrated.respostasObjetivas);
        setTimerSeconds(hydrated.timerSeconds);
      })
      .catch(() => setPageError('Não foi possível carregar as avaliações agora.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    avaliacoesRef.current = avaliacoes;
  }, [avaliacoes]);

  useEffect(() => {
    avaliacoes.forEach((avaliacao) => {
      if (isObjectiveInProgress(avaliacao)) {
        writeDraft(getObjectiveDraftKey(avaliacao.id), respostasObjetivas[avaliacao.id] || []);
      }
    });
  }, [avaliacoes, respostasObjetivas]);

  useEffect(() => {
    const tick = () => {
      const nextTimers: Record<string, number> = {};
      const expiredIds: string[] = [];

      avaliacoesRef.current.forEach((avaliacao) => {
        const remaining = getRemainingObjectiveSeconds(avaliacao);
        if (remaining === null) {
          return;
        }

        nextTimers[avaliacao.id] = remaining;
        if (remaining === 0) {
          expiredIds.push(avaliacao.id);
        }
      });

      setTimerSeconds(nextTimers);
      if (expiredIds.length) {
        setFeedback((current) => {
          const next = { ...current };
          expiredIds.forEach((id) => {
            if (!next[id]) {
              next[id] = 'O tempo desta prova expirou. O envio foi bloqueado.';
            }
          });
          return next;
        });
      }
    };

    const hasRunningExam = avaliacoes.some((avaliacao) => isObjectiveInProgress(avaliacao));
    if (!hasRunningExam) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    tick();
    countdownRef.current = window.setInterval(tick, 1000);
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [avaliacoes]);

  const handleStartObjectiveExam = useCallback(async (avaliacao: Avaliacao) => {
    if (avaliacao.formato !== 'objetiva') {
      return;
    }

    setStartingExamId(avaliacao.id);
    setFeedback((current) => ({ ...current, [avaliacao.id]: '' }));

    try {
      const response = await apiFetch(`/api/aluno/avaliacao/${avaliacao.id}/iniciar`, {
        method: 'POST'
      });
      const data = await response.json();

      if (!response.ok) {
        setFeedback((current) => ({ ...current, [avaliacao.id]: data.error || 'Não foi possível iniciar a prova.' }));
        return;
      }

      setAvaliacoes((current) => current.map((item) => (
        item.id === avaliacao.id
          ? { ...item, entregaAtual: data.entregaAtual }
          : item
      )));
      setTimerSeconds((current) => ({ ...current, [avaliacao.id]: data.remainingSeconds }));
      setRespostasObjetivas((current) => {
        if (current[avaliacao.id]?.length) {
          return current;
        }

        const draft = readDraft<Array<number | string | null>>(getObjectiveDraftKey(avaliacao.id));
        return {
          ...current,
          [avaliacao.id]: draft?.length === avaliacao.quantidadeQuestoes
            ? draft
            : Array.from({ length: avaliacao.quantidadeQuestoes }, () => null)
        };
      });

      if (data.expirou) {
        setFeedback((current) => ({ ...current, [avaliacao.id]: 'O tempo desta prova ja expirou.' }));
      }
    } catch {
      setFeedback((current) => ({ ...current, [avaliacao.id]: 'Erro ao comunicar com o servidor.' }));
    } finally {
      setStartingExamId(null);
    }
  }, []);

  const handleSubmit = useCallback(async (avaliacao: Avaliacao, event?: FormEvent) => {
    if (event) event.preventDefault();

    if (avaliacao.formato === 'objetiva') {
      if (!isObjectiveInProgress(avaliacao)) {
        setFeedback((current) => ({ ...current, [avaliacao.id]: 'Inicie a prova antes de enviar as respostas.' }));
        return;
      }

      const remaining = getRemainingObjectiveSeconds(avaliacao);
      if (remaining !== null && remaining <= 0) {
        setFeedback((current) => ({ ...current, [avaliacao.id]: 'O tempo desta prova expirou. O envio foi bloqueado.' }));
        return;
      }
    }

    setSubmittingId(avaliacao.id);
    setFeedback((current) => ({ ...current, [avaliacao.id]: '' }));

    const formData = new FormData();
    if (avaliacao.formato === 'objetiva') {
      formData.append('respostasObjetivas', JSON.stringify(respostasObjetivas[avaliacao.id] || []));
    } else {
      const texto = respostasTexto[avaliacao.id]?.trim();
      if (texto) formData.append('respostaTexto', texto);
      const arquivo = arquivos[avaliacao.id];
      if (arquivo) formData.append('arquivo', arquivo);
    }

    const submitController = new AbortController();
    const submitTimeout = setTimeout(() => submitController.abort(), 30000);

    try {
      const response = await apiFetch(`/api/aluno/avaliacao/${avaliacao.id}/entrega`, {
        method: 'POST',
        body: formData,
        signal: submitController.signal
      });
      clearTimeout(submitTimeout);
      const data = await response.json();

      if (!response.ok) {
        setFeedback((current) => ({ ...current, [avaliacao.id]: data.error || 'Não foi possível enviar a atividade.' }));
        return;
      }

      clearDraft(getObjectiveDraftKey(avaliacao.id));
      setTimerSeconds((current) => {
        const next = { ...current };
        delete next[avaliacao.id];
        return next;
      });
      setFeedback((current) => ({ ...current, [avaliacao.id]: 'Entrega enviada com sucesso.' }));
      setArquivos((current) => ({ ...current, [avaliacao.id]: null }));
      loadData();
    } catch (err) {
      clearTimeout(submitTimeout);
      if (err instanceof Error && err.name === 'AbortError') {
        setFeedback((current) => ({ ...current, [avaliacao.id]: 'Tempo esgotado ao enviar a atividade. Tente novamente.' }));
      } else {
        setFeedback((current) => ({ ...current, [avaliacao.id]: 'Erro ao comunicar com o servidor.' }));
      }
    } finally {
      setSubmittingId(null);
    }
  }, [arquivos, loadData, respostasObjetivas, respostasTexto]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  const resumo = useMemo(() => {
    const total = avaliacoes.length;
    const entregues = avaliacoes.filter((item) => item.entregaAtual?.status === 'enviado' || item.entregaAtual?.status === 'corrigido').length;
    const corrigidas = avaliacoes.filter((item) => item.entregaAtual?.status === 'corrigido').length;
    const notas = avaliacoes
      .map((item) => item.entregaAtual?.nota)
      .filter((nota): nota is number => typeof nota === 'number');

    return {
      total,
      entregues,
      corrigidas,
      media: notas.length ? (Math.round((notas.reduce((sum, nota) => sum + nota, 0) / notas.length) * 10) / 10).toFixed(1) : 'N/A'
    };
  }, [avaliacoes]);

  const filteredAvaliacoes = useMemo(() => {
    return avaliacoes.filter((avaliacao) => {
      const currentStatus = avaliacao.entregaAtual?.status || 'pendente';
      const matchesSearch = !search.trim() || `${avaliacao.titulo} ${avaliacao.descricao || ''}`.toLowerCase().includes(search.trim().toLowerCase());
      const matchesTipo = filterTipo === 'todos' || avaliacao.tipo === filterTipo;
      const matchesStatus = filterStatus === 'todos' || currentStatus === filterStatus;
      const moduloAvaliacaoId = avaliacao.modulo?.id || avaliacao.aula?.modulo?.id || null;
      const matchesModulo = filterModulo === 'todos'
        || (filterModulo === 'sem-modulo' ? !moduloAvaliacaoId : moduloAvaliacaoId === filterModulo);
      return matchesSearch && matchesTipo && matchesStatus && matchesModulo;
    });
  }, [avaliacoes, filterModulo, filterStatus, filterTipo, search]);

  const modulosDisponiveis = useMemo(
    () =>
      Array.from(
        new Map(
          avaliacoes
            .flatMap((avaliacao) => [avaliacao.modulo, avaliacao.aula?.modulo])
            .filter((modulo): modulo is { id: string; titulo: string } => Boolean(modulo))
            .map((modulo) => [modulo.id, modulo] as const)
        ).values()
      ),
    [avaliacoes]
  );

  return (
    <div className="layout student-layout">
      <Sidebar type="student" />
      <main className="main-content student-main">
        {pageError && <div className="inline-feedback warning">{pageError}</div>}
        <section className="student-topbar">
          <div>
            <span className="section-kicker">Fase 3</span>
            <h1 className="student-page-title">Avaliações e trabalhos</h1>
            <p className="student-page-subtitle">
              Envie atividades, faça provas objetivas na plataforma e acompanhe correção, nota e comentários.
            </p>
          </div>
        </section>

        <section className="student-stats-grid">
          <article className="student-stat-tile">
            <div className="student-stat-icon"><AppIcon name="quiz" size={18} /></div>
            <div><strong>{resumo.total}</strong><span>Avaliações publicadas</span></div>
          </article>
          <article className="student-stat-tile">
            <div className="student-stat-icon"><AppIcon name="check" size={18} /></div>
            <div><strong>{resumo.entregues}</strong><span>Entregas realizadas</span></div>
          </article>
          <article className="student-stat-tile">
            <div className="student-stat-icon"><AppIcon name="target" size={18} /></div>
            <div><strong>{resumo.media}</strong><span>Média das notas</span></div>
          </article>
        </section>

        <section className="student-section">
          <div className="student-section-header">
            <div>
              <span className="section-kicker">Painel acadêmico</span>
              <h2>Provas e trabalhos</h2>
            </div>
          </div>

          <div className="content-panel-toolbar admin-toolbar-compact mb-3">
            <div className="search-field">
              <AppIcon name="search" size={16} />
              <input aria-label="Buscar avaliação" placeholder="Buscar avaliação" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="page-header-actions">
              <select aria-label="Filtrar módulo de avaliação" className="filter-select" value={filterModulo} onChange={(event) => setFilterModulo(event.target.value)}>
                <option value="todos">Todos os módulos</option>
                <option value="sem-modulo">Sem módulo</option>
                {modulosDisponiveis.map((modulo) => (
                  <option key={modulo.id} value={modulo.id}>
                    {modulo.titulo}
                  </option>
                ))}
              </select>
              <select aria-label="Filtrar tipo de avaliação" className="filter-select" value={filterTipo} onChange={(event) => setFilterTipo(event.target.value)}>
                <option value="todos">Todos os tipos</option>
                <option value="trabalho">Trabalhos</option>
                <option value="prova">Provas</option>
              </select>
              <select aria-label="Filtrar status de avaliação" className="filter-select" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                <option value="todos">Todos os status</option>
                <option value="pendente">Pendentes</option>
                <option value="enviado">Enviadas</option>
                <option value="corrigido">Corrigidas</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="card-grid">
              {[1, 2, 3].map((item) => <div className="skeleton skeleton-card" key={item} />)}
            </div>
          ) : (
            <div className="assessment-grid">
              {filteredAvaliacoes.map((avaliacao) => {
                const status = avaliacao.entregaAtual?.status || 'pendente';
                const prazo = avaliacao.dataLimite ? new Date(avaliacao.dataLimite).toLocaleDateString('pt-BR') : 'Sem prazo definido';
                const prazoEncerrado = Boolean(avaliacao.dataLimite && new Date(avaliacao.dataLimite).getTime() < Date.now());
                const isExpanded = expandedId === avaliacao.id;
                const jaEnviouObjetiva = avaliacao.formato === 'objetiva' && Boolean(avaliacao.entregaAtual?.enviadoEm);
                const mostrarResultadoObjetivo = avaliacao.formato !== 'objetiva' || avaliacao.resultadoImediato;
                const provaEmAndamento = isObjectiveInProgress(avaliacao);
                const discursivaBloqueada = avaliacao.formato === 'discursiva' && (status === 'corrigido' || prazoEncerrado);
                const remaining = timerSeconds[avaliacao.id] ?? getRemainingObjectiveSeconds(avaliacao);
                const timerRunning = provaEmAndamento && remaining !== null && remaining > 0;
                const timerExpired = provaEmAndamento && remaining === 0;
                const timerWarning = timerRunning && remaining <= 300; // last 5 min
                const timerCritical = timerRunning && remaining <= 60; // last 1 min

                return (
                  <article className="assessment-card" key={avaliacao.id}>
                    <div className="assessment-card-head">
                      <div>
                        <div className="assessment-badge-row">
                          <span className={`badge ${avaliacao.tipo === 'prova' ? 'badge-warning' : 'badge-info'}`}>{avaliacao.tipo}</span>
                          <span className={`badge ${avaliacao.formato === 'objetiva' ? 'badge-purple' : 'badge-info'}`}>{avaliacao.formato}</span>
                        </div>
                        <h3>{avaliacao.titulo}</h3>
                        <p>{avaliacao.descricao || 'Sem descrição cadastrada.'}</p>
                      </div>
                      <span className={`badge ${status === 'corrigido' ? 'badge-success' : status === 'enviado' ? 'badge-warning' : 'badge-error'}`}>
                        {status}
                      </span>
                    </div>

                    <div className="assessment-meta">
                      <span><strong>Módulo:</strong> {avaliacao.modulo?.titulo || avaliacao.aula?.modulo?.titulo || 'Livre'}</span>
                      <span><strong>Aula:</strong> {avaliacao.aula?.titulo || 'Não vinculada'}</span>
                      <span><strong>Prazo:</strong> {prazo}</span>
                      <span><strong>Nota máxima:</strong> {avaliacao.notaMaxima}</span>
                      {avaliacao.formato === 'objetiva' && (
                        <>
                          <span><strong>Questões:</strong> {avaliacao.quantidadeQuestoes}</span>
                          <span><strong>Tempo:</strong> {avaliacao.tempoLimiteMinutos ? `${avaliacao.tempoLimiteMinutos} min` : '90 min'}</span>
                        </>
                      )}
                    </div>

                    {avaliacao.entregaAtual && avaliacao.entregaAtual.status !== 'pendente' && (
                      <div className="assessment-result-box">
                        <div>
                          <strong>Situação da entrega</strong>
                          <p>
                            {avaliacao.entregaAtual.enviadoEm
                              ? `Enviado em ${new Date(avaliacao.entregaAtual.enviadoEm).toLocaleString('pt-BR')}`
                              : 'Entrega ainda não enviada.'}
                          </p>
                        </div>
                        {mostrarResultadoObjetivo ? (
                          <div className="assessment-result-grid">
                            <div>
                              <span>Nota</span>
                              <strong>{typeof avaliacao.entregaAtual.nota === 'number' ? avaliacao.entregaAtual.nota : 'Pendente'}</strong>
                            </div>
                            <div>
                              <span>Comentário</span>
                              <strong>{avaliacao.entregaAtual.comentarioCorrecao || 'Aguardando correção'}</strong>
                            </div>
                            {avaliacao.formato === 'objetiva' && (
                              <div>
                                <span>Acertos</span>
                                <strong>{avaliacao.entregaAtual.acertosObjetivos ?? 0}/{avaliacao.entregaAtual.totalQuestoes ?? avaliacao.quantidadeQuestoes}</strong>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p>Prova enviada com sucesso. O resultado detalhado será liberado pela equipe acadêmica.</p>
                        )}
                        {avaliacao.entregaAtual.arquivoUrl && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              void downloadAuthenticatedFile(`/api/aluno/entrega-avaliacao/${avaliacao.entregaAtual?.id}/arquivo`).catch((error) => {
                                setFeedback((current) => ({
                                  ...current,
                                  [avaliacao.id]: error instanceof Error ? error.message : 'Não foi possível baixar o arquivo.'
                                }));
                              });
                            }}
                            type="button"
                          >
                            <AppIcon name="external" size={14} />
                            <span>Ver arquivo enviado</span>
                          </button>
                        )}

                        {mostrarResultadoObjetivo && avaliacao.resultadoObjetivo?.respostas?.length ? (
                          <div className="assessment-review-list">
                            {avaliacao.resultadoObjetivo.respostas.map((item, reviewIndex) => (
                              <article className="assessment-review-item" key={item.id}>
                                <h4>{reviewIndex + 1}. {item.enunciado}</h4>
                                {item.tipo === 'dissertativa' ? (
                                  <div className="dissertativa-answer-block">
                                    <p className="form-label" style={{ marginBottom: '0.25rem' }}>Sua resposta:</p>
                                    <p style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                                      {item.respostaTextoAluno || <em style={{ opacity: 0.5 }}>Sem resposta</em>}
                                    </p>
                                    {item.explicacao && <p className="assessment-answer-explanation">{item.explicacao}</p>}
                                    <p className="inline-feedback neutral" style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>
                                      Esta questão será corrigida manualmente pelo professor.
                                    </p>
                                  </div>
                                ) : (
                                  <>
                                    <ul className="assessment-option-list">
                                      {(item.opcoes ?? []).map((opcao, optionIndex) => {
                                        const isCorrect = optionIndex === item.respostaCorreta;
                                        const isSelected = optionIndex === item.respostaAluno;
                                        return (
                                          <li
                                            className={`${isCorrect ? 'correct' : ''} ${isSelected && !item.correta && !isCorrect ? 'selected-wrong' : ''}`}
                                            key={`${item.id}-${optionIndex}`}
                                          >
                                            <span>{String.fromCharCode(65 + optionIndex)}</span>
                                            <p>{opcao}</p>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                    {item.explicacao && <p className="assessment-answer-explanation">{item.explicacao}</p>}
                                  </>
                                )}
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {provaEmAndamento && (
                      <div className="inline-feedback warning" style={{ marginTop: '0.85rem' }}>
                        {timerExpired
                          ? 'A prova foi iniciada, mas o tempo expirou. O envio esta bloqueado.'
                          : `Prova iniciada em ${avaliacao.entregaAtual?.criadoEm ? new Date(avaliacao.entregaAtual.criadoEm).toLocaleString('pt-BR') : 'agora'}. O cronometro continua mesmo se voce fechar este card ou recarregar a pagina.`}
                      </div>
                    )}

                    <div className="assessment-card-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => setExpandedId(isExpanded ? null : avaliacao.id)} type="button">
                        {isExpanded
                          ? 'Fechar'
                          : jaEnviouObjetiva
                            ? (mostrarResultadoObjetivo ? 'Ver prova' : 'Ver envio')
                            : avaliacao.formato === 'objetiva'
                              ? (provaEmAndamento ? 'Continuar prova' : 'Abrir prova')
                              : 'Enviar atividade'}
                      </button>
                    </div>

                    {isExpanded && (
                      <form className="assessment-form" onSubmit={(event) => void handleSubmit(avaliacao, event)}>
                        {/* Timer for objective exams */}
                        {avaliacao.formato === 'objetiva' && !jaEnviouObjetiva && timerRunning && (
                          <div className={`exam-timer-banner ${timerCritical ? 'critical' : timerWarning ? 'warning' : ''}`}>
                            <AppIcon name="clock" size={16} />
                            <span>Tempo restante: <strong>{formatCountdown(remaining ?? 0)}</strong></span>
                            {timerCritical && <span className="exam-timer-alert">Finalize agora!</span>}
                          </div>
                        )}

                        {avaliacao.formato === 'objetiva' && !jaEnviouObjetiva && !provaEmAndamento && (
                          <div className="inline-feedback warning">
                            <div style={{ marginBottom: '0.75rem' }}>
                              Ao iniciar a prova, o cronometro comeca imediatamente e fica vinculado a sua conta ate o envio ou o fim do tempo.
                            </div>
                            <button
                              className="btn btn-primary"
                              disabled={startingExamId === avaliacao.id}
                              onClick={() => void handleStartObjectiveExam(avaliacao)}
                              type="button"
                            >
                              {startingExamId === avaliacao.id ? 'Iniciando...' : 'Iniciar prova'}
                            </button>
                          </div>
                        )}

                        {avaliacao.formato === 'objetiva' && !jaEnviouObjetiva && provaEmAndamento && (
                          <div className="assessment-review-list">
                            {avaliacao.questoesObjetivas?.map((questao, questionIndex) => {
                              const tipo = questao.tipo ?? 'objetiva';
                              return (
                                <article className="assessment-review-item" key={questao.id}>
                                  <h4>{questionIndex + 1}. {questao.enunciado}</h4>
                                  {tipo === 'dissertativa' ? (
                                    <textarea
                                      className="form-textarea"
                                      rows={4}
                                      placeholder="Digite sua resposta aqui..."
                                      value={typeof respostasObjetivas[avaliacao.id]?.[questionIndex] === 'string'
                                        ? respostasObjetivas[avaliacao.id][questionIndex] as string
                                        : ''}
                                      onChange={(event) => setRespostasObjetivas((current) => {
                                        const currentAnswers = current[avaliacao.id]?.length
                                          ? [...current[avaliacao.id]]
                                          : Array.from({ length: avaliacao.quantidadeQuestoes }, () => null);
                                        currentAnswers[questionIndex] = event.target.value;
                                        return { ...current, [avaliacao.id]: currentAnswers };
                                      })}
                                    />
                                  ) : (
                                    <ul className="assessment-option-list selectable">
                                      {(questao.opcoes ?? []).map((opcao, optionIndex) => {
                                        const checked = respostasObjetivas[avaliacao.id]?.[questionIndex] === optionIndex;
                                        return (
                                          <li className={checked ? 'selected' : ''} key={`${questao.id}-${optionIndex}`}>
                                            <label className="assessment-option-choice">
                                              <input
                                                checked={checked}
                                                name={`${avaliacao.id}-${questao.id}`}
                                                onChange={() => setRespostasObjetivas((current) => {
                                                  const currentAnswers = current[avaliacao.id]?.length
                                                    ? [...current[avaliacao.id]]
                                                    : Array.from({ length: avaliacao.quantidadeQuestoes }, () => null);
                                                  currentAnswers[questionIndex] = optionIndex;
                                                  return { ...current, [avaliacao.id]: currentAnswers };
                                                })}
                                                type="radio"
                                              />
                                              <span>{String.fromCharCode(65 + optionIndex)}</span>
                                              <p>{opcao}</p>
                                            </label>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </article>
                              );
                            })}
                          </div>
                        )}

                        {avaliacao.formato === 'discursiva' && avaliacao.permiteTexto && (
                          <div className="form-group">
                            <label className="form-label">Resposta em texto</label>
                            <textarea
                              className="form-textarea"
                              disabled={discursivaBloqueada}
                              rows={6}
                              value={respostasTexto[avaliacao.id] || ''}
                              onChange={(event) => setRespostasTexto((current) => ({ ...current, [avaliacao.id]: event.target.value }))}
                            />
                          </div>
                        )}

                        {avaliacao.formato === 'discursiva' && avaliacao.permiteArquivo && (
                          <div className="form-group">
                            <label className="form-label">Arquivo da entrega (PDF, DOC, imagem ou vídeo até 1 GB)</label>
                            <input
                              accept=".pdf,.doc,.docx,.odt,.jpg,.jpeg,.png,.zip,.mp4,.mov,.avi,.mkv,.webm"
                              className="form-input file-input"
                              disabled={discursivaBloqueada}
                              onChange={(event) => setArquivos((current) => ({ ...current, [avaliacao.id]: event.target.files?.[0] || null }))}
                              type="file"
                            />
                            {arquivos[avaliacao.id] && (
                              <p className="form-helper-text">{arquivos[avaliacao.id]?.name}</p>
                            )}
                          </div>
                        )}

                        {feedback[avaliacao.id] && (
                          <div className={`inline-feedback ${feedback[avaliacao.id].includes('sucesso') ? 'success' : 'warning'}`}>
                            {feedback[avaliacao.id]}
                          </div>
                        )}

                        {discursivaBloqueada && (
                          <div className="inline-feedback warning">
                            {status === 'corrigido' ? 'Esta entrega já foi corrigida e não pode mais ser alterada.' : 'O prazo desta avaliação foi encerrado.'}
                          </div>
                        )}

                        {(!jaEnviouObjetiva && avaliacao.formato === 'discursiva' && !discursivaBloqueada) || (avaliacao.formato === 'objetiva' && provaEmAndamento && !timerExpired) ? (
                          <button className="btn btn-primary" disabled={submittingId === avaliacao.id} type="submit">
                            {submittingId === avaliacao.id ? 'Enviando...' : avaliacao.formato === 'objetiva' ? 'Finalizar prova' : 'Salvar entrega'}
                          </button>
                        ) : null}
                      </form>
                    )}
                  </article>
                );
              })}

              {!filteredAvaliacoes.length && (
                <div className="empty-panel">
                  <AppIcon name="quiz" size={20} />
                  <p>{avaliacoes.length ? 'Nenhuma avaliação corresponde aos filtros atuais.' : 'Nenhuma avaliação publicada ainda.'}</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
