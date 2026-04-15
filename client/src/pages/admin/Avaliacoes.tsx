import { FormEvent, useEffect, useMemo, useState } from 'react';

import AppIcon from '../../components/AppIcon';
import { downloadAuthenticatedFile } from '../../lib/auth-file';
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/apiClient';
import {
  buildObjectiveReview,
  createEmptyDissertativeQuestion,
  createEmptyObjectiveQuestion,
  ObjectiveQuestion,
  parseStoredObjectiveAnswers
} from '../../lib/objective-assessment';

type Avaliacao = {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  formato: 'discursiva' | 'objetiva';
  dataLimite?: string | null;
  notaMaxima: number;
  publicado: boolean;
  permiteArquivo: boolean;
  permiteTexto: boolean;
  resultadoImediato: boolean;
  tempoLimiteMinutos?: number | null;
  quantidadeQuestoes: number;
  questoesObjetivas?: ObjectiveQuestion[] | null;
  modulo?: { id: string; titulo: string } | null;
  aula?: {
    id: string;
    titulo: string;
    modulo?: { id: string; titulo: string } | null;
  } | null;
  resumoEntregas?: {
    totalAtividades: number;
    entregues: number;
    pendentes: number;
    corrigidas: number;
    mediaNotas: number | null;
  };
};

type Entrega = {
  id: string;
  status: string;
  nota?: number | null;
  comentarioCorrecao?: string | null;
  respostaTexto?: string | null;
  arquivoUrl?: string | null;
  respostasObjetivas?: string | null;
  enviadoEm?: string | null;
  totalQuestoes?: number | null;
  acertosObjetivos?: number | null;
  percentualObjetivo?: number | null;
  aluno: {
    id: string;
    nome: string;
    email: string;
  };
};

type DetailedAvaliacao = Avaliacao & {
  entregas: Entrega[];
};

type AvaliacaoListResponse = Avaliacao[] | {
  data?: Avaliacao[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

function buildInitialQuestions() {
  return [createEmptyObjectiveQuestion(0)];
}

export default function AdminAvaliacoes() {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [modulos, setModulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAvaliacao, setSelectedAvaliacao] = useState<DetailedAvaliacao | null>(null);
  const [feedback, setFeedback] = useState('');
  const [savingCorrectionId, setSavingCorrectionId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterModulo, setFilterModulo] = useState('todos');
  const [pageError, setPageError] = useState('');

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('trabalho');
  const [formato, setFormato] = useState<'discursiva' | 'objetiva'>('discursiva');
  const [moduloId, setModuloId] = useState('');
  const [aulaId, setAulaId] = useState('');
  const [dataLimite, setDataLimite] = useState('');
  const [notaMaxima, setNotaMaxima] = useState('10');
  const [publicado, setPublicado] = useState(true);
  const [permiteArquivo, setPermiteArquivo] = useState(true);
  const [permiteTexto, setPermiteTexto] = useState(false);
  const [resultadoImediato, setResultadoImediato] = useState(true);
  const [tempoLimiteMinutos, setTempoLimiteMinutos] = useState('');
  const [questoesObjetivas, setQuestoesObjetivas] = useState<ObjectiveQuestion[]>(buildInitialQuestions());

  const [correcoes, setCorrecoes] = useState<Record<string, { nota: string; comentarioCorrecao: string; status: string }>>({});
  // Per-question manual grading: entregaId -> questaoId -> 'correta' | 'meio-certa' | 'errada' | null
  const [questaoStatus, setQuestaoStatus] = useState<Record<string, Record<string, 'correta' | 'meio-certa' | 'errada'>>>({});

  const loadData = () => {
    setLoading(true);
    setPageError('');
    Promise.all([
      apiGet<AvaliacaoListResponse>('/api/admin/avaliacoes'),
      apiGet<any[]>('/api/admin/aulas')
    ])
      .then(([avaliacoesData, modulosData]) => {
        const listaAvaliacoes = Array.isArray(avaliacoesData)
          ? avaliacoesData
          : Array.isArray(avaliacoesData?.data)
            ? avaliacoesData.data
            : [];

        setAvaliacoes(listaAvaliacoes);
        setModulos(Array.isArray(modulosData) ? modulosData : []);
      })
      .catch(() => setPageError('Não foi possível carregar as avaliações agora.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const aulasDisponiveis = useMemo(() => {
    return modulos.flatMap((modulo: any) => modulo.aulas?.map((aula: any) => ({
      ...aula,
      moduloId: modulo.id,
      moduloTitulo: modulo.titulo
    })) || []);
  }, [modulos]);
  const aulasFiltradas = useMemo(() => (
    moduloId
      ? aulasDisponiveis.filter((aula: any) => aula.moduloId === moduloId)
      : aulasDisponiveis
  ), [aulasDisponiveis, moduloId]);

  const moduloPorAulaId = useMemo(() => (
    new Map(aulasDisponiveis.map((aula: any) => [aula.id, { id: aula.moduloId, titulo: aula.moduloTitulo }]))
  ), [aulasDisponiveis]);

  const getAvaliacaoModulo = (avaliacao: Avaliacao): { id: string; titulo: string } | null => {
    if (avaliacao.modulo?.id) {
      return { id: avaliacao.modulo.id, titulo: avaliacao.modulo.titulo };
    }
    if (avaliacao.aula?.modulo?.id) {
      return { id: avaliacao.aula.modulo.id, titulo: avaliacao.aula.modulo.titulo };
    }
    if (avaliacao.aula?.id) {
      return moduloPorAulaId.get(avaliacao.aula.id) || null;
    }
    return null;
  };

  const filteredAvaliacoes = useMemo(() => {
    return avaliacoes.filter((avaliacao) => {
      const matchesSearch = !search.trim() || `${avaliacao.titulo} ${avaliacao.descricao || ''}`.toLowerCase().includes(search.trim().toLowerCase());
      const matchesTipo = filterTipo === 'todos' || avaliacao.tipo === filterTipo;
      const matchesStatus = filterStatus === 'todos' || (filterStatus === 'publicado' ? avaliacao.publicado : !avaliacao.publicado);
      const moduloAvaliacao = getAvaliacaoModulo(avaliacao);
      const matchesModulo = filterModulo === 'todos'
        || (filterModulo === 'sem-modulo' ? !moduloAvaliacao?.id : moduloAvaliacao?.id === filterModulo);
      return matchesSearch && matchesTipo && matchesStatus && matchesModulo;
    });
  }, [avaliacoes, filterModulo, filterStatus, filterTipo, search]);

  const resetForm = () => {
    setEditingId(null);
    setTitulo('');
    setDescricao('');
    setTipo('trabalho');
    setFormato('discursiva');
    setModuloId('');
    setAulaId('');
    setDataLimite('');
    setNotaMaxima('10');
    setPublicado(true);
    setPermiteArquivo(true);
    setPermiteTexto(false);
    setResultadoImediato(true);
    setTempoLimiteMinutos('');
    setQuestoesObjetivas(buildInitialQuestions());
  };

  const fetchAvaliacaoDetail = (avaliacaoId: string) =>
    apiGet<DetailedAvaliacao>(`/api/admin/avaliacao/${avaliacaoId}`);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback('');

    try {
      const payload = {
        titulo, descricao, tipo, formato,
        moduloId: moduloId || null, aulaId: aulaId || null,
        dataLimite: dataLimite || null, notaMaxima, publicado,
        permiteArquivo, permiteTexto, resultadoImediato,
        tempoLimiteMinutos: tempoLimiteMinutos || null,
        questoesObjetivas: formato === 'objetiva' ? questoesObjetivas : []
      };
      if (editingId) {
        await apiPut(`/api/admin/avaliacao/${editingId}`, payload);
      } else {
        await apiPost('/api/admin/avaliacao', payload);
      }

      resetForm();
      setShowForm(false);
      loadData();
      setFeedback(editingId ? 'Avaliação atualizada com sucesso.' : 'Avaliação criada com sucesso.');
    } catch {
      setFeedback('Erro ao comunicar com o servidor.');
    }
  };

  const handleEdit = async (avaliacao: Avaliacao) => {
    try {
      const detail = await fetchAvaliacaoDetail(avaliacao.id);
      setEditingId(detail.id);
      setTitulo(detail.titulo);
      setDescricao(detail.descricao || '');
      setTipo(detail.tipo);
      setFormato(detail.formato);
      setModuloId(detail.modulo?.id || detail.aula?.modulo?.id || '');
      setAulaId(detail.aula?.id || '');
      setDataLimite(detail.dataLimite ? new Date(detail.dataLimite).toISOString().slice(0, 16) : '');
      setNotaMaxima(String(detail.notaMaxima));
      setPublicado(detail.publicado);
      setPermiteArquivo(detail.permiteArquivo);
      setPermiteTexto(detail.permiteTexto);
      setResultadoImediato(detail.resultadoImediato);
      setTempoLimiteMinutos(detail.tempoLimiteMinutos ? String(detail.tempoLimiteMinutos) : '');
      setQuestoesObjetivas(detail.questoesObjetivas?.length ? detail.questoesObjetivas : buildInitialQuestions());
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível carregar a avaliação para edição.');
    }
  };

  const handleDelete = async (avaliacaoId: string) => {
    if (!window.confirm('Deseja realmente excluir esta avaliação e todas as entregas ligadas a ela?')) {
      return;
    }

    setFeedback('');
    try {
      await apiDelete(`/api/admin/avaliacao/${avaliacaoId}`);

      if (selectedId === avaliacaoId) {
        setSelectedId(null);
        setSelectedAvaliacao(null);
      }

      if (editingId === avaliacaoId) {
        resetForm();
        setShowForm(false);
      }

      setFeedback('Avaliação excluída com sucesso.');
      loadData();
    } catch {
      setFeedback('Erro ao excluir a avaliação.');
    }
  };

  const loadAvaliacao = async (avaliacaoId: string) => {
    setSelectedId(avaliacaoId);

    try {
      const data = await fetchAvaliacaoDetail(avaliacaoId);
      setSelectedAvaliacao(data);
      setCorrecoes(Object.fromEntries(
        (data.entregas || []).map((entrega: Entrega) => [
          entrega.id,
          {
            nota: typeof entrega.nota === 'number' ? String(entrega.nota) : '',
            comentarioCorrecao: entrega.comentarioCorrecao || '',
            status: 'corrigido'
          }
        ])
      ));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível carregar as entregas.');
    }
  };

  const handleQuestaoStatus = (
    entregaId: string,
    questaoId: string,
    status: 'correta' | 'meio-certa' | 'errada',
    allItems: ReturnType<typeof buildObjectiveReview>,
    notaMaxima: number
  ) => {
    const next = {
      ...questaoStatus,
      [entregaId]: { ...(questaoStatus[entregaId] ?? {}), [questaoId]: status }
    };
    setQuestaoStatus(next);

    // Auto-compute nota from all graded questions
    const entregaStatuses = next[entregaId] ?? {};
    const valorPorQuestao = notaMaxima / allItems.length;
    let total = 0;
    for (const item of allItems) {
      const s = item.tipo === 'objetiva' ? (item.correta ? 'correta' : 'errada') : (entregaStatuses[item.id] ?? null);
      if (s === 'correta') total += valorPorQuestao;
      else if (s === 'meio-certa') total += valorPorQuestao * 0.5;
    }
    // Only auto-fill if all dissertativa questions have been graded
    const dissertativas = allItems.filter(i => i.tipo === 'dissertativa');
    const allGraded = dissertativas.every(i => entregaStatuses[i.id]);
    if (allGraded || dissertativas.length === 0) {
      setCorrecoes(current => ({
        ...current,
        [entregaId]: { ...current[entregaId], nota: String(Math.round(total * 100) / 100) }
      }));
    }
  };

  const handleSaveCorrection = async (entregaId: string) => {
    const payload = correcoes[entregaId];
    const notaInformada = Number(payload?.nota);

    if (!selectedAvaliacao) {
      setFeedback('Selecione uma avaliação antes de salvar a correção.');
      return;
    }

    if (!Number.isFinite(notaInformada) || notaInformada < 0 || notaInformada > selectedAvaliacao.notaMaxima) {
      setFeedback(`A nota precisa ficar entre 0 e ${selectedAvaliacao.notaMaxima}.`);
      return;
    }

    setSavingCorrectionId(entregaId);

    try {
      await apiPut(`/api/admin/entrega-avaliacao/${entregaId}/correcao`, payload);

      if (selectedId) {
        await loadAvaliacao(selectedId);
      }
      setFeedback('Correção salva com sucesso.');
      loadData();
    } catch {
      setFeedback('Erro ao salvar a correção.');
    } finally {
      setSavingCorrectionId(null);
    }
  };

  const handleFormatChange = (nextFormat: 'discursiva' | 'objetiva') => {
    setFormato(nextFormat);

    if (nextFormat === 'objetiva') {
      setPermiteArquivo(false);
      setPermiteTexto(false);
      if (!questoesObjetivas.length) {
        setQuestoesObjetivas(buildInitialQuestions());
      }
      return;
    }

    setResultadoImediato(true);
    setTempoLimiteMinutos('');
    setPermiteArquivo(true);
    setPermiteTexto(false);
  };

  const handleQuestionChange = (index: number, field: keyof ObjectiveQuestion, value: string | number) => {
    setQuestoesObjetivas((current) => current.map((question, questionIndex) => {
      if (questionIndex !== index) {
        return question;
      }

      return {
        ...question,
        [field]: value
      };
    }));
  };

  const handleOptionChange = (questionIndex: number, optionIndex: number, value: string) => {
    setQuestoesObjetivas((current) => current.map((question, currentIndex) => {
      if (currentIndex !== questionIndex) {
        return question;
      }

      return {
        ...question,
        opcoes: (question.opcoes ?? []).map((option, currentOptionIndex) => currentOptionIndex === optionIndex ? value : option)
      };
    }));
  };

  const handleQuestionTipoChange = (index: number, nextTipo: 'objetiva' | 'dissertativa') => {
    setQuestoesObjetivas((current) => current.map((question, questionIndex) => {
      if (questionIndex !== index) return question;
      if (nextTipo === 'dissertativa') {
        return { id: question.id, tipo: 'dissertativa', enunciado: question.enunciado, gabarito: '', explicacao: question.explicacao };
      }
      return { id: question.id, tipo: 'objetiva', enunciado: question.enunciado, opcoes: ['', '', '', ''], correta: 0, explicacao: question.explicacao };
    }));
  };

  const handleAddQuestion = (tipo: 'objetiva' | 'dissertativa' = 'objetiva') => {
    setQuestoesObjetivas((current) => [
      ...current,
      tipo === 'dissertativa' ? createEmptyDissertativeQuestion(current.length) : createEmptyObjectiveQuestion(current.length)
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestoesObjetivas((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((_, questionIndex) => questionIndex !== index)
        .map((question, questionIndex) => ({ ...question, id: `questao-${questionIndex + 1}` }));
    });
  };

  const isObjective = formato === 'objetiva';

  return (
    <>
      <div className="page-header page-header-split">
        <div>
          <h1>Avaliações</h1>
          <p>Cadastre provas discursivas ou objetivas, receba entregas e acompanhe correção e desempenho.</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-accent"
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                return;
              }

              resetForm();
              setShowForm(true);
            }}
            type="button"
          >
            {showForm ? 'Fechar cadastro' : 'Nova avaliação'}
          </button>
        </div>
      </div>

      {feedback && <div className={`inline-feedback ${feedback.includes('sucesso') ? 'success' : 'warning'}`}>{feedback}</div>}
      {pageError && <div className="inline-feedback warning">{pageError}</div>}

      {showForm && (
        <div className="card content-form-card mb-3">
          <form className="content-form" onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Título</label>
              <input className="form-input" required value={titulo} onChange={(event) => setTitulo(event.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Descrição</label>
              <textarea className="form-textarea" rows={4} value={descricao} onChange={(event) => setDescricao(event.target.value)} />
            </div>

            <div className="form-row form-row-compact">
              <div className="form-group">
                <label className="form-label">Tipo acadêmico</label>
                <select className="form-select" value={tipo} onChange={(event) => setTipo(event.target.value)}>
                  <option value="trabalho">Trabalho</option>
                  <option value="prova">Prova</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Formato</label>
                <select className="form-select" value={formato} onChange={(event) => handleFormatChange(event.target.value as 'discursiva' | 'objetiva')}>
                  <option value="discursiva">Discursiva / envio</option>
                  <option value="objetiva">Objetiva na plataforma</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nota máxima</label>
                <input className="form-input" min={1} step="0.5" type="number" value={notaMaxima} onChange={(event) => setNotaMaxima(event.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Prazo</label>
                <input className="form-input" type="datetime-local" value={dataLimite} onChange={(event) => setDataLimite(event.target.value)} />
              </div>
            </div>

            <div className="form-row form-row-compact">
              <div className="form-group">
                <label className="form-label">Módulo</label>
                <select
                  className="form-select"
                  value={moduloId}
                  onChange={(event) => {
                    setModuloId(event.target.value);
                    setAulaId('');
                  }}
                >
                  <option value="">Não vincular módulo</option>
                  {modulos.map((modulo: any) => (
                    <option key={modulo.id} value={modulo.id}>{modulo.titulo}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Aula</label>
                <select className="form-select" value={aulaId} onChange={(event) => setAulaId(event.target.value)}>
                  <option value="">{moduloId ? 'Sem aula (avaliação por módulo)' : 'Não vincular aula'}</option>
                  {aulasFiltradas.map((aula: any) => (
                    <option key={aula.id} value={aula.id}>{aula.moduloTitulo} - {aula.titulo}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row form-row-compact">
              <label className="checkbox-row">
                <input checked={publicado} onChange={(event) => setPublicado(event.target.checked)} type="checkbox" />
                <span className="form-label checkbox-label">Publicar agora</span>
              </label>

              {isObjective ? (
                <label className="checkbox-row">
                  <input checked={resultadoImediato} onChange={(event) => setResultadoImediato(event.target.checked)} type="checkbox" />
                  <span className="form-label checkbox-label">Mostrar resultado imediato</span>
                </label>
              ) : (
                <>
                  <label className="checkbox-row">
                    <input checked={permiteArquivo} onChange={(event) => setPermiteArquivo(event.target.checked)} type="checkbox" />
                    <span className="form-label checkbox-label">Permitir arquivo</span>
                  </label>
                  <label className="checkbox-row">
                    <input checked={permiteTexto} onChange={(event) => setPermiteTexto(event.target.checked)} type="checkbox" />
                    <span className="form-label checkbox-label">Permitir texto</span>
                  </label>
                </>
              )}
            </div>

            {isObjective && (
              <div className="assessment-builder">
                <div className="form-row form-row-compact">
                  <div className="form-group">
                    <label className="form-label">Tempo limite em minutos</label>
                    <input
                      className="form-input"
                      min={1}
                      placeholder="Opcional"
                      type="number"
                      value={tempoLimiteMinutos}
                      onChange={(event) => setTempoLimiteMinutos(event.target.value)}
                    />
                  </div>
                </div>

                <div className="student-section-header compact">
                  <div>
                    <span className="section-kicker">Construtor</span>
                    <h2>Questões</h2>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => handleAddQuestion('objetiva')} type="button">
                      + Objetiva
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleAddQuestion('dissertativa')} type="button">
                      + Dissertativa
                    </button>
                  </div>
                </div>

                <div className="assessment-question-builder-list">
                  {questoesObjetivas.map((questao, questionIndex) => (
                    <article className="assessment-question-builder-card" key={questao.id}>
                      <div className="assessment-question-builder-head">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <strong>Questão {questionIndex + 1}</strong>
                          <select
                            className="form-select"
                            style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                            value={questao.tipo ?? 'objetiva'}
                            onChange={(event) => handleQuestionTipoChange(questionIndex, event.target.value as 'objetiva' | 'dissertativa')}
                          >
                            <option value="objetiva">Objetiva (A/B/C/D)</option>
                            <option value="dissertativa">Dissertativa (texto livre)</option>
                          </select>
                        </div>
                        {questoesObjetivas.length > 1 && (
                          <button className="btn btn-outline btn-sm" onClick={() => handleRemoveQuestion(questionIndex)} type="button">
                            Remover
                          </button>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Enunciado</label>
                        <textarea
                          className="form-textarea"
                          rows={3}
                          value={questao.enunciado}
                          onChange={(event) => handleQuestionChange(questionIndex, 'enunciado', event.target.value)}
                        />
                      </div>

                      {(questao.tipo ?? 'objetiva') === 'objetiva' ? (
                        <>
                          <div className="assessment-option-grid">
                            {(questao.opcoes ?? ['', '', '', '']).map((opcao, optionIndex) => (
                              <div className="form-group" key={`${questao.id}-${optionIndex}`}>
                                <label className="form-label">Opção {String.fromCharCode(65 + optionIndex)}</label>
                                <input
                                  className="form-input"
                                  value={opcao}
                                  onChange={(event) => handleOptionChange(questionIndex, optionIndex, event.target.value)}
                                />
                              </div>
                            ))}
                          </div>

                          <div className="form-row form-row-compact">
                            <div className="form-group">
                              <label className="form-label">Alternativa correta</label>
                              <select
                                className="form-select"
                                value={questao.correta ?? 0}
                                onChange={(event) => handleQuestionChange(questionIndex, 'correta', Number(event.target.value))}
                              >
                                {(questao.opcoes ?? []).map((_, optionIndex) => (
                                  <option key={`${questao.id}-correta-${optionIndex}`} value={optionIndex}>
                                    {String.fromCharCode(65 + optionIndex)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="form-group">
                              <label className="form-label">Explicação da resposta</label>
                              <textarea
                                className="form-textarea"
                                rows={3}
                                value={questao.explicacao || ''}
                                onChange={(event) => handleQuestionChange(questionIndex, 'explicacao', event.target.value)}
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="form-row form-row-compact">
                          <div className="form-group">
                            <label className="form-label">Gabarito / Resposta esperada (visivel apenas para o admin)</label>
                            <textarea
                              className="form-textarea"
                              rows={3}
                              placeholder="Descreva o que seria uma resposta completa e correta..."
                              value={questao.gabarito || ''}
                              onChange={(event) => handleQuestionChange(questionIndex, 'gabarito', event.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Comentário / Contexto (opcional)</label>
                            <textarea
                              className="form-textarea"
                              rows={3}
                              value={questao.explicacao || ''}
                              onChange={(event) => handleQuestionChange(questionIndex, 'explicacao', event.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}

            <div className="content-form-actions">
              <button className="btn btn-primary" type="submit">{editingId ? 'Salvar alterações' : 'Salvar avaliação'}</button>
              {editingId && (
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  type="button"
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="content-panel-toolbar admin-toolbar-compact mb-3">
        <div className="search-field">
          <AppIcon name="search" size={16} />
          <input aria-label="Buscar avaliação" placeholder="Buscar avaliação" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="page-header-actions">
          <select aria-label="Filtrar módulo da avaliação" className="filter-select" value={filterModulo} onChange={(event) => setFilterModulo(event.target.value)}>
            <option value="todos">Todos os módulos</option>
            <option value="sem-modulo">Sem módulo</option>
            {modulos.map((modulo: any) => (
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
          <select aria-label="Filtrar status de publicação" className="filter-select" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
            <option value="todos">Todos os status</option>
            <option value="publicado">Publicadas</option>
            <option value="rascunho">Rascunhos</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card-grid">
          {[1, 2, 3].map((item) => <div className="skeleton skeleton-card" key={item} />)}
        </div>
      ) : (
        <div className="assessment-grid admin-assessment-grid">
          {filteredAvaliacoes.map((avaliacao) => (
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
                <span className={`badge ${avaliacao.publicado ? 'badge-success' : 'badge-error'}`}>
                  {avaliacao.publicado ? 'Publicado' : 'Rascunho'}
                </span>
              </div>

              <div className="assessment-meta">
                <span><strong>Módulo:</strong> {getAvaliacaoModulo(avaliacao)?.titulo || 'Livre'}</span>
                <span><strong>Aula:</strong> {avaliacao.aula?.titulo || 'Não vinculada'}</span>
                <span><strong>Prazo:</strong> {avaliacao.dataLimite ? new Date(avaliacao.dataLimite).toLocaleString('pt-BR') : 'Sem prazo'}</span>
                <span><strong>Nota máxima:</strong> {avaliacao.notaMaxima}</span>
                {avaliacao.formato === 'objetiva' && (
                  <>
                    <span><strong>Questões:</strong> {avaliacao.quantidadeQuestoes}</span>
                    <span><strong>Tempo:</strong> {avaliacao.tempoLimiteMinutos ? `${avaliacao.tempoLimiteMinutos} min` : 'Livre'}</span>
                  </>
                )}
              </div>

              <div className="assessment-result-grid">
                <div><span>Entregas</span><strong>{avaliacao.resumoEntregas?.entregues || 0}</strong></div>
                <div><span>Corrigidas</span><strong>{avaliacao.resumoEntregas?.corrigidas || 0}</strong></div>
                <div><span>Média</span><strong>{avaliacao.resumoEntregas?.mediaNotas ?? 'N/A'}</strong></div>
              </div>

              <div className="assessment-card-actions">
                <button className="btn btn-outline btn-sm" onClick={() => loadAvaliacao(avaliacao.id)} type="button">
                  Ver entregas
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => handleEdit(avaliacao)} type="button">
                  Editar
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => handleDelete(avaliacao.id)} type="button">
                  Excluir
                </button>
              </div>
            </article>
          ))}

          {!filteredAvaliacoes.length && (
            <div className="empty-panel">
              <AppIcon name="quiz" size={20} />
              <p>{avaliacoes.length ? 'Nenhuma avaliação corresponde aos filtros atuais.' : 'Nenhuma avaliação cadastrada ainda.'}</p>
            </div>
          )}
        </div>
      )}

      {selectedAvaliacao && (
        <div className="card mt-3">
          <div className="student-section-header compact">
            <div>
              <span className="section-kicker">Correção</span>
              <h2>{selectedAvaliacao.titulo}</h2>
              <p className="student-page-subtitle">
                {selectedAvaliacao.formato === 'objetiva'
                  ? `Prova objetiva com ${selectedAvaliacao.questoesObjetivas?.length || 0} questões.`
                  : 'Atividade por envio de arquivo e/ou resposta em texto.'}
              </p>
            </div>
          </div>

          {selectedAvaliacao.formato === 'objetiva' && selectedAvaliacao.questoesObjetivas?.length ? (
            <div className="assessment-text-response mb-3">
              <strong>Gabarito cadastrado</strong>
              <div className="assessment-review-list">
                {selectedAvaliacao.questoesObjetivas.map((questao, index) => (
                  <article className="assessment-review-item" key={questao.id}>
                    <h4>{index + 1}. {questao.enunciado}</h4>
                    <ul className="assessment-option-list">
                      {(questao.opcoes ?? []).map((opcao, optionIndex) => (
                        <li className={optionIndex === questao.correta ? 'correct' : ''} key={`${questao.id}-${optionIndex}`}>
                          <span>{String.fromCharCode(65 + optionIndex)}</span>
                          <p>{opcao}</p>
                        </li>
                      ))}
                    </ul>
                    {questao.explicacao && <p className="assessment-answer-explanation">{questao.explicacao}</p>}
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {selectedAvaliacao.entregas.length ? (
            <div className="assessment-submission-list">
              {selectedAvaliacao.entregas.map((entrega) => {
                const objectiveReview = selectedAvaliacao.formato === 'objetiva' && selectedAvaliacao.questoesObjetivas?.length
                  ? buildObjectiveReview(
                      selectedAvaliacao.questoesObjetivas,
                      parseStoredObjectiveAnswers(entrega.respostasObjetivas)
                    )
                  : [];

                return (
                  <article className="assessment-submission-card" key={entrega.id}>
                    <div className="assessment-card-head">
                      <div>
                        <h3>{entrega.aluno.nome}</h3>
                        <p>{entrega.aluno.email}</p>
                      </div>
                      <span className={`badge ${entrega.status === 'corrigido' ? 'badge-success' : 'badge-warning'}`}>{entrega.status}</span>
                    </div>

                    <div className="assessment-meta">
                      <span><strong>Enviado em:</strong> {entrega.enviadoEm ? new Date(entrega.enviadoEm).toLocaleString('pt-BR') : 'Não informado'}</span>
                      {entrega.arquivoUrl && (
                        <button
                          className="text-link-button"
                          onClick={() => {
                            void downloadAuthenticatedFile(`/api/admin/entrega-avaliacao/${entrega.id}/arquivo`).catch((error) => {
                              setFeedback(error instanceof Error ? error.message : 'Não foi possível baixar o arquivo.');
                            });
                          }}
                          type="button"
                        >
                          Abrir arquivo enviado
                        </button>
                      )}
                    </div>

                    {selectedAvaliacao.formato === 'objetiva' && (
                      <div className="assessment-result-box">
                        <div className="assessment-result-grid">
                          <div><span>Acertos</span><strong>{entrega.acertosObjetivos ?? 0}/{entrega.totalQuestoes ?? selectedAvaliacao.questoesObjetivas?.length ?? 0}</strong></div>
                          <div><span>Aproveitamento</span><strong>{entrega.percentualObjetivo != null ? `${entrega.percentualObjetivo}%` : 'N/A'}</strong></div>
                          <div><span>Nota</span><strong>{typeof entrega.nota === 'number' ? entrega.nota : 'Pendente'}</strong></div>
                        </div>

                        {!!objectiveReview.length && (
                          <div className="assessment-review-list">
                            {objectiveReview.map((item, reviewIndex) => (
                              <article className="assessment-review-item" key={item.id}>
                                <h4>{reviewIndex + 1}. {item.enunciado}</h4>
                                {item.tipo === 'dissertativa' ? (
                                  <div className="dissertativa-answer-block">
                                    <p className="form-label" style={{ marginBottom: '0.25rem' }}>Resposta do aluno:</p>
                                    <p style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                                      {item.respostaTextoAluno || <em style={{ opacity: 0.5 }}>Sem resposta</em>}
                                    </p>
                                    {item.explicacao && <p className="assessment-answer-explanation" style={{ marginTop: '0.5rem' }}><strong>Contexto:</strong> {item.explicacao}</p>}
                                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                                      {(['correta', 'meio-certa', 'errada'] as const).map((op) => {
                                        const current = questaoStatus[entrega.id]?.[item.id];
                                        const colors: Record<string, string> = { correta: 'var(--color-success, #22c55e)', 'meio-certa': '#f59e0b', errada: 'var(--color-error, #ef4444)' };
                                        const labels = { correta: 'Correta', 'meio-certa': 'Meio certa', errada: 'Errada' };
                                        const isActive = current === op;
                                        return (
                                          <button
                                            key={op}
                                            type="button"
                                            style={{
                                              padding: '0.25rem 0.65rem', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                              border: `1.5px solid ${colors[op]}`,
                                              background: isActive ? colors[op] : 'transparent',
                                              color: isActive ? '#fff' : colors[op],
                                              transition: 'all 0.15s'
                                            }}
                                            onClick={() => handleQuestaoStatus(entrega.id, item.id, op, objectiveReview, selectedAvaliacao.notaMaxima)}
                                          >
                                            {labels[op]}
                                          </button>
                                        );
                                      })}
                                    </div>
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
                        )}
                      </div>
                    )}

                    {entrega.respostaTexto && (
                      <div className="assessment-text-response">
                        <strong>Resposta em texto</strong>
                        <p>{entrega.respostaTexto}</p>
                      </div>
                    )}

                    <div className="form-row form-row-compact">
                      <div className="form-group">
                        <label className="form-label">Nota</label>
                        <input
                          className="form-input"
                          max={selectedAvaliacao.notaMaxima}
                          min={0}
                          step="0.5"
                          type="number"
                          value={correcoes[entrega.id]?.nota || ''}
                          onChange={(event) => setCorrecoes((current) => ({
                            ...current,
                            [entrega.id]: {
                              ...current[entrega.id],
                              nota: event.target.value
                            }
                          }))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Comentário</label>
                        <textarea
                          className="form-textarea"
                          rows={4}
                          value={correcoes[entrega.id]?.comentarioCorrecao || ''}
                          onChange={(event) => setCorrecoes((current) => ({
                            ...current,
                            [entrega.id]: {
                              ...current[entrega.id],
                              comentarioCorrecao: event.target.value
                            }
                          }))}
                        />
                      </div>
                    </div>

                    <button className="btn btn-primary btn-sm" disabled={savingCorrectionId === entrega.id} onClick={() => handleSaveCorrection(entrega.id)} type="button">
                      {savingCorrectionId === entrega.id ? 'Salvando...' : 'Salvar correção'}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-panel">
              <AppIcon name="quiz" size={20} />
              <p>Nenhuma entrega recebida nesta avaliação.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
