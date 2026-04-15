import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import AppIcon from '../../components/AppIcon';
import AvatarCropModal from '../../components/AvatarCropModal';
import { downloadAuthenticatedFile } from '../../lib/auth-file';
import { apiFetch, apiGet, apiPut } from '../../lib/apiClient';

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : 'Sem data';
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

function formatDelay(days?: number | null) {
  if (!days) {
    return 'Em dia';
  }

  return `${days} ${days === 1 ? 'dia' : 'dias'} de atraso`;
}

export default function AdminAlunoDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aluno, setAluno] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [loadError, setLoadError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [novaSenhaAdmin, setNovaSenhaAdmin] = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;
    setCropFile(file);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropFile(null);
    if (!id) return;
    setUploadingPhoto(true);
    setFeedback('');

    try {
      const formData = new FormData();
      formData.append('foto', blob, 'avatar.jpg');
      const response = await apiFetch(`/api/admin/aluno/${id}/foto`, { method: 'PUT', body: formData });
      const data = await response.json();

      if (!response.ok) {
        setFeedback(data.error || 'Erro ao salvar foto.');
        return;
      }

      setAluno((current: any) => ({ ...current, foto: data.foto }));
    } catch {
      setFeedback('Erro ao enviar foto.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveStudentProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!id) return;

    setSavingProfile(true);
    setFeedback('');

    try {
      const atualizado = await apiPut<any>(`/api/admin/aluno/${id}`, {
        nome: editNome,
        email: editEmail,
        telefone: editTelefone
      });
      setAluno((current: any) => ({ ...current, ...atualizado }));
      setEditNome(atualizado.nome || '');
      setEditEmail(atualizado.email || '');
      setEditTelefone(atualizado.telefone || '');
      setFeedback('Dados do aluno atualizados com sucesso.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Erro ao atualizar dados do aluno.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateStudentPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!id) return;

    if (novaSenhaAdmin.trim().length < 6) {
      setFeedback('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setSavingPassword(true);
    setFeedback('');

    try {
      await apiPut(`/api/admin/aluno/${id}`, { senha: novaSenhaAdmin });
      setNovaSenhaAdmin('');
      setFeedback('Senha do aluno atualizada com sucesso.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Erro ao atualizar senha do aluno.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    apiGet(`/api/admin/aluno/${id}`)
      .then((data: any) => {
        setAluno(data);
        setEditNome(data.nome || '');
        setEditEmail(data.email || '');
        setEditTelefone(data.telefone || '');
      })
      .catch(() => setLoadError('Nao foi possivel carregar o relatorio do aluno.'))
      .finally(() => setLoading(false));
  }, [id]);

  const painel = aluno?.painelProgresso;
  const painelAulas = painel?.aulas || [];
  const painelAvaliacoes = painel?.avaliacoes || [];
  const progressosPorAula = useMemo<Map<string, any>>(
    () => new Map((aluno?.progressos || []).map((progresso: any) => [progresso.aulaId, progresso])),
    [aluno?.progressos]
  );

  if (loading) {
    return (
      <>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div className="skeleton skeleton-title" />
        </div>
        <div className="skeleton skeleton-card" style={{ height: 400 }} />
      </>
    );
  }

  if (!aluno) {
    return (
      <div className="empty-panel">
        <AppIcon name="students" size={20} />
        <p>Aluno nao encontrado.</p>
      </div>
    );
  }

  const initials = aluno.nome?.split(' ').map((item: string) => item[0]).slice(0, 2).join('').toUpperCase() || 'SV';
  const avgAcademic = typeof aluno.relatorioAcademico?.entregasResumo?.mediaNotas === 'number'
    ? aluno.relatorioAcademico.entregasResumo.mediaNotas.toFixed(1)
    : 'N/A';
  const mediaQuiz = aluno.resultadosQuiz?.length
    ? `${Math.round(aluno.resultadosQuiz.reduce((sum: number, item: any) => (
        sum + ((item.pontuacao / item.totalQuestoes) * 100)
      ), 0) / aluno.resultadosQuiz.length)}%`
    : 'N/A';
  const boletimPorModulo = aluno.relatorioAcademico?.boletimPorModulo || [];

  return (
    <>
      {(feedback || loadError) && <div className="inline-feedback warning">{feedback || loadError}</div>}

      <div className="page-header page-header-split print-hide">
        <button className="btn btn-ghost" onClick={() => navigate('/admin/alunos')} type="button">
          <AppIcon name="arrow-left" size={14} />
          <span>Voltar para lista</span>
        </button>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={handlePrint} type="button">
            <AppIcon name="reports" size={14} />
            <span>Imprimir relatorio</span>
          </button>
        </div>
      </div>

      <section className="print-report-header print-only">
        <p>IBVN - Instituto Bíblico Vinha Nova</p>
        <h2>Relatório acadêmico do aluno</h2>
        <span>{aluno.nome} | {aluno.email}</span>
      </section>

      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}

      <div className="card mb-3">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {aluno.foto ? (
              <img
                alt="Foto do aluno"
                src={aluno.foto}
                style={{ width: 72, height: 72, borderRadius: 'var(--radius-lg)', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  color: 'white'
                }}
              >
                {initials}
              </div>
            )}
            <button
              aria-label="Trocar foto"
              disabled={uploadingPhoto}
              onClick={() => photoInputRef.current?.click()}
              style={{
                position: 'absolute',
                bottom: -6,
                right: -6,
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--color-primary)',
                border: '2px solid var(--color-bg)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0
              }}
              title={uploadingPhoto ? 'Enviando...' : 'Trocar foto'}
              type="button"
            >
              <svg fill="none" height={12} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" width={12}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
            <input accept="image/*" onChange={handlePhotoChange} ref={photoInputRef} style={{ display: 'none' }} type="file" />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.15rem', wordBreak: 'break-word' }}>{aluno.nome}</h2>
            <p className="text-muted" style={{ wordBreak: 'break-all' }}>{aluno.email} · {aluno.telefone || 'Sem telefone'}</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span className={`badge ${aluno.ativo ? 'badge-success' : 'badge-error'}`}>{aluno.ativo ? 'Ativo' : 'Inativo'}</span>
              <span className="badge badge-purple">{aluno.papel}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <h3 className="section-title">Gerenciar cadastro</h3>
        <form onSubmit={handleSaveStudentProfile}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input className="form-input" onChange={(event) => setEditNome(event.target.value)} required value={editNome} />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input className="form-input" onChange={(event) => setEditTelefone(event.target.value)} value={editTelefone} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" onChange={(event) => setEditEmail(event.target.value)} required type="email" value={editEmail} />
          </div>
          <button className="btn btn-primary" disabled={savingProfile} type="submit">
            <AppIcon name="check" size={14} />
            <span>{savingProfile ? 'Salvando...' : 'Salvar dados do aluno'}</span>
          </button>
        </form>

        <form className="mt-3" onSubmit={handleUpdateStudentPassword}>
          <div className="form-group">
            <label className="form-label">Redefinir senha do aluno</label>
            <input
              className="form-input"
              minLength={6}
              onChange={(event) => setNovaSenhaAdmin(event.target.value)}
              placeholder="Informe a nova senha"
              type="password"
              value={novaSenhaAdmin}
            />
          </div>
          <button className="btn btn-outline" disabled={savingPassword} type="submit">
            <AppIcon name="shield" size={14} />
            <span>{savingPassword ? 'Atualizando...' : 'Atualizar senha do aluno'}</span>
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { icon: 'library' as const, className: 'purple', value: `${painel?.progressoAulas.percentual || 0}%`, label: 'Progresso em aulas' },
          { icon: 'quiz' as const, className: 'orange', value: `${painel?.progressoAvaliacoes.percentual || 0}%`, label: 'Progresso em avaliacoes' },
          { icon: 'reports' as const, className: 'green', value: `${painel?.progressoGeral || 0}%`, label: 'Progresso geral' },
          { icon: 'alert-triangle' as const, className: 'blue', value: painel?.aulasAtrasadas.length || 0, label: 'Aulas atrasadas' },
          { icon: 'clock' as const, className: 'blue', value: painel?.avaliacoesPendentesAtrasadas.length || 0, label: 'Avaliacoes atrasadas' },
          { icon: 'target' as const, className: 'purple', value: mediaQuiz, label: 'Media quizzes' },
          { icon: 'quiz' as const, className: 'purple', value: avgAcademic, label: 'Media avaliacoes' }
        ].map((item) => (
          <div className="stat-card" key={item.label}>
            <div className={`stat-icon ${item.className}`}><AppIcon name={item.icon} size={18} /></div>
            <div>
              <div className="stat-value">{item.value}</div>
              <div className="stat-label">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {(painel?.aulasAtrasadas.length || painel?.avaliacoesPendentesAtrasadas.length) ? (
        <div className="grid-2 mb-3">
          <div className="card">
            <h3 className="section-title">Aulas atrasadas</h3>
            {painel.aulasAtrasadas.length ? (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {painel.aulasAtrasadas.map((aula: any) => (
                  <div key={aula.aulaId} style={{ border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, padding: '0.85rem 1rem' }}>
                    <strong>{aula.titulo}</strong>
                    <p className="text-muted text-sm" style={{ margin: '0.35rem 0' }}>
                      {aula.modulo} · Publicada em {formatDate(aula.dataPublicacao)}
                    </p>
                    <span className="badge badge-error">{formatDelay(aula.diasAtraso)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm">Nenhuma aula atrasada no momento.</p>
            )}
          </div>

          <div className="card">
            <h3 className="section-title">Avaliacoes atrasadas</h3>
            {painel.avaliacoesPendentesAtrasadas.length ? (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {painel.avaliacoesPendentesAtrasadas.map((avaliacao: any) => (
                  <div key={avaliacao.avaliacaoId} style={{ border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '0.85rem 1rem' }}>
                    <strong>{avaliacao.titulo}</strong>
                    <p className="text-muted text-sm" style={{ margin: '0.35rem 0' }}>
                      {avaliacao.modulo} · Prazo {formatDate(avaliacao.dataLimite)}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className={`badge ${avaliacao.tipo === 'prova' ? 'badge-warning' : 'badge-info'}`}>{avaliacao.tipo}</span>
                      <span className="badge badge-error">{formatDelay(avaliacao.diasAtraso)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm">Nenhuma avaliacao atrasada no momento.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="card mb-3">
        <h3 className="section-title">Progresso por aula</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Aula</th>
                <th>Modulo</th>
                <th>Publicada</th>
                <th>Progresso</th>
                <th>Sessoes</th>
                <th>Pausas</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {painelAulas.map((aula: any) => {
                const progressoDetalhado = progressosPorAula.get(aula.aulaId);

                return (
                  <tr key={aula.aulaId}>
                    <td style={{ fontWeight: 500 }}>{aula.titulo}</td>
                    <td className="text-muted">{aula.modulo}</td>
                    <td className="text-muted">{formatDate(aula.dataPublicacao)}</td>
                    <td>
                      <div className="chart-inline-progress">
                        <div className="progress-bar">
                          <div className={`progress-bar-fill ${aula.concluido ? 'completed' : ''}`} style={{ width: `${aula.percentualAssistido}%` }} />
                        </div>
                        <span className="text-sm">{aula.percentualAssistido}%</span>
                      </div>
                    </td>
                    <td>{progressoDetalhado?.sessoes || 0}</td>
                    <td>{progressoDetalhado?.vezesQueParou || 0}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span className={`badge ${aula.concluido ? 'badge-success' : aula.percentualAssistido > 0 ? 'badge-warning' : 'badge-info'}`}>
                          {aula.concluido ? 'Concluida' : aula.percentualAssistido > 0 ? 'Em progresso' : 'Nao iniciada'}
                        </span>
                        {aula.atrasada && <span className="badge badge-error">{formatDelay(aula.diasAtraso)}</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mb-3">
        <h3 className="section-title">Progresso por avaliacao</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Avaliacao</th>
                <th>Tipo</th>
                <th>Vinculo</th>
                <th>Prazo</th>
                <th>Status</th>
                <th>Atraso</th>
              </tr>
            </thead>
            <tbody>
              {painelAvaliacoes.map((avaliacao: any) => (
                <tr key={avaliacao.avaliacaoId}>
                  <td style={{ fontWeight: 500 }}>{avaliacao.titulo}</td>
                  <td>{avaliacao.tipo}</td>
                  <td className="text-muted">{avaliacao.modulo}</td>
                  <td className="text-muted">{formatDate(avaliacao.dataLimite)}</td>
                  <td>
                    <span className={`badge ${avaliacao.concluido ? 'badge-success' : avaliacao.atrasada ? 'badge-error' : 'badge-warning'}`}>
                      {avaliacao.statusEntrega}
                    </span>
                  </td>
                  <td>
                    {avaliacao.atrasada ? (
                      <span className="badge badge-error">{formatDelay(avaliacao.diasAtraso)}</span>
                    ) : (
                      <span className="badge badge-success">Em dia</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mb-3">
        <h3 className="section-title">Presenca</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Aula</th>
                <th>Status</th>
                <th>Percentual</th>
              </tr>
            </thead>
            <tbody>
              {aluno.presencas?.map((presenca: any) => (
                <tr key={presenca.id}>
                  <td>{presenca.aula?.titulo}</td>
                  <td>
                    <span className={`badge ${presenca.status === 'presente' ? 'badge-success' : presenca.status === 'parcial' ? 'badge-warning' : 'badge-error'}`}>
                      {presenca.status}
                    </span>
                  </td>
                  <td>{Math.round(presenca.percentual)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mb-3">
        <h3 className="section-title">Frequencia por materia</h3>
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
              {aluno.relatorioAcademico?.frequenciaPorModulo?.length ? aluno.relatorioAcademico.frequenciaPorModulo.map((item: any) => (
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
              )) : (
                <tr>
                  <td className="text-muted" colSpan={5}>Nenhum dado consolidado ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mb-3">
        <h3 className="section-title">Boletim por materia</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Materia</th>
                <th>Atividades</th>
                <th>Corrigidas</th>
                <th>Pendentes</th>
                <th>Media</th>
              </tr>
            </thead>
            <tbody>
              {boletimPorModulo.length ? boletimPorModulo.map((item: any) => (
                <tr key={item.modulo}>
                  <td style={{ fontWeight: 500 }}>{item.modulo}</td>
                  <td>{item.atividades}</td>
                  <td>{item.corrigidas}</td>
                  <td>{item.pendentes}</td>
                  <td>{item.mediaNotas == null ? 'N/A' : item.mediaNotas}</td>
                </tr>
              )) : (
                <tr>
                  <td className="text-muted" colSpan={5}>Nenhuma nota consolidada ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mb-3">
        <h3 className="section-title">Entregas e correcoes</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Avaliacao</th>
                <th>Tipo</th>
                <th>Formato</th>
                <th>Status</th>
                <th>Nota</th>
                <th>Arquivo</th>
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
              {aluno.entregasAvaliacao?.length ? aluno.entregasAvaliacao.map((entrega: any) => (
                <tr key={entrega.id}>
                  <td style={{ fontWeight: 500 }}>{entrega.avaliacao?.titulo}</td>
                  <td>{entrega.avaliacao?.tipo}</td>
                  <td>{entrega.avaliacao?.formato || 'discursiva'}</td>
                  <td>
                    <span className={`badge ${entrega.status === 'corrigido' ? 'badge-success' : entrega.status === 'enviado' ? 'badge-warning' : 'badge-error'}`}>
                      {entrega.status}
                    </span>
                  </td>
                  <td>{typeof entrega.nota === 'number' ? `${entrega.nota}/${entrega.avaliacao?.notaMaxima}` : 'Pendente'}</td>
                  <td>
                    {entrega.arquivoUrl ? (
                      <button
                        className="text-link-button"
                        onClick={() => {
                          void downloadAuthenticatedFile(`/api/admin/entrega-avaliacao/${entrega.id}/arquivo`).catch((error) => {
                            setFeedback(error instanceof Error ? error.message : 'Nao foi possivel baixar o arquivo.');
                          });
                        }}
                        type="button"
                      >
                        <AppIcon name="download" size={14} />
                        <span>Baixar</span>
                      </button>
                    ) : (
                      <span className="text-muted">Sem arquivo</span>
                    )}
                  </td>
                  <td className="text-muted">{entrega.comentarioCorrecao || 'Sem comentario'}</td>
                </tr>
              )) : (
                <tr>
                  <td className="text-muted" colSpan={7}>Nenhuma entrega registrada ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {aluno.resultadosQuiz?.length > 0 && (
        <div className="card mb-3">
          <h3 className="section-title">Resultados dos quizzes</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Aula</th>
                  <th>Pontuacao</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {aluno.resultadosQuiz.map((resultado: any) => (
                  <tr key={resultado.id}>
                    <td>{resultado.aula?.titulo}</td>
                    <td>
                      <span className={`badge ${resultado.pontuacao >= 4 ? 'badge-success' : resultado.pontuacao >= 3 ? 'badge-warning' : 'badge-error'}`}>
                        {resultado.pontuacao}/{resultado.totalQuestoes}
                      </span>
                    </td>
                    <td className="text-muted">{formatDate(resultado.feitoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="section-title">Historico de login</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>IP</th>
                <th>Dispositivo</th>
              </tr>
            </thead>
            <tbody>
              {aluno.loginHistorico?.map((login: any) => (
                <tr key={login.id}>
                  <td>{formatDateTime(login.dataHora)}</td>
                  <td className="text-muted">{login.ip}</td>
                  <td className="text-muted">
                    <span className="table-device-text">{login.dispositivo?.substring(0, 50)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
