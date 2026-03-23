import { useEffect, useState } from 'react';

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

  useEffect(() => {
    apiGet<AlunoListItem[]>('/api/admin/alunos')
      .then(setAlunos)
      .catch(() => setFeedback('Nao foi possivel carregar a lista de alunos.'))
      .finally(() => setLoading(false));
  }, []);

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
        <p>Envie comunicados importantes para todos os alunos ou para um especifico.</p>
      </div>

      {feedback && (
        <div className={`inline-feedback ${feedback.includes('sucesso') ? 'success' : 'warning'}`}>
          {feedback}
        </div>
      )}

      <div className="panel-card page-surface-narrow">
        <form onSubmit={handleSend}>
          <div className="form-group">
            <label className="form-label">Destinatario</label>
            <select
              className="filter-select"
              value={alunoId}
              onChange={(event) => setAlunoId(event.target.value)}
              disabled={loading}
            >
              <option value="">TODOS OS ALUNOS (Geral)</option>
              {alunos.map((aluno) => (
                <option key={aluno.id} value={aluno.id}>{aluno.nome} ({aluno.email})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Titulo do aviso</label>
            <div className="search-field">
              <input
                placeholder="Ex: Mudanca no horario da aula de quarta"
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
