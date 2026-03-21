import { FormEvent, useEffect, useMemo, useState } from 'react';
import AppIcon from '../../components/AppIcon';
import { apiUrl } from '../../lib/api';

type Avaliacao = {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  dataLimite?: string | null;
  notaMaxima: number;
  publicado: boolean;
  permiteArquivo: boolean;
  permiteTexto: boolean;
  modulo?: { id: string; titulo: string } | null;
  aula?: { id: string; titulo: string } | null;
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
  enviadoEm?: string | null;
  aluno: {
    id: string;
    nome: string;
    email: string;
  };
};

export default function AdminAvaliacoes() {
  const token = localStorage.getItem('accessToken');
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [modulos, setModulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAvaliacao, setSelectedAvaliacao] = useState<(Avaliacao & { entregas: Entrega[] }) | null>(null);
  const [feedback, setFeedback] = useState('');
  const [savingCorrectionId, setSavingCorrectionId] = useState<string | null>(null);

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('trabalho');
  const [moduloId, setModuloId] = useState('');
  const [aulaId, setAulaId] = useState('');
  const [dataLimite, setDataLimite] = useState('');
  const [notaMaxima, setNotaMaxima] = useState('10');
  const [publicado, setPublicado] = useState(true);
  const [permiteArquivo, setPermiteArquivo] = useState(true);
  const [permiteTexto, setPermiteTexto] = useState(false);

  const [correcoes, setCorrecoes] = useState<Record<string, { nota: string; comentarioCorrecao: string; status: string }>>({});

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/avaliacoes', { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()),
      fetch('/api/admin/aulas', { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json())
    ])
      .then(([avaliacoesData, modulosData]) => {
        setAvaliacoes(avaliacoesData);
        setModulos(modulosData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const aulasDisponiveis = useMemo(() => {
    return modulos.flatMap((modulo: any) => modulo.aulas?.map((aula: any) => ({ ...aula, moduloTitulo: modulo.titulo })) || []);
  }, [modulos]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback('');

    try {
      const response = await fetch('/api/admin/avaliacao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          titulo,
          descricao,
          tipo,
          moduloId: moduloId || null,
          aulaId: aulaId || null,
          dataLimite: dataLimite || null,
          notaMaxima,
          publicado,
          permiteArquivo,
          permiteTexto
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setFeedback(data.error || 'Nao foi possivel criar a avaliacao.');
        return;
      }

      setTitulo('');
      setDescricao('');
      setTipo('trabalho');
      setModuloId('');
      setAulaId('');
      setDataLimite('');
      setNotaMaxima('10');
      setPublicado(true);
      setPermiteArquivo(true);
      setPermiteTexto(false);
      setShowForm(false);
      loadData();
    } catch {
      setFeedback('Erro ao comunicar com o servidor.');
    }
  };

  const loadAvaliacao = async (avaliacaoId: string) => {
    setSelectedId(avaliacaoId);
    const response = await fetch(`/api/admin/avaliacao/${avaliacaoId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    setSelectedAvaliacao(data);
    setCorrecoes(Object.fromEntries(
      (data.entregas || []).map((entrega: Entrega) => [
        entrega.id,
        {
          nota: typeof entrega.nota === 'number' ? String(entrega.nota) : '',
          comentarioCorrecao: entrega.comentarioCorrecao || '',
          status: entrega.status === 'corrigido' ? 'corrigido' : 'corrigido'
        }
      ])
    ));
  };

  const handleSaveCorrection = async (entregaId: string) => {
    const payload = correcoes[entregaId];
    setSavingCorrectionId(entregaId);

    try {
      const response = await fetch(`/api/admin/entrega-avaliacao/${entregaId}/correcao`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        setFeedback(data.error || 'Nao foi possivel salvar a correcao.');
        return;
      }

      if (selectedId) {
        await loadAvaliacao(selectedId);
      }
      loadData();
    } catch {
      setFeedback('Erro ao salvar a correcao.');
    } finally {
      setSavingCorrectionId(null);
    }
  };

  return (
    <>
      <div className="page-header page-header-split">
        <div>
          <h1>Avaliacoes</h1>
          <p>Cadastre provas e trabalhos, receba entregas e lance nota com comentario individual.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-accent" onClick={() => setShowForm((current) => !current)} type="button">
            {showForm ? 'Fechar cadastro' : 'Nova avaliacao'}
          </button>
        </div>
      </div>

      {feedback && <div className="inline-feedback warning">{feedback}</div>}

      {showForm && (
        <div className="card content-form-card mb-3">
          <form className="content-form" onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Titulo</label>
              <input className="form-input" required value={titulo} onChange={(event) => setTitulo(event.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Descricao</label>
              <textarea className="form-textarea" rows={4} value={descricao} onChange={(event) => setDescricao(event.target.value)} />
            </div>

            <div className="form-row form-row-compact">
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={tipo} onChange={(event) => setTipo(event.target.value)}>
                  <option value="trabalho">Trabalho</option>
                  <option value="prova">Prova</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nota maxima</label>
                <input className="form-input" min={1} step="0.5" type="number" value={notaMaxima} onChange={(event) => setNotaMaxima(event.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Prazo</label>
                <input className="form-input" type="datetime-local" value={dataLimite} onChange={(event) => setDataLimite(event.target.value)} />
              </div>
            </div>

            <div className="form-row form-row-compact">
              <div className="form-group">
                <label className="form-label">Modulo</label>
                <select className="form-select" value={moduloId} onChange={(event) => setModuloId(event.target.value)}>
                  <option value="">Nao vincular modulo</option>
                  {modulos.map((modulo: any) => (
                    <option key={modulo.id} value={modulo.id}>{modulo.titulo}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Aula</label>
                <select className="form-select" value={aulaId} onChange={(event) => setAulaId(event.target.value)}>
                  <option value="">Nao vincular aula</option>
                  {aulasDisponiveis.map((aula: any) => (
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
              <label className="checkbox-row">
                <input checked={permiteArquivo} onChange={(event) => setPermiteArquivo(event.target.checked)} type="checkbox" />
                <span className="form-label checkbox-label">Permitir arquivo</span>
              </label>
              <label className="checkbox-row">
                <input checked={permiteTexto} onChange={(event) => setPermiteTexto(event.target.checked)} type="checkbox" />
                <span className="form-label checkbox-label">Permitir texto</span>
              </label>
            </div>

            <div className="content-form-actions">
              <button className="btn btn-primary" type="submit">Salvar avaliacao</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card-grid">
          {[1, 2, 3].map((item) => <div className="skeleton skeleton-card" key={item} />)}
        </div>
      ) : (
        <div className="assessment-grid admin-assessment-grid">
          {avaliacoes.map((avaliacao) => (
            <article className="assessment-card" key={avaliacao.id}>
              <div className="assessment-card-head">
                <div>
                  <span className={`badge ${avaliacao.tipo === 'prova' ? 'badge-warning' : 'badge-info'}`}>{avaliacao.tipo}</span>
                  <h3>{avaliacao.titulo}</h3>
                  <p>{avaliacao.descricao || 'Sem descricao cadastrada.'}</p>
                </div>
                <span className={`badge ${avaliacao.publicado ? 'badge-success' : 'badge-error'}`}>
                  {avaliacao.publicado ? 'Publicado' : 'Rascunho'}
                </span>
              </div>

              <div className="assessment-meta">
                <span><strong>Modulo:</strong> {avaliacao.modulo?.titulo || 'Livre'}</span>
                <span><strong>Aula:</strong> {avaliacao.aula?.titulo || 'Nao vinculada'}</span>
                <span><strong>Prazo:</strong> {avaliacao.dataLimite ? new Date(avaliacao.dataLimite).toLocaleString('pt-BR') : 'Sem prazo'}</span>
                <span><strong>Nota maxima:</strong> {avaliacao.notaMaxima}</span>
              </div>

              <div className="assessment-result-grid">
                <div><span>Entregas</span><strong>{avaliacao.resumoEntregas?.entregues || 0}</strong></div>
                <div><span>Corrigidas</span><strong>{avaliacao.resumoEntregas?.corrigidas || 0}</strong></div>
                <div><span>Media</span><strong>{avaliacao.resumoEntregas?.mediaNotas ?? 'N/A'}</strong></div>
              </div>

              <div className="assessment-card-actions">
                <button className="btn btn-outline btn-sm" onClick={() => loadAvaliacao(avaliacao.id)} type="button">
                  Ver entregas
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedAvaliacao && (
        <div className="card mt-3">
          <div className="student-section-header compact">
            <div>
              <span className="section-kicker">Correcao</span>
              <h2>{selectedAvaliacao.titulo}</h2>
            </div>
          </div>

          {selectedAvaliacao.entregas.length ? (
            <div className="assessment-submission-list">
              {selectedAvaliacao.entregas.map((entrega) => (
                <article className="assessment-submission-card" key={entrega.id}>
                  <div className="assessment-card-head">
                    <div>
                      <h3>{entrega.aluno.nome}</h3>
                      <p>{entrega.aluno.email}</p>
                    </div>
                    <span className={`badge ${entrega.status === 'corrigido' ? 'badge-success' : 'badge-warning'}`}>{entrega.status}</span>
                  </div>

                  <div className="assessment-meta">
                    <span><strong>Enviado em:</strong> {entrega.enviadoEm ? new Date(entrega.enviadoEm).toLocaleString('pt-BR') : 'Nao informado'}</span>
                    {entrega.arquivoUrl && (
                      <a href={apiUrl(entrega.arquivoUrl)} rel="noreferrer" target="_blank">
                        Abrir arquivo enviado
                      </a>
                    )}
                  </div>

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
                      <label className="form-label">Comentario</label>
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
                    {savingCorrectionId === entrega.id ? 'Salvando...' : 'Salvar correcao'}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <AppIcon name="quiz" size={20} />
              <p>Nenhuma entrega recebida nesta avaliacao.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
