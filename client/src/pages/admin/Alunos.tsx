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
  const [loadError, setLoadError] = useState('');

  const loadAlunos = () => {
    setLoadError('');
    fetch('/api/admin/alunos', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setAlunos)
      .catch(() => setLoadError('Nao foi possivel carregar a lista de alunos agora.'))
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
    try {
      await fetch(`/api/admin/aluno/${id}/toggle`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });

      setAlunos((current) => current.map((aluno) => (
        aluno.id === id ? { ...aluno, ativo: !aluno.ativo } : aluno
      )));
    } catch {
      setFeedback('Nao foi possivel atualizar o status do aluno.');
    }
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
        <div className="page-header page-header-split">
          <div>
            <h1>Gestao de Alunos</h1>
            <p>{alunos.length} alunos cadastrados</p>
          </div>
          <button className="btn btn-accent" onClick={() => setShowForm((current) => !current)} type="button">
            {showForm ? 'Fechar cadastro' : '+ Cadastrar aluno'}
          </button>
        </div>

        {loadError && <div className="inline-feedback warning">{loadError}</div>}

        {feedback && (
          <div className="inline-feedback warning">
            {feedback}
          </div>
        )}

        {showForm && (
          <div className="card mb-3 page-surface-narrow">
            <h3 className="section-title">Novo aluno</h3>
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
            aria-label="Buscar alunos por nome ou email"
          />
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 300 }} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="table-container admin-desktop-table">
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
                  {filtered.length ? filtered.map((aluno) => (
                    <tr key={aluno.id}>
                      <td>
                        <div className="table-entity">
                          <div className="table-entity-avatar">{aluno.nome?.[0]}</div>
                          <div className="table-entity-copy">
                            <strong>{aluno.nome}</strong>
                          </div>
                        </div>
                      </td>
                      <td className="text-muted">{aluno.email}</td>
                      <td>
                        <div className="chart-inline-progress">
                          <div className="progress-bar">
                            <div className={`progress-bar-fill ${aluno.progressoGeral >= 95 ? 'completed' : ''}`} style={{ width: `${aluno.progressoGeral}%` }} />
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
                        <div className="table-actions">
                          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/aluno/${aluno.id}`)} type="button">Ver</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(aluno.id)} type="button">
                            {aluno.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td className="text-muted" colSpan={6}>Nenhum aluno corresponde ao filtro atual.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="admin-card-list">
              {filtered.length ? filtered.map((aluno) => (
                <div className="admin-list-card" key={aluno.id}>
                  <div className="admin-list-card-header">
                    <div className="table-entity-avatar">{aluno.nome?.[0]}</div>
                    <div className="admin-list-card-info">
                      <strong>{aluno.nome}</strong>
                      <span className="text-muted text-sm">{aluno.email}</span>
                      <span className="text-muted text-sm">
                        {aluno.ultimoAcesso ? new Date(aluno.ultimoAcesso).toLocaleDateString('pt-BR') : 'Sem acesso'}
                      </span>
                    </div>
                    <span className={`badge ${aluno.ativo ? 'badge-success' : 'badge-error'}`}>
                      {aluno.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="chart-inline-progress">
                    <div className="progress-bar" style={{ flex: 1 }}>
                      <div className={`progress-bar-fill ${aluno.progressoGeral >= 95 ? 'completed' : ''}`} style={{ width: `${aluno.progressoGeral}%` }} />
                    </div>
                    <span className="text-sm">{aluno.progressoGeral}%</span>
                  </div>
                  <div className="admin-list-card-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/aluno/${aluno.id}`)} type="button">Ver detalhes</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(aluno.id)} type="button">
                      {aluno.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              )) : (
                <p className="text-muted">Nenhum aluno corresponde ao filtro atual.</p>
              )}
            </div>
          </>
        )}
    </>
  );
}
