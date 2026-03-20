import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../../components/AppIcon';

export default function AdminAulas() {
  const navigate = useNavigate();
  const [modulos, setModulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('accessToken');

  const [showNewModule, setShowNewModule] = useState(false);
  const [newModTitle, setNewModTitle] = useState('');
  const [newModDesc, setNewModDesc] = useState('');
  const [newModCapa, setNewModCapa] = useState('');

  const loadData = () => {
    setLoading(true);
    fetch('/api/admin/aulas', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then(setModulos)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateModulo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModTitle) return;
    try {
      const res = await fetch('/api/admin/modulo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ titulo: newModTitle, descricao: newModDesc, capaUrl: newModCapa })
      });
      if (res.ok) {
        setNewModTitle('');
        setNewModDesc('');
        setNewModCapa('');
        setShowNewModule(false);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteModulo = async (id: string) => {
    if (!confirm('Deseja realmente excluir este modulo e todas as suas aulas? Esta acao e irreversivel.')) return;
    try {
      const res = await fetch(`/api/admin/modulo/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) loadData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Gestao de Conteudo</h1>
            <p>Gerencie os modulos e aulas do seminario.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => setShowNewModule(!showNewModule)}>
              {showNewModule ? 'Cancelar' : 'Novo Modulo'}
            </button>
            <button className="btn btn-accent" onClick={() => navigate('/admin/aula/nova')}>
              Nova Aula
            </button>
          </div>
        </div>

        {showNewModule && (
          <form className="panel-card" onSubmit={handleCreateModulo} style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Cadastrar Novo Modulo</h3>
            <div className="search-field" style={{ marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
              <input 
                placeholder="Titulo do modulo" 
                value={newModTitle} 
                onChange={e => setNewModTitle(e.target.value)} 
                style={{ padding: '0.75rem' }}
              />
            </div>
            <div className="search-field" style={{ marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
              <input 
                placeholder="URL da Imagem de Capa (Opcional)" 
                value={newModCapa} 
                onChange={e => setNewModCapa(e.target.value)} 
                style={{ padding: '0.75rem' }}
              />
            </div>
            <textarea 
              className="filter-select" 
              placeholder="Descricao curta" 
              value={newModDesc} 
              onChange={e => setNewModDesc(e.target.value)}
              style={{ width: '100%', minHeight: '80px', marginBottom: '1rem', padding: '0.75rem' }}
            />
            <button className="btn btn-primary" type="submit">Salvar Modulo</button>
          </form>
        )}

        {loading ? (
          <div className="skeleton" style={{ height: 300 }} />
        ) : (
          modulos.map((modulo) => (
            <div className="module-section" key={modulo.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h2 style={{ margin: 0 }}>{modulo.titulo}</h2>
                <button 
                  className="btn btn-outline btn-sm" 
                  style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
                  onClick={() => handleDeleteModulo(modulo.id)}
                >
                  Excluir Modulo
                </button>
              </div>
              <p className="module-desc">{modulo.descricao}</p>

              <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Aula</th>
                      <th>Status</th>

                      <th>Alunos</th>
                      <th>% Medio</th>
                      <th>Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modulo.aulas.map((aula: any) => {
                      const totalAlunos = aula.progressos?.length || 0;
                      const mediaConclusao = totalAlunos > 0
                        ? Math.round(aula.progressos.reduce((sum: number, progresso: any) => sum + progresso.percentualAssistido, 0) / totalAlunos)
                        : 0;

                      return (
                        <tr key={aula.id}>
                          <td style={{ fontWeight: 500 }}>{aula.titulo}</td>
                          <td>
                            <span className={`badge ${aula.publicado ? 'badge-success' : 'badge-warning'}`}>
                              {aula.publicado ? 'Publicado' : 'Rascunho'}
                            </span>
                          </td>

                          <td>{totalAlunos}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div className="progress-bar" style={{ width: 60 }}>
                                <div className="progress-bar-fill" style={{ width: `${mediaConclusao}%` }} />
                              </div>
                              <span className="text-sm">{mediaConclusao}%</span>
                            </div>
                          </td>
                           <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn btn-outline btn-sm" title="Editar Aula" onClick={() => navigate(`/admin/aula/${aula.id}/editar`)}>
                                <AppIcon name="settings" size={14} />
                              </button>
                              <button className="btn btn-outline btn-sm" title="Fazer Chamada" onClick={() => navigate(`/admin/chamada?aulaId=${aula.id}`)}>
                                <AppIcon name="shield" size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
    </>
  );
}
