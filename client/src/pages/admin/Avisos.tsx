import { useEffect, useMemo, useState } from 'react';

import AppIcon from '../../components/AppIcon';
import { apiGet, apiPost } from '../../lib/apiClient';
import type { AlunoListItem } from '../../types/models';

export default function AdminAvisos() {
  const [alunos, setAlunos] = useState<AlunoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');

  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [searchAluno, setSearchAluno] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    apiGet<AlunoListItem[]>('/api/admin/alunos')
      .then(setAlunos)
      .catch(() => setFeedback('Não foi possível carregar a lista de alunos.'))
      .finally(() => setLoading(false));
  }, []);

  const alunosFiltrados = useMemo(() => {
    const term = searchAluno.trim().toLowerCase();
    const result = term
      ? alunos.filter((aluno) => aluno.nome.toLowerCase().includes(term))
      : [...alunos];

    return result.sort((a, b) => {
      const compare = a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
      return sortOrder === 'asc' ? compare : -compare;
    });
  }, [alunos, searchAluno, sortOrder]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!titulo || !mensagem) return;

    setSending(true);
    setFeedback('');

    try {
      await apiPost('/api/admin/notificacao', { titulo, mensagem, alunoId: alunoId || null });
      setFeedback('Aviso enviado com sucesso.');
      setTitulo('');
      setMensagem('');
      setAlunoId('');
    } catch {
      setFeedback('Erro ao comunicar com o servidor.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Central de Avisos</h1>
        <p>Envie comunicados importantes para todos os alunos ou para um específico.</p>
      </div>

      {feedback && (
        <div className={`inline-feedback ${feedback.includes('sucesso') ? 'success' : 'warning'}`}>
          {feedback}
        </div>
      )}

      <div className="panel-card page-surface-narrow">
        <form onSubmit={handleSend}>
          <div className="form-group">
            <label className="form-label">Destinatário</label>
            <div className="filters" style={{ marginBottom: '0.75rem' }}>
              <input
                className="form-input"
                placeholder="Buscar aluno por nome"
                value={searchAluno}
                onChange={(event) => setSearchAluno(event.target.value)}
                aria-label="Buscar aluno por nome"
              />
              <select
                className="filter-select"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as 'asc' | 'desc')}
                aria-label="Ordenar alunos"
              >
                <option value="asc">Nome (A-Z)</option>
                <option value="desc">Nome (Z-A)</option>
              </select>
            </div>
            <select
              className="filter-select"
              value={alunoId}
              onChange={(event) => setAlunoId(event.target.value)}
              disabled={loading}
            >
              <option value="">TODOS OS ALUNOS (Geral)</option>
              {alunosFiltrados.map((aluno) => (
                <option key={aluno.id} value={aluno.id}>{aluno.nome} ({aluno.email})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Título do aviso</label>
            <div className="search-field">
              <input
                placeholder="Ex: Mudança no horário da aula de quarta"
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mensagem</label>
            <textarea
              className="form-textarea"
              placeholder="Escreva aqui o comunicado detalhado..."
              rows={6}
              value={mensagem}
              onChange={(event) => setMensagem(event.target.value)}
              required
            />
          </div>

          <button className="btn btn-primary w-full" disabled={sending || loading} type="submit">
            <AppIcon name="bell" size={16} />
            {sending ? 'Enviando...' : 'Disparar comunicado'}
          </button>
        </form>
      </div>
    </>
  );
}
