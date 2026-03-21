import { FormEvent, useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import AppIcon from '../../components/AppIcon';
import { downloadAuthenticatedFile } from '../../lib/auth-file';
import { ObjectiveReviewItem, StudentObjectiveQuestion } from '../../lib/objective-assessment';

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
  modulo?: { titulo: string } | null;
  aula?: { titulo: string } | null;
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
    totalQuestoes?: number | null;
    acertosObjetivos?: number | null;
    percentualObjetivo?: number | null;
  } | null;
};

export default function StudentAvaliacoes() {
  const token = localStorage.getItem('accessToken');
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [respostasTexto, setRespostasTexto] = useState<Record<string, string>>({});
  const [respostasObjetivas, setRespostasObjetivas] = useState<Record<string, Array<number | null>>>({});
  const [arquivos, setArquivos] = useState<Record<string, File | null>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');

  const loadData = () => {
    setLoading(true);
    fetch('/api/aluno/avaliacoes', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((response) => response.json())
      .then((data) => {
        setAvaliacoes(data);
        setRespostasTexto(Object.fromEntries(
          data.map((item: Avaliacao) => [item.id, item.entregaAtual?.respostaTexto || ''])
        ));
        setRespostasObjetivas(Object.fromEntries(
          data.map((item: Avaliacao) => [
            item.id,
            item.questoesObjetivas?.map((_, index) => item.resultadoObjetivo?.respostas?.[index]?.respostaAluno ?? null) || []
          ])
        ));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
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
      return matchesSearch && matchesTipo && matchesStatus;
    });
  }, [avaliacoes, filterStatus, filterTipo, search]);

  const handleSubmit = async (event: FormEvent, avaliacao: Avaliacao) => {
    event.preventDefault();
    setSubmittingId(avaliacao.id);
    setFeedback((current) => ({ ...current, [avaliacao.id]: '' }));

    const formData = new FormData();
    if (avaliacao.formato === 'objetiva') {
      formData.append('respostasObjetivas', JSON.stringify(respostasObjetivas[avaliacao.id] || []));
    } else {
      const texto = respostasTexto[avaliacao.id]?.trim();
      if (texto) {
        formData.append('respostaTexto', texto);
      }

      const arquivo = arquivos[avaliacao.id];
      if (arquivo) {
        formData.append('arquivo', arquivo);
      }
    }

    try {
      const response = await fetch(`/api/aluno/avaliacao/${avaliacao.id}/entrega`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        setFeedback((current) => ({ ...current, [avaliacao.id]: data.error || 'Nao foi possivel enviar a atividade.' }));
        return;
      }

      setFeedback((current) => ({ ...current, [avaliacao.id]: 'Entrega enviada com sucesso.' }));
      setArquivos((current) => ({ ...current, [avaliacao.id]: null }));
      loadData();
    } catch {
      setFeedback((current) => ({ ...current, [avaliacao.id]: 'Erro ao comunicar com o servidor.' }));
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="layout student-layout">
      <Sidebar type="student" />
      <main className="main-content student-main">
        <section className="student-topbar">
          <div>
            <span className="section-kicker">Fase 3</span>
            <h1 className="student-page-title">Avaliacoes e trabalhos</h1>
            <p className="student-page-subtitle">
              Envie atividades, faca provas objetivas na plataforma e acompanhe correcao, nota e comentarios.
            </p>
          </div>
        </section>

        <section className="student-stats-grid">
          <article className="student-stat-tile">
            <div className="student-stat-icon"><AppIcon name="quiz" size={18} /></div>
            <div><strong>{resumo.total}</strong><span>Avaliacoes publicadas</span></div>
          </article>
          <article className="student-stat-tile">
            <div className="student-stat-icon"><AppIcon name="check" size={18} /></div>
            <div><strong>{resumo.entregues}</strong><span>Entregas realizadas</span></div>
          </article>
          <article className="student-stat-tile">
            <div className="student-stat-icon"><AppIcon name="target" size={18} /></div>
            <div><strong>{resumo.media}</strong><span>Media das notas</span></div>
          </article>
        </section>

        <section className="student-section">
          <div className="student-section-header">
            <div>
              <span className="section-kicker">Painel academico</span>
              <h2>Provas e trabalhos</h2>
            </div>
          </div>

          <div className="content-panel-toolbar admin-toolbar-compact mb-3">
            <div className="search-field">
              <AppIcon name="search" size={16} />
              <input placeholder="Buscar avaliacao" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="page-header-actions">
              <select className="filter-select" value={filterTipo} onChange={(event) => setFilterTipo(event.target.value)}>
                <option value="todos">Todos os tipos</option>
                <option value="trabalho">Trabalhos</option>
                <option value="prova">Provas</option>
              </select>
              <select className="filter-select" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
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
                const isExpanded = expandedId === avaliacao.id;
                const jaEnviouObjetiva = avaliacao.formato === 'objetiva' && Boolean(avaliacao.entregaAtual?.enviadoEm);
                const mostrarResultadoObjetivo = avaliacao.formato !== 'objetiva' || avaliacao.resultadoImediato;

                return (
                  <article className="assessment-card" key={avaliacao.id}>
                    <div className="assessment-card-head">
                      <div>
                        <div className="assessment-badge-row">
                          <span className={`badge ${avaliacao.tipo === 'prova' ? 'badge-warning' : 'badge-info'}`}>{avaliacao.tipo}</span>
                          <span className={`badge ${avaliacao.formato === 'objetiva' ? 'badge-purple' : 'badge-info'}`}>{avaliacao.formato}</span>
                        </div>
                        <h3>{avaliacao.titulo}</h3>
                        <p>{avaliacao.descricao || 'Sem descricao cadastrada.'}</p>
                      </div>
                      <span className={`badge ${status === 'corrigido' ? 'badge-success' : status === 'enviado' ? 'badge-warning' : 'badge-error'}`}>
                        {status}
                      </span>
                    </div>

                    <div className="assessment-meta">
                      <span><strong>Modulo:</strong> {avaliacao.modulo?.titulo || 'Livre'}</span>
                      <span><strong>Aula:</strong> {avaliacao.aula?.titulo || 'Nao vinculada'}</span>
                      <span><strong>Prazo:</strong> {prazo}</span>
                      <span><strong>Nota maxima:</strong> {avaliacao.notaMaxima}</span>
                      {avaliacao.formato === 'objetiva' && (
                        <>
                          <span><strong>Questoes:</strong> {avaliacao.quantidadeQuestoes}</span>
                          <span><strong>Tempo:</strong> {avaliacao.tempoLimiteMinutos ? `${avaliacao.tempoLimiteMinutos} min` : 'Livre'}</span>
                        </>
                      )}
                    </div>

                    {avaliacao.entregaAtual && (
                      <div className="assessment-result-box">
                        <div>
                          <strong>Situacao da entrega</strong>
                          <p>
                            {avaliacao.entregaAtual.enviadoEm
                              ? `Enviado em ${new Date(avaliacao.entregaAtual.enviadoEm).toLocaleString('pt-BR')}`
                              : 'Entrega ainda nao enviada.'}
                          </p>
                        </div>
                        {mostrarResultadoObjetivo ? (
                          <div className="assessment-result-grid">
                            <div>
                              <span>Nota</span>
                              <strong>{typeof avaliacao.entregaAtual.nota === 'number' ? avaliacao.entregaAtual.nota : 'Pendente'}</strong>
                            </div>
                            <div>
                              <span>Comentario</span>
                              <strong>{avaliacao.entregaAtual.comentarioCorrecao || 'Aguardando correcao'}</strong>
                            </div>
                            {avaliacao.formato === 'objetiva' && (
                              <div>
                                <span>Acertos</span>
                                <strong>{avaliacao.entregaAtual.acertosObjetivos ?? 0}/{avaliacao.entregaAtual.totalQuestoes ?? avaliacao.quantidadeQuestoes}</strong>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p>Prova enviada com sucesso. O resultado detalhado sera liberado pela equipe academica.</p>
                        )}
                        {avaliacao.entregaAtual.arquivoUrl && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              void downloadAuthenticatedFile(`/api/aluno/entrega-avaliacao/${avaliacao.entregaAtual?.id}/arquivo`, token).catch((error) => {
                                setFeedback((current) => ({
                                  ...current,
                                  [avaliacao.id]: error instanceof Error ? error.message : 'Nao foi possivel baixar o arquivo.'
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
                                <ul className="assessment-option-list">
                                  {item.opcoes.map((opcao, optionIndex) => {
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
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}

                    <div className="assessment-card-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => setExpandedId(isExpanded ? null : avaliacao.id)} type="button">
                        {isExpanded ? 'Fechar' : jaEnviouObjetiva ? (mostrarResultadoObjetivo ? 'Ver prova' : 'Ver envio') : 'Enviar atividade'}
                      </button>
                    </div>

                    {isExpanded && (
                      <form className="assessment-form" onSubmit={(event) => handleSubmit(event, avaliacao)}>
                        {avaliacao.formato === 'objetiva' && !jaEnviouObjetiva && (
                          <div className="assessment-review-list">
                            {avaliacao.questoesObjetivas?.map((questao, questionIndex) => (
                              <article className="assessment-review-item" key={questao.id}>
                                <h4>{questionIndex + 1}. {questao.enunciado}</h4>
                                <ul className="assessment-option-list selectable">
                                  {questao.opcoes.map((opcao, optionIndex) => {
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
                                              return {
                                                ...current,
                                                [avaliacao.id]: currentAnswers
                                              };
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
                              </article>
                            ))}
                          </div>
                        )}

                        {avaliacao.formato === 'discursiva' && avaliacao.permiteTexto && (
                          <div className="form-group">
                            <label className="form-label">Resposta em texto</label>
                            <textarea
                              className="form-textarea"
                              rows={6}
                              value={respostasTexto[avaliacao.id] || ''}
                              onChange={(event) => setRespostasTexto((current) => ({ ...current, [avaliacao.id]: event.target.value }))}
                            />
                          </div>
                        )}

                        {avaliacao.formato === 'discursiva' && avaliacao.permiteArquivo && (
                          <div className="form-group">
                            <label className="form-label">Arquivo da entrega</label>
                            <input
                              className="form-input file-input"
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

                        {!jaEnviouObjetiva && (
                          <button className="btn btn-primary" disabled={submittingId === avaliacao.id} type="submit">
                            {submittingId === avaliacao.id ? 'Enviando...' : avaliacao.formato === 'objetiva' ? 'Finalizar prova' : 'Salvar entrega'}
                          </button>
                        )}
                      </form>
                    )}
                  </article>
                );
              })}

              {!filteredAvaliacoes.length && (
                <div className="empty-panel">
                  <AppIcon name="quiz" size={20} />
                  <p>{avaliacoes.length ? 'Nenhuma avaliacao corresponde aos filtros atuais.' : 'Nenhuma avaliacao publicada ainda.'}</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
