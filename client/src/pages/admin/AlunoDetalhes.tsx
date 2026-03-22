import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppIcon from '../../components/AppIcon';
import AvatarCropModal from '../../components/AvatarCropModal';
import { downloadAuthenticatedFile } from '../../lib/auth-file';

export default function AdminAlunoDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aluno, setAluno] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [loadError, setLoadError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const token = localStorage.getItem('accessToken');

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
      const response = await fetch(`/api/admin/aluno/${id}/foto`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();
      if (!response.ok) { setFeedback(data.error || 'Erro ao salvar foto.'); return; }
      setAluno((current: any) => ({ ...current, foto: data.foto }));
    } catch {
      setFeedback('Erro ao enviar foto.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    fetch(`/api/admin/aluno/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then(setAluno)
      .catch(() => setLoadError('Nao foi possivel carregar o relatorio do aluno.'))
      .finally(() => setLoading(false));
  }, [id]);

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
      <>
        <div className="empty-panel">
          <AppIcon name="students" size={20} />
          <p>Aluno nao encontrado.</p>
        </div>
      </>
    );
  }

  const initials = aluno.nome?.split(' ').map((item: string) => item[0]).slice(0, 2).join('').toUpperCase() || 'SV';
  const avgProgress = aluno.progressos?.length
    ? Math.round(aluno.progressos.reduce((sum: number, progresso: any) => sum + progresso.percentualAssistido, 0) / aluno.progressos.length)
    : 0;
  const avgAcademic = typeof aluno.relatorioAcademico?.entregasResumo?.mediaNotas === 'number'
    ? aluno.relatorioAcademico.entregasResumo.mediaNotas.toFixed(1)
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
          <p>IBVN - Instituto Biblico Vinha Nova</p>
          <h2>Relatorio academico do aluno</h2>
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
              {aluno.foto
                ? <img alt="Foto do aluno" src={aluno.foto} style={{ width: 72, height: 72, borderRadius: 'var(--radius-lg)', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: 72, height: 72, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 700, color: 'white' }}>{initials}</div>
              }
              <button
                aria-label="Trocar foto"
                disabled={uploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
                style={{ position: 'absolute', bottom: -6, right: -6, width: 26, height: 26, borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid var(--color-bg)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                title={uploadingPhoto ? 'Enviando...' : 'Trocar foto'}
                type="button"
              >
                <svg fill="none" height={12} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" width={12}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </button>
              <input accept="image/*" onChange={handlePhotoChange} ref={photoInputRef} style={{ display: 'none' }} type="file" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.15rem', wordBreak: 'break-word' }}>{aluno.nome}</h2>
              <p className="text-muted" style={{ wordBreak: 'break-all' }}>{aluno.email} • {aluno.telefone}</p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <span className={`badge ${aluno.ativo ? 'badge-success' : 'badge-error'}`}>{aluno.ativo ? 'Ativo' : 'Inativo'}</span>
                <span className="badge badge-purple">{aluno.papel}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { icon: 'reports' as const, className: 'purple', value: `${avgProgress}%`, label: 'Progresso geral' },
            { icon: 'check' as const, className: 'green', value: aluno.progressos?.filter((item: any) => item.concluido).length || 0, label: 'Aulas concluidas' },
            { icon: 'target' as const, className: 'orange', value: aluno.resultadosQuiz?.length ? `${Math.round(aluno.resultadosQuiz.reduce((sum: number, item: any) => sum + ((item.pontuacao / item.totalQuestoes) * 100), 0) / aluno.resultadosQuiz.length)}%` : 'N/A', label: 'Media quizzes' },
            { icon: 'attendance' as const, className: 'blue', value: aluno.progressos?.reduce((sum: number, item: any) => sum + item.sessoes, 0) || 0, label: 'Total sessoes' },
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

        <div className="card mb-3">
          <h3 className="section-title">Progresso por aula</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Aula</th>
                  <th>Modulo</th>
                  <th>Progresso</th>
                  <th>Sessoes</th>
                  <th>Pausas</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {aluno.progressos?.map((progresso: any) => (
                  <tr key={progresso.id}>
                    <td style={{ fontWeight: 500 }}>{progresso.aula?.titulo}</td>
                    <td className="text-muted">{progresso.aula?.modulo?.titulo}</td>
                    <td>
                      <div className="chart-inline-progress">
                        <div className="progress-bar">
                          <div className={`progress-bar-fill ${progresso.concluido ? 'completed' : ''}`} style={{ width: `${progresso.percentualAssistido}%` }} />
                        </div>
                        <span className="text-sm">{Math.round(progresso.percentualAssistido)}%</span>
                      </div>
                    </td>
                    <td>{progresso.sessoes}</td>
                    <td>{progresso.vezesQueParou}</td>
                    <td>
                      <span className={`badge ${progresso.concluido ? 'badge-success' : progresso.percentualAssistido > 0 ? 'badge-warning' : 'badge-info'}`}>
                        {progresso.concluido ? 'Concluida' : progresso.percentualAssistido > 0 ? 'Em progresso' : 'Nao iniciada'}
                      </span>
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
                {aluno.relatorioAcademico?.frequenciaPorModulo?.map((item: any) => (
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
                )) || (
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
                            void downloadAuthenticatedFile(`/api/admin/entrega-avaliacao/${entrega.id}/arquivo`, token).catch((error) => {
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
                      <td><span className={`badge ${resultado.pontuacao >= 4 ? 'badge-success' : resultado.pontuacao >= 3 ? 'badge-warning' : 'badge-error'}`}>{resultado.pontuacao}/{resultado.totalQuestoes}</span></td>
                      <td className="text-muted">{new Date(resultado.feitoEm).toLocaleDateString('pt-BR')}</td>
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
                    <td>{new Date(login.dataHora).toLocaleString('pt-BR')}</td>
                    <td className="text-muted">{login.ip}</td>
                    <td className="text-muted"><span className="table-device-text">{login.dispositivo?.substring(0, 50)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    </>
  );
}
