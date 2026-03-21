import { FormEvent, useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import AppIcon from '../../components/AppIcon';
import { apiUrl } from '../../lib/api';

type Avaliacao = {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  dataLimite?: string | null;
  notaMaxima: number;
  permiteArquivo: boolean;
  permiteTexto: boolean;
  modulo?: { titulo: string } | null;
  aula?: { titulo: string } | null;
  entregaAtual?: {
    id: string;
    status: string;
    nota?: number | null;
    comentarioCorrecao?: string | null;
    arquivoUrl?: string | null;
    respostaTexto?: string | null;
    enviadoEm?: string | null;
  } | null;
};

export default function StudentAvaliacoes() {
  const token = localStorage.getItem('accessToken');
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [respostasTexto, setRespostasTexto] = useState<Record<string, string>>({});
  const [arquivos, setArquivos] = useState<Record<string, File | null>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

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

  const handleSubmit = async (event: FormEvent, avaliacao: Avaliacao) => {
    event.preventDefault();
    setSubmittingId(avaliacao.id);
    setFeedback((current) => ({ ...current, [avaliacao.id]: '' }));

    const formData = new FormData();
    const texto = respostasTexto[avaliacao.id]?.trim();
    if (texto) {
      formData.append('respostaTexto', texto);
    }

    const arquivo = arquivos[avaliacao.id];
    if (arquivo) {
      formData.append('arquivo', arquivo);
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
            <span className="section-kicker">Fase 2</span>
            <h1 className="student-page-title">Avaliacoes e trabalhos</h1>
            <p className="student-page-subtitle">
              Envie atividades, acompanhe correcao, veja nota e receba comentarios da equipe.
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

          {loading ? (
            <div className="card-grid">
              {[1, 2, 3].map((item) => <div className="skeleton skeleton-card" key={item} />)}
            </div>
          ) : (
            <div className="assessment-grid">
              {avaliacoes.map((avaliacao) => {
                const status = avaliacao.entregaAtual?.status || 'pendente';
                const prazo = avaliacao.dataLimite ? new Date(avaliacao.dataLimite).toLocaleDateString('pt-BR') : 'Sem prazo definido';
                const isExpanded = expandedId === avaliacao.id;

                return (
                  <article className="assessment-card" key={avaliacao.id}>
                    <div className="assessment-card-head">
                      <div>
                        <span className={`badge ${avaliacao.tipo === 'prova' ? 'badge-warning' : 'badge-info'}`}>{avaliacao.tipo}</span>
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
                        <div className="assessment-result-grid">
                          <div>
                            <span>Nota</span>
                            <strong>{typeof avaliacao.entregaAtual.nota === 'number' ? avaliacao.entregaAtual.nota : 'Pendente'}</strong>
                          </div>
                          <div>
                            <span>Comentario</span>
                            <strong>{avaliacao.entregaAtual.comentarioCorrecao || 'Aguardando correcao'}</strong>
                          </div>
                        </div>
                        {avaliacao.entregaAtual.arquivoUrl && (
                          <a className="btn btn-outline btn-sm" href={apiUrl(avaliacao.entregaAtual.arquivoUrl)} rel="noreferrer" target="_blank">
                            <AppIcon name="external" size={14} />
                            <span>Ver arquivo enviado</span>
                          </a>
                        )}
                      </div>
                    )}

                    <div className="assessment-card-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => setExpandedId(isExpanded ? null : avaliacao.id)} type="button">
                        {isExpanded ? 'Fechar envio' : 'Enviar atividade'}
                      </button>
                    </div>

                    {isExpanded && (
                      <form className="assessment-form" onSubmit={(event) => handleSubmit(event, avaliacao)}>
                        {avaliacao.permiteTexto && (
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

                        {avaliacao.permiteArquivo && (
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

                        <button className="btn btn-primary" disabled={submittingId === avaliacao.id} type="submit">
                          {submittingId === avaliacao.id ? 'Enviando...' : 'Salvar entrega'}
                        </button>
                      </form>
                    )}
                  </article>
                );
              })}

              {!avaliacoes.length && (
                <div className="empty-panel">
                  <AppIcon name="quiz" size={20} />
                  <p>Nenhuma avaliacao publicada ainda.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
