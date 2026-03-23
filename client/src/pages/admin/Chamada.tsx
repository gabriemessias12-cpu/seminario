import { useEffect, useState } from 'react';
import AppIcon from '../../components/AppIcon';

export default function AdminChamada() {
  const token = localStorage.getItem('accessToken');
  const [modulos, setModulos] = useState<any[]>([]);
  const [aulas, setAulas] = useState<any[]>([]);
  const [presencas, setPresencas] = useState<any[]>([]);
  const [selectedModulo, setSelectedModulo] = useState('');
  const [selectedAula, setSelectedAula] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [manualChanges, setManualChanges] = useState<{ [alunoId: string]: { status: string, metodo: string } }>({});
  const [alunos, setAlunos] = useState<any[]>([]);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    fetch('/api/admin/modulos', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setModulos)
      .catch(() => setFeedback('Nao foi possivel carregar os modulos.'));

    fetch('/api/admin/alunos', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setAlunos)
      .catch(() => setFeedback('Nao foi possivel carregar os alunos.'));

    const params = new URLSearchParams(window.location.search);
    const aulaId = params.get('aulaId');
    if (aulaId) setSelectedAula(aulaId);
  }, [token]);

  useEffect(() => {
    if (!selectedModulo) {
      setAulas([]);
      setPresencas([]);
      return;
    }

      fetch('/api/admin/aulas', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const modulo = data.find((item: any) => item.id === selectedModulo);
        setAulas(modulo?.aulas || []);
      })
      .catch(() => setFeedback('Nao foi possivel carregar as aulas.'));
  }, [selectedModulo, token]);

  useEffect(() => {
    if (!selectedModulo && !selectedAula) {
      return;
    }

    setLoading(true);
    const params = new URLSearchParams();
    if (selectedModulo) params.append('moduloId', selectedModulo);
    if (selectedAula) params.append('aulaId', selectedAula);

    fetch(`/api/admin/chamada?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setPresencas)
      .catch(() => setFeedback('Nao foi possivel carregar a chamada.'))
      .finally(() => setLoading(false));
  }, [selectedModulo, selectedAula, token]);

  const handleSaveChamada = async () => {
    if (!selectedAula) return;
    setSaving(true);
    try {
      const presencasList = Object.entries(manualChanges).map(([alunoId, data]) => ({
        alunoId,
        status: data.status,
        metodo: data.metodo
      }));

      const res = await fetch('/api/admin/chamada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ aulaId: selectedAula, presencas: presencasList })
      });

      if (res.ok) {
        setEditMode(false);
        setManualChanges({});
        // Reload
        const params = new URLSearchParams();
        if (selectedModulo) params.append('moduloId', selectedModulo);
        if (selectedAula) params.append('aulaId', selectedAula);

        fetch(`/api/admin/chamada?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then(setPresencas);
        setFeedback('Chamada salva com sucesso.');
      }
    } catch (err) {
      setFeedback('Nao foi possivel salvar a chamada.');
    } finally {
      setSaving(false);
    }
  };

  const updateManual = (alunoId: string, status: string, metodo: string) => {
    setManualChanges(prev => ({
      ...prev,
      [alunoId]: { status, metodo }
    }));
  };

  const stats = {
    presentes: presencas.filter((presenca) => presenca.status === 'presente').length,
    parciais: presencas.filter((presenca) => presenca.status === 'parcial').length,
    ausentes: presencas.filter((presenca) => presenca.status === 'ausente').length
  };

  const statusColors: Record<string, string> = {
    presente: 'badge-success',
    parcial: 'badge-warning',
    ausente: 'badge-error'
  };

  return (
    <>
        <div className="page-header page-header-split">
          <div>
            <h1>Lista de Chamada</h1>
            <p>Registre a presenca manual (Presencial/Meet) ou visualize o engajamento automatico.</p>
          </div>
          <div className="page-header-actions">
            {selectedAula && (
              <button 
                className={`btn ${editMode ? 'btn-outline' : 'btn-accent'}`} 
                onClick={() => {
                  if (!editMode) {
                    // Populate initial manualChanges from presencas
                    const initial: any = {};
                    alunos.forEach(aluno => {
                      const p = presencas.find(x => x.alunoId === aluno.id);
                      initial[aluno.id] = { 
                        status: p?.status || 'ausente', 
                        metodo: p?.metodo || 'digital' 
                      };
                    });
                    setManualChanges(initial);
                  }
                  setEditMode(!editMode);
                }}
                type="button"
              >
                {editMode ? 'Cancelar Edicao' : 'Registrar Presenca'}
              </button>
            )}
            {editMode && (
              <button className="btn btn-primary" onClick={handleSaveChamada} disabled={saving} type="button">
                {saving ? 'Salvando...' : 'Salvar Chamada'}
              </button>
            )}
          </div>
        </div>

        {feedback && (
          <div className={`inline-feedback ${feedback.includes('sucesso') ? 'success' : 'warning'}`}>
            {feedback}
          </div>
        )}

        <div className="filters">
          <select aria-label="Selecionar modulo" className="filter-select" value={selectedModulo} onChange={(e) => { setSelectedModulo(e.target.value); setSelectedAula(''); }}>
            <option value="">Selecione um modulo</option>
            {modulos.map((modulo) => (
              <option key={modulo.id} value={modulo.id}>{modulo.titulo}</option>
            ))}
          </select>

          {aulas.length > 0 && (
            <select aria-label="Selecionar aula" className="filter-select" value={selectedAula} onChange={(e) => setSelectedAula(e.target.value)}>
              <option value="">Todas as aulas</option>
              {aulas.map((aula) => (
                <option key={aula.id} value={aula.id}>{aula.titulo}</option>
              ))}
            </select>
          )}

          {!editMode && presencas.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={() => {
              // (Reusing old export logic internally if needed, or keeping it clean)
              alert('Relatorio pronto para impressao via browser (Ctrl+P)');
              window.print();
            }} type="button">
              Exportar / Imprimir
            </button>
          )}
        </div>

        {presencas.length > 0 && (
          <div className="stat-grid-auto mb-3">
            <div className="stat-card">
              <div className="stat-icon green">P</div>
              <div><div className="stat-value">{stats.presentes}</div><div className="stat-label">Presentes</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon orange">M</div>
              <div><div className="stat-value">{stats.parciais}</div><div className="stat-label">Parciais</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue">A</div>
              <div><div className="stat-value">{stats.ausentes}</div><div className="stat-label">Ausentes</div></div>
            </div>
          </div>
        )}

        {!selectedModulo ? (
          <div className="empty-state">
            <div className="icon">C</div>
            <h3>Selecione um modulo</h3>
            <p>Escolha um modulo para visualizar a chamada.</p>
          </div>
        ) : loading ? (
          <div className="skeleton" style={{ height: 200 }} />
        ) : presencas.length === 0 ? (
          <div className="empty-state">
            <div className="icon">0</div>
            <h3>Nenhum registro encontrado</h3>
            <p>Ainda nao ha presencas registradas para esse filtro.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Status</th>
                  <th>Metodo/Tipo</th>
                  {!editMode && <th>Percentual</th>}
                  {editMode && <th>Marcacao Rapida</th>}
                </tr>
              </thead>
              <tbody>
                {(editMode ? alunos : presencas).map((item) => {
                  const isEdit = editMode;
                  const aluno = isEdit ? item : item.aluno;
                  const presenca = isEdit ? manualChanges[aluno.id] : item;
                  const currentStatus = presenca?.status || 'ausente';
                  const currentMetodo = presenca?.metodo || 'digital';

                  return (
                    <tr key={aluno.id}>
                      <td>
                        <div className="table-entity">
                          <div className="table-entity-avatar">
                            {aluno.nome?.[0]}
                          </div>
                          <div className="table-entity-copy">
                            <div style={{ fontWeight: 500 }}>{aluno.nome}</div>
                            <div className="text-muted text-sm">{aluno.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          currentStatus === 'presente' ? 'badge-success' : 
                          currentStatus === 'parcial' ? 'badge-warning' : 'badge-error'
                        }`}>
                          {currentStatus === 'presente' ? 'Presente' : currentStatus === 'parcial' ? 'Parcial' : 'Falta'}
                        </span>
                      </td>
                      <td>
                        <span className="pill subtle" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                          {currentMetodo}
                        </span>
                      </td>
                      {!isEdit && <td>{Math.round(item.percentual)}%</td>}
                      {isEdit && (
                        <td>
                          <div className="table-actions">
                            <button 
                              className={`btn btn-sm ${currentStatus === 'presente' && currentMetodo === 'presencial' ? 'btn-primary' : 'btn-outline'}`}
                              onClick={() => updateManual(aluno.id, 'presente', 'presencial')}
                              type="button"
                            >
                              Presencial
                            </button>
                            <button 
                              className={`btn btn-sm ${currentStatus === 'presente' && currentMetodo === 'meet' ? 'btn-primary' : 'btn-outline'}`}
                              onClick={() => updateManual(aluno.id, 'presente', 'meet')}
                              type="button"
                            >
                              Meet
                            </button>
                            <button 
                              className={`btn btn-sm ${currentStatus === 'ausente' ? 'btn-accent' : 'btn-outline'}`}
                              style={{ 
                                background: currentStatus === 'ausente' ? 'var(--color-error)' : 'transparent',
                                color: currentStatus === 'ausente' ? 'white' : 'inherit'
                              }}
                              onClick={() => updateManual(aluno.id, 'ausente', 'digital')}
                              type="button"
                            >
                              Falta
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}
