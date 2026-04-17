import { useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../../lib/apiClient';

export default function AdminChamada() {
  const [modulos, setModulos] = useState<any[]>([]);
  const [aulas, setAulas] = useState<any[]>([]);
  const [presencas, setPresencas] = useState<any[]>([]);
  const [selectedModulo, setSelectedModulo] = useState('');
  const [selectedAula, setSelectedAula] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [manualChanges, setManualChanges] = useState<Record<string, { status: string; metodo: string }>>({});
  const [alunos, setAlunos] = useState<any[]>([]);
  const [feedback, setFeedback] = useState('');
  const [searchName, setSearchName] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const reloadChamada = (moduloId: string, aulaId: string) => {
    const params = new URLSearchParams();
    if (moduloId) params.append('moduloId', moduloId);
    if (aulaId) params.append('aulaId', aulaId);
    apiGet<any[]>(`/api/admin/chamada?${params.toString()}`).then(setPresencas).catch(() => {});
  };

  useEffect(() => {
    apiGet<any[]>('/api/admin/modulos').then(setModulos).catch(() => setFeedback('Não foi possível carregar os módulos.'));
    apiGet<any[]>('/api/admin/alunos').then(setAlunos).catch(() => setFeedback('Não foi possível carregar os alunos.'));
    const params = new URLSearchParams(window.location.search);
    const aulaId = params.get('aulaId');
    if (aulaId) setSelectedAula(aulaId);
  }, []);

  useEffect(() => {
    if (!selectedAula || selectedModulo) return;

    apiGet<any[]>('/api/admin/aulas')
      .then((data) => {
        const modulo = data.find((item: any) => item.aulas?.some((aula: any) => aula.id === selectedAula));
        if (!modulo) return;
        setSelectedModulo(modulo.id);
        setAulas(modulo.aulas || []);
      })
      .catch(() => {});
  }, [selectedAula, selectedModulo]);

  useEffect(() => {
    if (!selectedModulo) {
      setAulas([]);
      setPresencas([]);
      return;
    }
    apiGet<any[]>('/api/admin/aulas')
      .then((data) => {
        const modulo = data.find((item: any) => item.id === selectedModulo);
        setAulas(modulo?.aulas || []);
      })
      .catch(() => setFeedback('Não foi possível carregar as aulas.'));
  }, [selectedModulo]);

  useEffect(() => {
    if (!selectedModulo && !selectedAula) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedModulo) params.append('moduloId', selectedModulo);
    if (selectedAula) params.append('aulaId', selectedAula);
    apiGet<any[]>(`/api/admin/chamada?${params.toString()}`)
      .then(setPresencas)
      .catch(() => setFeedback('Não foi possível carregar a chamada.'))
      .finally(() => setLoading(false));
  }, [selectedModulo, selectedAula]);

  const eligibleAlunos = useMemo(
    () => alunos.filter((aluno) => {
      if (aluno.ativo === false) return false;
      if (typeof aluno.statusCadastro === 'string' && aluno.statusCadastro !== 'aprovado') return false;
      return true;
    }),
    [alunos]
  );

  const tableRows = useMemo(() => {
    const term = searchName.trim().toLowerCase();

    const baseRows = editMode
      ? eligibleAlunos.map((aluno) => ({
          aluno,
          presenca: manualChanges[aluno.id] || { status: 'ausente', metodo: 'digital' },
          percentual: 0
        }))
      : presencas.map((presenca) => ({
          aluno: presenca.aluno,
          presenca,
          percentual: presenca.percentual
        }));

    const filtered = term
      ? baseRows.filter((row) => (row.aluno?.nome || '').toLowerCase().includes(term))
      : baseRows;

    return filtered.sort((a, b) => {
      const compare = (a.aluno?.nome || '').localeCompare((b.aluno?.nome || ''), 'pt-BR', { sensitivity: 'base' });
      return sortOrder === 'asc' ? compare : -compare;
    });
  }, [editMode, eligibleAlunos, manualChanges, presencas, searchName, sortOrder]);

  const explainSaveError = (err: unknown) => {
    if (!(err instanceof Error)) return 'Não foi possível salvar a chamada.';
    const message = err.message || '';
    const normalized = message.toLowerCase();

    if (normalized.includes('aborted') || normalized.includes('abortado') || normalized.includes('tempo limite')) {
      return 'A gravação da chamada demorou além do tempo limite. Aguarde alguns segundos e tente novamente.';
    }
    if (normalized.includes('aula não encontrada')) return 'Faltou selecionar a aula para confirmar a chamada.';
    if (normalized.includes('dados inválidos')) return 'Dados inválidos na chamada. Revise a marcação dos alunos.';
    if (normalized.includes('nenhuma presença')) return 'Nenhuma presença para salvar. Marque ao menos um aluno.';
    if (normalized.includes('método inválido')) return 'Método de presença inválido em algum aluno.';
    if (normalized.includes('status inválido')) return 'Status de presença inválido em algum aluno.';

    return message;
  };

  const handleSaveChamada = async () => {
    if (!selectedModulo) {
      setFeedback('Selecione um módulo antes de salvar a chamada.');
      return;
    }
    if (!selectedAula) {
      setFeedback('Faltou selecionar a aula para confirmar a chamada.');
      return;
    }
    if (!editMode) {
      setFeedback('Ative o modo "Registrar Presença" antes de salvar.');
      return;
    }

    setSaving(true);
    try {
      const presencasList = Object.entries(manualChanges).map(([alunoId, data]) => ({
        alunoId,
        status: data.status,
        metodo: data.metodo
      }));

      if (!presencasList.length) {
        setFeedback('Nenhuma presença para salvar. Selecione uma aula e registre os alunos.');
        return;
      }

      await apiPost('/api/admin/chamada', { aulaId: selectedAula, presencas: presencasList }, { timeoutMs: 180000 });
      setEditMode(false);
      setManualChanges({});
      reloadChamada(selectedModulo, selectedAula);
      setFeedback('Chamada salva com sucesso.');
    } catch (err) {
      setFeedback(explainSaveError(err));
    } finally {
      setSaving(false);
    }
  };

  const updateManual = (alunoId: string, status: string, metodo: string) => {
    setManualChanges((prev) => ({
      ...prev,
      [alunoId]: { status, metodo }
    }));
  };

  const stats = {
    presentes: presencas.filter((presenca) => presenca.status === 'presente').length,
    parciais: presencas.filter((presenca) => presenca.status === 'parcial').length,
    ausentes: presencas.filter((presenca) => presenca.status === 'ausente').length
  };
  const hasSelection = Boolean(selectedModulo || selectedAula);
  const shouldRenderTable = editMode ? Boolean(selectedAula) : presencas.length > 0;

  return (
    <>
      <div className="page-header page-header-split">
        <div>
          <h1>Lista de Chamada</h1>
          <p>Registre a presença manual (Presencial/Meet) ou visualize o engajamento automático.</p>
        </div>
        <div className="page-header-actions">
          {selectedAula && (
            <button
              className={`btn ${editMode ? 'btn-outline' : 'btn-accent'}`}
              onClick={() => {
                if (!editMode) {
                  const initial: Record<string, { status: string; metodo: string }> = {};
                  eligibleAlunos.forEach((aluno) => {
                    const p = presencas.find((x) => x.alunoId === aluno.id);
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
              {editMode ? 'Cancelar Edição' : 'Registrar Presença'}
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
        <div className={`inline-feedback ${feedback.toLowerCase().includes('sucesso') ? 'success' : 'warning'}`}>
          {feedback}
        </div>
      )}

      <div className="filters">
        <select
          aria-label="Selecionar módulo"
          className="filter-select"
          value={selectedModulo}
          onChange={(e) => {
            setSelectedModulo(e.target.value);
            setSelectedAula('');
          }}
        >
          <option value="">Selecione um módulo</option>
          {modulos.map((modulo) => (
            <option key={modulo.id} value={modulo.id}>
              {modulo.titulo}
            </option>
          ))}
        </select>

        {aulas.length > 0 && (
          <select
            aria-label="Selecionar aula"
            className="filter-select"
            value={selectedAula}
            onChange={(e) => setSelectedAula(e.target.value)}
          >
            <option value="">Todas as aulas</option>
            {aulas.map((aula) => (
              <option key={aula.id} value={aula.id}>
                {aula.titulo}
              </option>
            ))}
          </select>
        )}

        <input
          className="form-input"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="Buscar aluno por nome"
          aria-label="Buscar aluno por nome"
        />

        <select
          className="filter-select"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
          aria-label="Ordenar alunos"
        >
          <option value="asc">Nome (A-Z)</option>
          <option value="desc">Nome (Z-A)</option>
        </select>

        {!editMode && presencas.length > 0 && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              alert('Relatório pronto para impressão via browser (Ctrl+P)');
              window.print();
            }}
            type="button"
          >
            Exportar / Imprimir
          </button>
        )}
      </div>

      {presencas.length > 0 && (
        <div className="stat-grid-auto mb-3">
          <div className="stat-card">
            <div className="stat-icon green">P</div>
            <div>
              <div className="stat-value">{stats.presentes}</div>
              <div className="stat-label">Presentes</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">M</div>
            <div>
              <div className="stat-value">{stats.parciais}</div>
              <div className="stat-label">Parciais</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue">A</div>
            <div>
              <div className="stat-value">{stats.ausentes}</div>
              <div className="stat-label">Ausentes</div>
            </div>
          </div>
        </div>
      )}

      {!hasSelection ? (
        <div className="empty-state">
          <div className="icon">C</div>
          <h3>Selecione um módulo</h3>
          <p>Escolha um módulo para visualizar a chamada.</p>
        </div>
      ) : loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : !shouldRenderTable ? (
        <div className="empty-state">
          <div className="icon">0</div>
          <h3>Nenhum registro encontrado</h3>
          <p>Ainda não há presenças registradas para esse filtro.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Status</th>
                <th>Método/Tipo</th>
                {!editMode && <th>Percentual</th>}
                {editMode && <th>Marcação Rápida</th>}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const aluno = row.aluno;
                const presenca = row.presenca;
                const currentStatus = presenca?.status || 'ausente';
                const currentMetodo = presenca?.metodo || 'digital';

                return (
                  <tr key={aluno.id}>
                    <td>
                      <div className="table-entity">
                        <div className="table-entity-avatar">{aluno.nome?.[0]}</div>
                        <div className="table-entity-copy">
                          <div style={{ fontWeight: 500 }}>{aluno.nome}</div>
                          <div className="text-muted text-sm">{aluno.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          currentStatus === 'presente'
                            ? 'badge-success'
                            : currentStatus === 'parcial'
                              ? 'badge-warning'
                              : 'badge-error'
                        }`}
                      >
                        {currentStatus === 'presente' ? 'Presente' : currentStatus === 'parcial' ? 'Parcial' : 'Falta'}
                      </span>
                    </td>
                    <td>
                      <span className="pill subtle" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                        {currentMetodo}
                      </span>
                    </td>
                    {!editMode && <td>{Math.round(row.percentual || 0)}%</td>}
                    {editMode && (
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
                            className={`btn btn-sm ${currentStatus === 'parcial' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() =>
                              updateManual(aluno.id, 'parcial', currentMetodo === 'presencial' ? 'presencial' : 'meet')
                            }
                            type="button"
                          >
                            Parcial
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

