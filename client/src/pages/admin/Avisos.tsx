import { useEffect, useState } from 'react';
import AppIcon from '../../components/AppIcon';

export default function AdminAvisos() {
  const token = localStorage.getItem('accessToken');
  const [alunos, setAlunos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [alunoId, setAlunoId] = useState(''); // Empty = All

  useEffect(() => {
    fetch('/api/admin/alunos', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setAlunos)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !mensagem) return;

    setSending(true);
    setSuccess(false);
    try {
      const res = await fetch('/api/admin/notificacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ titulo, mensagem, alunoId: alunoId || null })
      });

      if (res.ok) {
        setSuccess(true);
        setTitulo('');
        setMensagem('');
        setAlunoId('');
      }
    } catch (err) {
      console.error(err);
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

        <div className="panel-card" style={{ maxWidth: '600px' }}>
          <form onSubmit={handleSend}>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Destinatario</label>
              <select 
                className="filter-select" 
                style={{ width: '100%' }}
                value={alunoId}
                onChange={e => setAlunoId(e.target.value)}
              >
                <option value="">TODOS OS ALUNOS (Geral)</option>
                {alunos.map(aluno => (
                  <option key={aluno.id} value={aluno.id}>{aluno.nome} ({aluno.email})</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Titulo do Aviso</label>
              <div className="search-field" style={{ border: '1px solid var(--border-color)' }}>
                <input 
                  placeholder="Ex: Mudanca no hórario da aula de quarta" 
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Mensagem</label>
              <textarea 
                className="filter-select"
                placeholder="Escreva aqui o comunicado detalhado..."
                style={{ width: '100%', minHeight: '150px', padding: '1rem' }}
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                required
              />
            </div>

            {success && (
              <div className="badge badge-success" style={{ display: 'block', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                Aviso enviado com sucesso!
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={sending} style={{ width: '100%' }}>
              <AppIcon name="bell" size={16} />
              {sending ? 'Enviando...' : 'Disparar Comunicado'}
            </button>
          </form>
        </div>
    </>
  );
}
