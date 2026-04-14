import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/apiClient';
import type { AlunoListItem, StatusCadastroAluno } from '../../types/models';

function ProgressCell({ value }: { value: number }) {
  return (
    <div className="chart-inline-progress">
      <div className="progress-bar">
        <div
          className={`progress-bar-fill ${value >= 95 ? 'completed' : ''}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-sm">{value}%</span>
    </div>
  );
}

function cadastroStatusLabel(status: StatusCadastroAluno) {
  if (status === 'pendente') return 'Pendente';
  if (status === 'rejeitado') return 'Rejeitado';
  return 'Aprovado';
}

function cadastroStatusClassName(status: StatusCadastroAluno) {
  if (status === 'pendente') return 'badge-warning';
  if (status === 'rejeitado') return 'badge-error';
  return 'badge-success';
}

function formatDate(dateValue?: string | null) {
  if (!dateValue) return '-';
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('pt-BR');
}

export default function AdminAlunos() {
  const navigate = useNavigate();
  const [alunos, setAlunos] = useState<AlunoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('123456');
  const [dataNascimento, setDataNascimento] = useState('');
  const [membroVinha, setMembroVinha] = useState(false);
  const [batizado, setBatizado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [loadError, setLoadError] = useState('');

  const loadAlunos = () => {
    setLoadError('');
    apiGet<AlunoListItem[]>('/api/admin/alunos')
      .then(setAlunos)
      .catch(() => setLoadError('Nao foi possivel carregar a lista de alunos agora.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlunos();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filtered = useMemo(
    () => alunos.filter((aluno) => (
      aluno.nome.toLowerCase().includes(debouncedSearch.toLowerCase())
      || aluno.email.toLowerCase().includes(debouncedSearch.toLowerCase())
    )),
    [alunos, debouncedSearch]
  );

  const pendentesCount = useMemo(
    () => alunos.filter((aluno) => aluno.statusCadastro === 'pendente').length,
    [alunos]
  );

  const toggleStatus = async (id: string) => {
    try {
      await apiPut(`/api/admin/aluno/${id}/toggle`);
      setAlunos((current) => current.map((aluno) => (
        aluno.id === id ? { ...aluno, ativo: !aluno.ativo } : aluno
      )));
    } catch {
      setFeedback('Nao foi possivel atualizar o status do aluno.');
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    setFeedback('');
    try {
      await apiPut(`/api/admin/aluno/${id}/aprovar`);
      setAlunos((current) => current.map((aluno) => (
        aluno.id === id ? { ...aluno, statusCadastro: 'aprovado', ativo: true } : aluno
      )));
      setFeedback('Cadastro aprovado com sucesso.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Nao foi possivel aprovar o cadastro.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Confirmar rejeicao deste cadastro?')) {
      return;
    }

    setProcessingId(id);
    setFeedback('');
    try {
      await apiPut(`/api/admin/aluno/${id}/rejeitar`);
      setAlunos((current) => current.map((aluno) => (
        aluno.id === id ? { ...aluno, statusCadastro: 'rejeitado', ativo: false } : aluno
      )));
      setFeedback('Cadastro rejeitado.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Nao foi possivel rejeitar o cadastro.');
    } finally {
      setProcessingId(null);
    }
  };

  const deleteAluno = async (id: string) => {
    if (!window.confirm('Excluir aluno permanentemente? Esta acao remove o acesso e os dados do aluno.')) {
      return;
    }

    setDeletingId(id);
    setFeedback('');

    try {
      await apiDelete(`/api/admin/aluno/${id}`);
      setAlunos((current) => current.filter((aluno) => aluno.id !== id));
      setFeedback('Aluno excluido com sucesso.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Nao foi possivel excluir o aluno.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateStudent = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFeedback('');

    try {
      const data = await apiPost<{ senhaTemporaria?: string }>('/api/admin/aluno', {
        nome,
        email,
        telefone,
        senha,
        dataNascimento: dataNascimento || undefined,
        membroVinha,
        batizado
      });
      setFeedback(`Aluno criado com sucesso. Senha temporaria: ${data.senhaTemporaria ?? '(definida pelo admin)'}`);
      setNome('');
      setEmail('');
      setTelefone('');
      setSenha('123456');
      setDataNascimento('');
      setMembroVinha(false);
      setBatizado(false);
      setShowForm(false);
      loadAlunos();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao comunicar com o servidor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header page-header-split">
        <div>
          <h1>Gestao de Alunos</h1>
          <p>{alunos.length} alunos cadastrados · {pendentesCount} pendentes de aprovacao</p>
        </div>
        <button className="btn btn-accent" onClick={() => setShowForm((current) => !current)} type="button">
          {showForm ? 'Fechar cadastro' : '+ Cadastrar aluno'}
        </button>
      </div>

      {loadError && <div className="inline-feedback warning">{loadError}</div>}
      {feedback && <div className="inline-feedback warning">{feedback}</div>}

      {showForm && (
        <div className="card mb-3 page-surface-narrow">
          <h3 className="section-title">Novo aluno</h3>
          <form onSubmit={handleCreateStudent}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Nome completo</label>
                <input className="form-input" value={nome} onChange={(event) => setNome(event.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Data de nascimento</label>
                <input className="form-input" type="date" value={dataNascimento} onChange={(event) => setDataNascimento(event.target.value)} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Senha inicial</label>
                <input className="form-input" value={senha} onChange={(event) => setSenha(event.target.value)} required />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input
                  className="form-input"
                  value={telefone}
                  onChange={(event) => setTelefone(event.target.value)}
                  placeholder="(11) 99999-0000"
                />
              </div>
              <div className="form-group" style={{ display: 'grid', gap: '0.6rem' }}>
                <label className="form-label">Pertence a Vinha Nova?</label>
                <select className="form-input" value={membroVinha ? 'sim' : 'nao'} onChange={(event) => setMembroVinha(event.target.value === 'sim')}>
                  <option value="nao">Nao</option>
                  <option value="sim">Sim</option>
                </select>
                <label className="form-label">Batizado?</label>
                <select className="form-input" value={batizado ? 'sim' : 'nao'} onChange={(event) => setBatizado(event.target.value === 'sim')}>
                  <option value="nao">Nao</option>
                  <option value="sim">Sim</option>
                </select>
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
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome ou email"
          aria-label="Buscar alunos por nome ou email"
        />
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 300 }} />
      ) : (
        <>
          <div className="table-container admin-desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Email</th>
                  <th>Cadastro</th>
                  <th>Aulas</th>
                  <th>Avaliacoes</th>
                  <th>Geral</th>
                  <th>Atrasos</th>
                  <th>Ultimo acesso</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((aluno) => (
                    <tr key={aluno.id}>
                      <td>
                        <div className="table-entity">
                          <div className="table-entity-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                            {aluno.foto ? (
                              <img
                                alt=""
                                loading="lazy"
                                src={aluno.foto}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              />
                            ) : (
                              aluno.nome?.[0]
                            )}
                          </div>
                          <div className="table-entity-copy">
                            <strong>{aluno.nome}</strong>
                            <span className="text-muted text-sm">Nascimento: {formatDate(aluno.dataNascimento)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="text-muted">{aluno.email}</td>
                      <td>
                        <div style={{ display: 'grid', gap: '0.35rem' }}>
                          <span className={`badge ${cadastroStatusClassName(aluno.statusCadastro)}`}>
                            {cadastroStatusLabel(aluno.statusCadastro)}
                          </span>
                          <span className={`badge ${aluno.ativo ? 'badge-success' : 'badge-error'}`}>
                            {aluno.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </td>
                      <td><ProgressCell value={aluno.progressoAulas} /></td>
                      <td><ProgressCell value={aluno.progressoAvaliacoes} /></td>
                      <td><ProgressCell value={aluno.progressoGeral} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {aluno.aulasAtrasadas > 0 && <span className="badge badge-error">{aluno.aulasAtrasadas} aulas</span>}
                          {aluno.avaliacoesAtrasadas > 0 && <span className="badge badge-warning">{aluno.avaliacoesAtrasadas} avaliacoes</span>}
                          {aluno.aulasAtrasadas === 0 && aluno.avaliacoesAtrasadas === 0 && (
                            <span className="badge badge-success">Em dia</span>
                          )}
                        </div>
                      </td>
                      <td className="text-muted" style={{ fontSize: '0.85rem' }}>
                        {aluno.ultimoAcesso ? new Date(aluno.ultimoAcesso).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/aluno/${aluno.id}`)} type="button">
                            Ver
                          </button>

                          {aluno.statusCadastro === 'pendente' ? (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => handleApprove(aluno.id)} disabled={processingId === aluno.id} type="button">
                                {processingId === aluno.id ? 'Salvando...' : 'Aprovar'}
                              </button>
                              <button className="btn btn-ghost btn-sm" onClick={() => handleReject(aluno.id)} disabled={processingId === aluno.id} type="button" style={{ color: 'var(--color-error, #ef4444)' }}>
                                Rejeitar
                              </button>
                            </>
                          ) : (
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(aluno.id)} type="button">
                              {aluno.ativo ? 'Desativar' : 'Ativar'}
                            </button>
                          )}

                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--color-error, #ef4444)' }}
                            onClick={() => deleteAluno(aluno.id)}
                            disabled={deletingId === aluno.id}
                            type="button"
                          >
                            {deletingId === aluno.id ? 'Excluindo...' : 'Excluir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="text-muted" colSpan={9}>
                      Nenhum aluno corresponde ao filtro atual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="admin-card-list">
            {filtered.length ? (
              filtered.map((aluno) => (
                <div className="admin-list-card" key={aluno.id}>
                  <div className="admin-list-card-header">
                    <div className="table-entity-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                      {aluno.foto ? (
                        <img
                          alt=""
                          loading="lazy"
                          src={aluno.foto}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        aluno.nome?.[0]
                      )}
                    </div>
                    <div className="admin-list-card-info">
                      <strong>{aluno.nome}</strong>
                      <span className="text-muted text-sm">{aluno.email}</span>
                      <span className="text-muted text-sm">Nascimento: {formatDate(aluno.dataNascimento)}</span>
                      <span className="text-muted text-sm">
                        {aluno.ultimoAcesso ? new Date(aluno.ultimoAcesso).toLocaleDateString('pt-BR') : 'Sem acesso'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: '0.35rem' }}>
                      <span className={`badge ${cadastroStatusClassName(aluno.statusCadastro)}`}>
                        {cadastroStatusLabel(aluno.statusCadastro)}
                      </span>
                      <span className={`badge ${aluno.ativo ? 'badge-success' : 'badge-error'}`}>
                        {aluno.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <div>
                      <span className="text-muted text-sm">Aulas</span>
                      <ProgressCell value={aluno.progressoAulas} />
                    </div>
                    <div>
                      <span className="text-muted text-sm">Avaliacoes</span>
                      <ProgressCell value={aluno.progressoAvaliacoes} />
                    </div>
                    <div>
                      <span className="text-muted text-sm">Geral</span>
                      <ProgressCell value={aluno.progressoGeral} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
                    {aluno.aulasAtrasadas > 0 && <span className="badge badge-error">{aluno.aulasAtrasadas} aulas atrasadas</span>}
                    {aluno.avaliacoesAtrasadas > 0 && <span className="badge badge-warning">{aluno.avaliacoesAtrasadas} avaliacoes atrasadas</span>}
                    {aluno.aulasAtrasadas === 0 && aluno.avaliacoesAtrasadas === 0 && (
                      <span className="badge badge-success">Sem atrasos</span>
                    )}
                  </div>

                  <div className="admin-list-card-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admin/aluno/${aluno.id}`)} type="button">
                      Ver detalhes
                    </button>

                    {aluno.statusCadastro === 'pendente' ? (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => handleApprove(aluno.id)} disabled={processingId === aluno.id} type="button">
                          {processingId === aluno.id ? 'Salvando...' : 'Aprovar'}
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error, #ef4444)' }} onClick={() => handleReject(aluno.id)} disabled={processingId === aluno.id} type="button">
                          Rejeitar
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(aluno.id)} type="button">
                        {aluno.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    )}

                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-error, #ef4444)' }}
                      onClick={() => deleteAluno(aluno.id)}
                      disabled={deletingId === aluno.id}
                      type="button"
                    >
                      {deletingId === aluno.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted">Nenhum aluno corresponde ao filtro atual.</p>
            )}
          </div>
        </>
      )}
    </>
  );
}
