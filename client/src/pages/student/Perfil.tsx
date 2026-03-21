import { FormEvent, useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import AppIcon from '../../components/AppIcon';

export default function StudentPerfil() {
  const token = localStorage.getItem('accessToken');
  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editNome, setEditNome] = useState('');
  const [editTel, setEditTel] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacaoSenha, setConfirmacaoSenha] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState('');

  const loadPerfil = () => {
    fetch('/api/aluno/perfil', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((response) => response.json())
      .then((data) => {
        setPerfil(data);
        setEditNome(data.user?.nome || '');
        setEditTel(data.user?.telefone || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPerfil();
  }, []);

  const initials = useMemo(() => {
    return perfil?.user?.nome?.split(' ').map((item: string) => item[0]).slice(0, 2).join('').toUpperCase() || 'SV';
  }, [perfil]);

  const handleSave = async () => {
    setSaving(true);
    setFeedback('');

    try {
      const response = await fetch('/api/aluno/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nome: editNome, telefone: editTel })
      });
      const data = await response.json();

      if (!response.ok) {
        setFeedback(data.error || 'Nao foi possivel atualizar o perfil.');
        return;
      }

      setPerfil((current: any) => ({
        ...current,
        user: { ...current.user, ...data }
      }));
      setFeedback('Perfil atualizado com sucesso.');
    } catch {
      setFeedback('Erro ao comunicar com o servidor.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordFeedback('');

    if (novaSenha !== confirmacaoSenha) {
      setPasswordFeedback('A nova senha e a confirmacao precisam ser iguais.');
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch('/api/aluno/senha', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ senhaAtual, novaSenha })
      });
      const data = await response.json();

      if (!response.ok) {
        setPasswordFeedback(data.error || 'Nao foi possivel alterar a senha.');
        return;
      }

      setSenhaAtual('');
      setNovaSenha('');
      setConfirmacaoSenha('');
      setPasswordFeedback('Senha alterada com sucesso.');
    } catch {
      setPasswordFeedback('Erro ao comunicar com o servidor.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="layout student-layout">
        <Sidebar type="student" />
        <main className="main-content student-main">
          <div className="skeleton" style={{ height: 320 }} />
        </main>
      </div>
    );
  }

  const user = perfil?.user;
  const mediaQuiz = perfil?.resultados?.length
    ? `${Math.round(perfil.resultados.reduce((sum: number, resultado: any) => sum + ((resultado.pontuacao / resultado.totalQuestoes) * 100), 0) / perfil.resultados.length)}%`
    : 'N/A';
  const mediaAtividades = typeof perfil?.relatorioAcademico?.entregasResumo?.mediaNotas === 'number'
    ? perfil.relatorioAcademico.entregasResumo.mediaNotas.toFixed(1)
    : 'N/A';

  return (
    <div className="layout student-layout">
      <Sidebar type="student" />
      <main className="main-content student-main">
        <section className="student-topbar">
          <div>
            <span className="section-kicker">Perfil</span>
            <h1 className="student-page-title">Configuracoes da conta</h1>
            <p className="student-page-subtitle">
              Atualize seus dados e senha com facilidade.
            </p>
          </div>
        </section>

        {feedback && <div className="inline-feedback success">{feedback}</div>}

        <section className="profile-hero">
          <div className="profile-card profile-card-main">
            <div className="profile-card-header">
              <div className="profile-avatar-large">{initials}</div>
              <div>
                <h2>{user?.nome}</h2>
                <p>{user?.email}</p>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Nome completo</label>
                <input className="form-input" value={editNome} onChange={(event) => setEditNome(event.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="form-input" value={editTel} onChange={(event) => setEditTel(event.target.value)} placeholder="(11) 99999-0000" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input className="form-input" value={user?.email || ''} disabled />
            </div>

            <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving}>
              <AppIcon name="check" size={14} />
              <span>{saving ? 'Salvando...' : 'Salvar alteracoes'}</span>
            </button>
          </div>

          <div className="profile-card profile-side-stack">
            <article className="profile-summary-card">
              <span className="section-kicker">Resumo</span>
              <div className="profile-summary-list">
                <div><strong>{perfil?.progressos?.filter((item: any) => item.concluido).length || 0}</strong><span>Aulas concluidas</span></div>
                <div><strong>{mediaQuiz}</strong><span>Media nos quizzes</span></div>
                <div><strong>{mediaAtividades}</strong><span>Media nas avaliacoes</span></div>
                <div><strong>{new Date(user?.criadoEm).toLocaleDateString('pt-BR')}</strong><span>Conta criada em</span></div>
              </div>
            </article>
          </div>
        </section>

        <section className="profile-grid">
          <div className="panel-card">
            <div className="student-section-header compact">
              <div>
                <span className="section-kicker">Seguranca</span>
                <h2>Alterar senha</h2>
              </div>
            </div>

            {passwordFeedback && (
              <div className={`inline-feedback ${passwordFeedback.includes('sucesso') ? 'success' : 'warning'}`}>
                {passwordFeedback}
              </div>
            )}

            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label className="form-label">Senha atual</label>
                <input type="password" className="form-input" value={senhaAtual} onChange={(event) => setSenhaAtual(event.target.value)} required />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Nova senha</label>
                  <input type="password" className="form-input" value={novaSenha} onChange={(event) => setNovaSenha(event.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirmar nova senha</label>
                  <input type="password" className="form-input" value={confirmacaoSenha} onChange={(event) => setConfirmacaoSenha(event.target.value)} required />
                </div>
              </div>
              <button className="btn btn-outline" type="submit" disabled={savingPassword}>
                <AppIcon name="shield" size={14} />
                <span>{savingPassword ? 'Atualizando...' : 'Atualizar senha'}</span>
              </button>
            </form>
          </div>

          <div className="panel-card">
            <div className="student-section-header compact">
              <div>
                <span className="section-kicker">Academico</span>
                <h2>Correcoes recentes</h2>
              </div>
            </div>

            <div className="lesson-list">
              {perfil?.entregasAvaliacao?.length ? (
                perfil.entregasAvaliacao.slice(0, 6).map((entrega: any) => (
                  <article className="lesson-list-item lesson-list-item-advanced" key={entrega.id}>
                    <div className="lesson-index-circle">
                      <AppIcon name="quiz" size={14} />
                    </div>
                    <div className="lesson-list-content">
                      <strong>{entrega.avaliacao?.titulo}</strong>
                      <div className="lesson-list-meta">
                        <span>{typeof entrega.nota === 'number' ? `${entrega.nota}/${entrega.avaliacao?.notaMaxima}` : entrega.status}</span>
                        <span>{entrega.avaliacao?.modulo?.titulo || entrega.avaliacao?.aula?.titulo || 'Sem vinculo'}</span>
                      </div>
                      <p>{entrega.comentarioCorrecao || 'Aguardando comentario da equipe.'}</p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-panel">
                  <AppIcon name="quiz" size={20} />
                  <p>Nenhuma avaliacao enviada ainda.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="panel-card">
          <div className="student-section-header compact">
            <div>
              <span className="section-kicker">Frequencia</span>
              <h2>Frequencia por materia</h2>
            </div>
          </div>

          {perfil?.relatorioAcademico?.frequenciaPorModulo?.length ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Materia</th>
                    <th>Frequencia</th>
                    <th>Presentes</th>
                    <th>Parciais</th>
                    <th>Ausencias</th>
                  </tr>
                </thead>
                <tbody>
                  {perfil.relatorioAcademico.frequenciaPorModulo.map((item: any) => (
                    <tr key={item.moduloId}>
                      <td style={{ fontWeight: 500 }}>{item.modulo}</td>
                      <td>
                        <span className={`badge ${item.frequenciaPercentual >= 75 ? 'badge-success' : item.frequenciaPercentual >= 50 ? 'badge-warning' : 'badge-error'}`}>
                          {item.frequenciaPercentual}%
                        </span>
                      </td>
                      <td>{item.presencasPresentes}</td>
                      <td>{item.presencasParciais}</td>
                      <td>{item.presencasAusentes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-panel">
              <AppIcon name="attendance" size={20} />
              <p>Nenhum dado de frequencia consolidado ainda.</p>
            </div>
          )}
        </section>

        <section className="panel-card">
          <div className="student-section-header compact">
            <div>
              <span className="section-kicker">Progresso</span>
              <h2>Historico de aulas</h2>
            </div>
          </div>

          {perfil?.progressos?.length ? (
            <div className="lesson-list">
              {perfil.progressos.map((progresso: any) => (
                <article className="lesson-list-item lesson-list-item-advanced" key={progresso.id}>
                  <div className="lesson-index-circle">
                    <AppIcon name={progresso.concluido ? 'check' : 'play'} size={14} />
                  </div>
                  <div className="lesson-list-content">
                    <div className="lesson-list-title-row">
                      <strong>{progresso.aula?.titulo}</strong>
                      <span className={`badge ${progresso.concluido ? 'badge-success' : 'badge-warning'}`}>
                        {progresso.concluido ? 'Concluida' : 'Em andamento'}
                      </span>
                    </div>
                    <p>{progresso.aula?.modulo?.titulo}</p>
                    <div className="progress-bar">
                      <div className={`progress-bar-fill ${progresso.concluido ? 'completed' : ''}`} style={{ width: `${progresso.percentualAssistido}%` }} />
                    </div>
                  </div>
                  <span>{Math.round(progresso.percentualAssistido)}%</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <AppIcon name="play" size={20} />
              <p>Nenhuma aula acessada ainda.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
