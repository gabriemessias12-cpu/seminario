import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Aluno {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  ultimoAcesso?: string | null;
  progressoGeral: number;
}

export default function AdminAlunos() {
  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken');
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('123456');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadAlunos = () => {
    fetch('/api/admin/alunos', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setAlunos)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlunos();
  }, []);

  const filtered = alunos.filter((aluno) =>
    aluno.nome.toLowerCase().includes(search.toLowerCase()) ||
    aluno.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleStatus = async (id: string) => {
    await fetch(`/api/admin/aluno/${id}/toggle`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });

    setAlunos((current) => current.map((aluno) => (
      aluno.id === id ? { ...aluno, ativo: !aluno.ativo } : aluno
    )));
  };

  const handleCreateStudent = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFeedback('');

    try {
      const response = await fetch('/api/admin/aluno', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ nome, email, telefone, senha })
      });

      const data = await response.json();
      if (!response.ok) {
        setFeedback(data.error || 'Nao foi possivel cadastrar o aluno.');
        setSaving(false);
        return;
      }

      setFeedback(`Aluno criado com sucesso. Senha temporaria: ${data.senhaTemporaria}`);
      setNome('');
      setEmail('');
      setTelefone('');
      setSenha('123456');
      setShowForm(false);
      loadAlunos();
    } catch {
      setFeedback('Erro ao comunicar com o servidor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h1>Gestao de Alunos</h1>
            <p>{alunos.length} alunos cadastrados</p>
          </div>
          <button className="btn btn-accent" onClick={() => setShowForm((current) => !current)}>
            {showForm ? 'Fechar cadastro' : '+ Cadastrar aluno'}
          </button>
        </div>

        {feedback && (
          <div className="card mb-3" style={{ borderColor: 'rgba(249,115,22,0.3)', background: 'rgba(249,115,22,0.08)' }}>
            {feedback}
          </div>
        )}

        {showForm && (
          <div className="card mb-3" style={{ maxWidth: 680 }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Novo aluno</h3>
            <form onSubmit={handleCreateStudent}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Nome</label>
                  <input className="form-input" value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input className="form-input" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-0000" />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Senha inicial</label>
                  <input className="form-input" value={senha} onChange={(e) => setSenha(e.target.value)} required />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Criar aluno'}
              </button>
            </form>
          </div>
        )}

        <div className="filters">
          <input
            className="form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email"
            style={{ maxWidth: 400 }}
          />
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 300 }} />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Email</th>
                  <th>Progresso</th>
                  <th>Ultimo acesso</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((aluno) => (
                  <tr key={aluno.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 'var(--radius-full)',
                          background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: 'white',
                          flexShrink: 0
                        }}>
                          {aluno.nome?.[0]}
                        </div>
                        <span style={{ fontWeight: 500 }}>{aluno.nome}</span>
                      </div>
                    </td>
                    <td className="text-muted">{aluno.email}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="progress-bar" style={{ width: 80 }}>
                          <div
                            className={`progress-bar-fill ${aluno.progressoGeral >= 95 ? 'completed' : ''}`}
                            style={{ width: `${aluno.progressoGeral}%` }}
                          />
                        </div>
                        <span className="text-sm">{aluno.progressoGeral}%</span>
                      </div>
                    </td>
                    <td className="text-muted" style={{ fontSize: '0.85rem' }}>
                      {aluno.ultimoAcesso ? new Date(aluno.ultimoAcesso).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td>
                      <span className={`badge ${aluno.ativo ? 'badge-success' : 'badge-error'}`}>
                        {aluno.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/aluno/${aluno.id}`)}>
                          Ver
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(aluno.id)}>
                          {aluno.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}
