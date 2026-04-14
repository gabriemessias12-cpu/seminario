// ─── Enums ────────────────────────────────────────────────────────────────────

export type PapelUsuario = 'aluno' | 'admin' | 'pastor';
export type StatusCadastroAluno = 'pendente' | 'aprovado' | 'rejeitado';
export type StatusIA = 'pendente' | 'processando' | 'concluido' | 'erro';
export type StatusEntrega = 'pendente' | 'enviado' | 'corrigido';
export type StatusPresenca = 'presente' | 'parcial' | 'ausente';
export type MetodoPresenca = 'digital' | 'meet' | 'presencial';
export type FormatoAvaliacao = 'discursiva' | 'objetiva';

// ─── Core models ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  foto?: string | null;
  telefone?: string | null;
  ativo: boolean;
  statusCadastro: StatusCadastroAluno;
  dataNascimento?: string | null;
  membroVinha: boolean;
  batizado: boolean;
  criadoEm: string;
  ultimoAcesso?: string | null;
}

export interface Modulo {
  id: string;
  titulo: string;
  descricao?: string | null;
  capaUrl?: string | null;
  ordem: number;
  obrigatorio: boolean;
  ativo: boolean;
  criadoEm: string;
  aulas?: Aula[];
}

export interface Aula {
  id: string;
  moduloId: string;
  titulo: string;
  descricao?: string | null;
  urlVideo?: string | null;
  thumbnail?: string | null;
  duracaoSegundos: number;
  publicado: boolean;
  dataPublicacao?: string | null;
  transcricao?: string | null;
  resumo?: string | null;
  pontosChave?: string | null;
  versiculos?: string | null;
  glossario?: string | null;
  statusIA: StatusIA;
  criadoEm: string;
  modulo?: Pick<Modulo, 'id' | 'titulo' | 'ordem'>;
  quizzes?: Quiz[];
  materiaisAula?: MaterialAula[];
}

export interface Quiz {
  id: string;
  aulaId: string;
  questoes: string; // JSON string
}

export interface QuestaoQuiz {
  pergunta: string;
  opcoes: string[];
  correta: number;
}

export interface Material {
  id: string;
  titulo: string;
  descricao?: string | null;
  urlArquivo: string;
  tipo: string;
  categoria: string;
  permiteDownload: boolean;
  moduloId?: string | null;
  modulo?: Pick<Modulo, 'id' | 'titulo'> | null;
  criadoEm: string;
}

export interface MaterialAula {
  id: string;
  materialId: string;
  aulaId: string;
  material?: Material;
}

export interface Avaliacao {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  formato: FormatoAvaliacao;
  moduloId?: string | null;
  aulaId?: string | null;
  dataLimite?: string | null;
  notaMaxima: number;
  publicado: boolean;
  permiteArquivo: boolean;
  permiteTexto: boolean;
  questoesObjetivas?: string | null;
  resultadoImediato: boolean;
  tempoLimiteMinutos?: number | null;
  criadoEm: string;
  modulo?: Pick<Modulo, 'id' | 'titulo'> | null;
  aula?: Pick<Aula, 'id' | 'titulo'> | null;
}

export interface EntregaAvaliacao {
  id: string;
  avaliacaoId: string;
  alunoId: string;
  respostaTexto?: string | null;
  arquivoUrl?: string | null;
  respostasObjetivas?: string | null;
  status: StatusEntrega;
  nota?: number | null;
  totalQuestoes?: number | null;
  acertosObjetivos?: number | null;
  percentualObjetivo?: number | null;
  comentarioCorrecao?: string | null;
  enviadoEm?: string | null;
  corrigidoEm?: string | null;
  criadoEm: string;
  avaliacao?: Avaliacao;
  aluno?: Pick<User, 'id' | 'nome' | 'email' | 'foto'>;
}

export interface ProgressoAluno {
  id: string;
  alunoId: string;
  aulaId: string;
  percentualAssistido: number;
  tempoTotalSegundos: number;
  concluido: boolean;
  dataInicio: string;
  dataConclusao?: string | null;
  posicaoAtualSegundos: number;
  vezesQueParou: number;
  sessoes: number;
}

export interface Presenca {
  id: string;
  alunoId: string;
  aulaId: string;
  status: StatusPresenca;
  metodo: MetodoPresenca;
  percentual: number;
  registradoEm: string;
}

export interface Notificacao {
  id: string;
  alunoId: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  criadaEm: string;
}

export interface LoginHistorico {
  id: string;
  usuarioId: string;
  ip?: string | null;
  dispositivo?: string | null;
  dataHora: string;
  sucesso: boolean;
  usuario?: Pick<User, 'id' | 'nome' | 'email'>;
}

export interface SecurityAlert {
  id: string;
  usuarioId: string;
  tipo: 'novo_ip' | 'login_falho' | 'senha_alterada';
  mensagem: string;
  ip?: string | null;
  dispositivo?: string | null;
  lido: boolean;
  criadoEm: string;
  usuario: Pick<User, 'id' | 'nome' | 'email'>;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface AlunoListItem {
  id: string;
  nome: string;
  email: string;
  foto?: string | null;
  telefone?: string | null;
  ativo: boolean;
  statusCadastro: StatusCadastroAluno;
  dataNascimento?: string | null;
  membroVinha: boolean;
  batizado: boolean;
  criadoEm?: string;
  ultimoAcesso?: string | null;
  progressoAulas: number;
  progressoAvaliacoes: number;
  progressoGeral: number;
  aulasConcluidas?: number;
  totalAulasAcessadas?: number;
  aulasAtrasadas: number;
  avaliacoesAtrasadas: number;
}

export interface ProgressMetric {
  total: number;
  concluidas: number;
  pendentes: number;
  percentual: number;
}

export interface LessonDelayAlert {
  aulaId: string;
  titulo: string;
  modulo: string;
  dataPublicacao: string;
  percentualAssistido: number;
  concluido: boolean;
  atrasada: boolean;
  diasAtraso: number | null;
  status: 'concluida' | 'em_andamento' | 'nao_iniciada';
}

export interface AssessmentDelayAlert {
  avaliacaoId: string;
  titulo: string;
  tipo: string;
  modulo: string;
  aula?: string | null;
  dataLimite?: string | null;
  concluido: boolean;
  atrasada: boolean;
  diasAtraso: number | null;
  statusEntrega: string;
}

/** Admin dashboard response */
export interface AdminDashboardData {
  totalAlunos: number;
  alunosAtivos: number;
  aulasPublicadas: number;
  taxaConclusao: number;
  progressoMedioAulas: number;
  progressoMedioAvaliacoes: number;
  progressoMedioGeral: number;
  alertasAulasAtrasadas: number;
  alertasAvaliacoesAtrasadas: number;
  aulasStats: { id: string; titulo: string; mediaConclusao: number }[];
  alunosAtencao: {
    id: string;
    nome: string;
    email: string;
    foto?: string | null;
    progressoAulas: number;
    progressoAvaliacoes: number;
    progressoGeral: number;
    aulasAtrasadas: number;
    avaliacoesAtrasadas: number;
  }[];
  atividadeRecente: LoginHistorico[];
}

/** Student dashboard response */
export interface StudentDashboardData {
  totalAulas: number;
  aulasConcluidas: number;
  percentualCurso: number;
  progressoAulas: ProgressMetric;
  progressoAvaliacoes: ProgressMetric;
  progressoGeral: number;
  aulasAtrasadas: LessonDelayAlert[];
  avaliacoesPendentesAtrasadas: AssessmentDelayAlert[];
  mediaQuiz: number;
  notificacoes: Array<{ id: string; titulo: string; mensagem: string }>;
  proximaAula: { id: string; titulo: string; descricao?: string | null } | null;
  atividadeRecente: Array<{
    id: string;
    aulaId: string;
    concluido: boolean;
    percentualAssistido: number;
    aula?: { titulo: string };
  }>;
}

/** @deprecated Use AdminDashboardData or StudentDashboardData */
export type DashboardData = AdminDashboardData;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
