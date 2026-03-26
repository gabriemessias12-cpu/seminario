import { useEffect, useMemo, useRef, useState } from 'react';

import AppIcon from '../../components/AppIcon';
import AvatarCropModal from '../../components/AvatarCropModal';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { downloadAuthenticatedFile } from '../../lib/auth-file';
import { apiGet, apiPut, apiFetch } from '../../lib/apiClient';

export default function StudentPerfil() {
  const { isAdmin } = useAuth();
  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editNome, setEditNome] = useState('');
  const [editTel, setEditTel] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacaoSenha, setConfirmacaoSenha] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState('');
  const [loadError, setLoadError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const loadPerfil = () => {
    setLoadError('');
    apiGet<any>('/api/aluno/perfil')
      .then((data) => {
        setPerfil(data);
        setEditNome(data.user?.nome || '');
        setEditTel(data.user?.telefone || '');
      })
      .catch(() => setLoadError('Não foi possível carregar os dados do perfil agora.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPerfil();
  }, []);

  const initials = useMemo(() => {
    return perfil?.user?.nome?.split(' ').map((item: string) => item[0]).slice(0, 2).join('').toUpperCase() || 'SV';
  }, [perfil]);

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback('');

    try {
      const data = await apiPut<any>('/api/aluno/perfil', { nome: editNome, telefone: editTel });
      setPerfil((current: any) => ({ ...current, user: { ...current.user, ...data } }));
      setFeedback('Perfil atualizado com sucesso.');
    } catch {
      setFeedback('Erro ao comunicar com o servidor.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropFile(null);
    setUploadingPhoto(true);
    setFeedback('');
    try {
      const formData = new FormData();
      formData.append('foto', blob, 'avatar.jpg');
      const response = await apiFetch('/api/aluno/perfil/foto', { method: 'PUT', body: formData });
      const data = await response.json();
      if (!response.ok) { setFeedback(data.error || 'Erro ao salvar foto.'); return; }
      setPerfil((current: any) => ({ ...current, user: { ...current.user, foto: data.foto } }));
      setFeedback('Foto atualizada com sucesso.');
    } catch {
      setFeedback('Erro ao enviar foto.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordFeedback('');

    if (novaSenha !== confirmacaoSenha) {
      setPasswordFeedback('A nova senha e a confirmação precisam ser iguais.');
      return;
    }

    setSavingPassword(true);
    try {
      await apiPut('/api/aluno/senha', { senhaAtual, novaSenha });

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

  const user = perfil?.user;

  const mediaQuiz = useMemo(() => {
    if (!perfil?.resultados?.length) return 'N/A';
    const soma = perfil.resultados.reduce((sum: number, r: any) =>
      sum + ((r.pontuacao / r.totalQuestoes) * 100), 0);
    return `${Math.round(soma / perfil.resultados.length)}%`;
  }, [perfil?.resultados]);

  const mediaAtividades = useMemo(() => {
    const media = perfil?.relatorioAcademico?.entregasResumo?.mediaNotas;
    return typeof media === 'number' ? media.toFixed(1) : 'N/A';
  }, [perfil?.relatorioAcademico?.entregasResumo?.mediaNotas]);
  const boletimPorModulo = useMemo(
    () => perfil?.relatorioAcademico?.boletimPorModulo || [],
    [perfil?.relatorioAcademico?.boletimPorModulo]
  );
  const sidebarType = isAdmin ? 'admin' : 'student';

  if (loading) {
    return (
      <div className="layout student-layout">
        <Sidebar type={sidebarType} />
        <main className="main-content student-main">
          <div className="skeleton" style={{ height: 320 }} />
        </main>
      </div>
    );
  }

  return (
    <div className="layout student-layout">
      <Sidebar type={sidebarType} />
      <main className="main-content student-main">
        {loadError && <div className="inline-feedback warning">{loadError}</div>}
        <section className="student-topbar">
          <div>
            <span className="section-kicker">Perfil</span>
            <h1 className="student-page-title">Configurações da conta</h1>
            <p className="student-page-subtitle">
              Atualize seus dados e senha com facilidade.
            </p>
          </div>
        </section>

        <section className="print-report-header print-only">
          <p>IBVN - Instituto Bíblico Vinha Nova</p>
          <h2>Boletim acadêmico do aluno</h2>
          <span>{user?.nome} | {user?.email}</span>
        </section>

        {feedback && <div className="inline-feedback success">{feedback}</div>}

        {cropFile && (
          <AvatarCropModal
            file={cropFile}
            onConfirm={handleCropConfirm}
            onCancel={() => { setCropFile(null); }}
          />
        )}

        <section className="profile-hero">
          <div className="profile-card profile-card-main">
            <div className="profile-card-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {user?.foto
                  ? <img alt="Foto de perfil" className="profile-avatar-large" loading="lazy" src={user.foto} style={{ objectFit: 'cover', borderRadius: '50%' }} />
                  : <div className="profile-avatar-large">{initials}</div>
                }
                <button
                  aria-label="Trocar foto"
                  className="avatar-upload-btn"
                  disabled={uploadingPhoto}
                  onClick={() => photoInputRef.current?.click()}
                  style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid var(--color-bg)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  type="button"
                >
                  <svg fill="none" height={13} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" width={13}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </button>
                <input accept="image/*" onChange={handlePhotoChange} ref={photoInputRef} style={{ display: 'none' }} type="file" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ wordBreak: 'break-word', marginBottom: '0.15rem' }}>{user?.nome}</h2>
                <p style={{ wordBreak: 'break-all' }}>{user?.email}</p>
                {uploadingPhoto && <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Enviando foto...</p>}
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
              <span>{saving ? 'Salvando...' : 'Salvar alterações'}</span>
            </button>
          </div>

          <div className="profile-card profile-side-stack">
            <article className="profile-summary-card">
              <span className="section-kicker">Resumo</span>
              <div className="profile-summary-list">
                <div><strong>{perfil?.progressos?.filter((item: any) => item.concluido).length || 0}</strong><span>Aulas concluídas</span></div>
                <div><strong>{mediaQuiz}</strong><span>Média nos quizzes</span></div>
                <div><strong>{mediaAtividades}</strong><span>Média nas avaliações</span></div>
                <div><strong>{perfil?.relatorioAcademico?.entregasResumo?.corrigidas || 0}</strong><span>Atividades corrigidas</span></div>
                <div><strong>{new Date(user?.criadoEm).toLocaleDateString('pt-BR')}</strong><span>Conta criada em</span></div>
              </div>
            </article>
          </div>
        </section>

        <section className="profile-grid">
          <div className="panel-card">
            <div className="student-section-header compact">
              <div>
                <span className="section-kicker">Segurança</span>
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
                <span className="section-kicker">Acadêmico</span>
                <h2>Correções recentes</h2>
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
                      {(() => {
                        const esconderResultadoObjetivo = entrega.avaliacao?.formato === 'objetiva' && entrega.avaliacao?.resultadoImediato === false;
                        return (
                          <>
                      <strong>{entrega.avaliacao?.titulo}</strong>
                      <div className="lesson-list-meta">
                        <span>{esconderResultadoObjetivo ? entrega.status : typeof entrega.nota === 'number' ? `${entrega.nota}/${entrega.avaliacao?.notaMaxima}` : entrega.status}</span>
                        <span>{entrega.avaliacao?.modulo?.titulo || entrega.avaliacao?.aula?.titulo || 'Sem vínculo'}</span>
                      </div>
                      <p>{esconderResultadoObjetivo ? 'Resultado detalhado será liberado pela equipe acadêmica.' : entrega.comentarioCorrecao || 'Aguardando comentário da equipe.'}</p>
                      {entrega.arquivoUrl && (
                        <button
                          className="text-link-button"
                          onClick={() => {
                            void downloadAuthenticatedFile(`/api/aluno/entrega-avaliacao/${entrega.id}/arquivo`).catch((error) => {
                              setFeedback(error instanceof Error ? error.message : 'Não foi possível baixar o arquivo.');
                            });
                          }}
                          type="button"
                        >
                          <AppIcon name="download" size={14} />
                          <span>Baixar arquivo enviado</span>
                        </button>
                      )}
                          </>
                        );
                      })()}
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-panel">
                  <AppIcon name="quiz" size={20} />
                  <p>Nenhuma avaliação enviada ainda.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="panel-card">
          <div className="student-section-header compact">
            <div>
              <span className="section-kicker">Boletim</span>
              <h2>Resumo acadêmico por matéria</h2>
            </div>
          </div>

          {boletimPorModulo.length ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Matéria</th>
                    <th>Atividades</th>
                    <th>Corrigidas</th>
                    <th>Pendentes</th>
                    <th>Média</th>
                  </tr>
                </thead>
                <tbody>
                  {boletimPorModulo.map((item: any) => (
                    <tr key={item.modulo}>
                      <td style={{ fontWeight: 500 }}>{item.modulo}</td>
                      <td>{item.atividades}</td>
                      <td>{item.corrigidas}</td>
                      <td>{item.pendentes}</td>
                      <td>{item.mediaNotas == null ? 'N/A' : item.mediaNotas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-panel">
              <AppIcon name="reports" size={20} />
              <p>Seu boletim acadêmico será montado conforme as correções forem sendo publicadas.</p>
            </div>
          )}
        </section>

        <section className="panel-card">
          <div className="student-section-header compact">
            <div>
              <span className="section-kicker">Frequência</span>
              <h2>Frequência por matéria</h2>
            </div>
          </div>

          {perfil?.relatorioAcademico?.frequenciaPorModulo?.length ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Matéria</th>
                    <th>Frequência</th>
                    <th>Presentes</th>
                    <th>Parciais</th>
                    <th>Ausências</th>
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
              <p>Nenhum dado de frequência consolidado ainda.</p>
            </div>
          )}
        </section>

        <section className="panel-card">
          <div className="student-section-header compact">
            <div>
              <span className="section-kicker">Progresso</span>
              <h2>Histórico de aulas</h2>
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
                        {progresso.concluido ? 'Concluída' : 'Em andamento'}
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
