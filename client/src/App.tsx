import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { lazy, Suspense, ReactNode } from 'react';
import AdminLayout from './components/layouts/AdminLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const StudentAulas = lazy(() => import('./pages/student/Aulas'));
const StudentAulaPlayer = lazy(() => import('./pages/student/AulaPlayer'));
const StudentAvaliacoes = lazy(() => import('./pages/student/Avaliacoes'));
const StudentMateriais = lazy(() => import('./pages/student/Materiais'));
const StudentPerfil = lazy(() => import('./pages/student/Perfil'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminAlunos = lazy(() => import('./pages/admin/Alunos'));
const AdminAlunoDetalhes = lazy(() => import('./pages/admin/AlunoDetalhes'));
const AdminAvaliacoes = lazy(() => import('./pages/admin/Avaliacoes'));
const AdminAulas = lazy(() => import('./pages/admin/Aulas'));
const AdminAulaNova = lazy(() => import('./pages/admin/AulaNova'));
const AdminAulaEditar = lazy(() => import('./pages/admin/AulaEditar'));
const AdminMateriais = lazy(() => import('./pages/admin/Materiais'));
const AdminChamada = lazy(() => import('./pages/admin/Chamada'));
const AdminAvisos = lazy(() => import('./pages/admin/Avisos'));
const AdminRelatorios = lazy(() => import('./pages/admin/Relatorios'));
const AdminConfiguracoes = lazy(() => import('./pages/admin/Configuracoes'));

// This array would typically be in a separate config file or a Sidebar component
// For the purpose of this edit, it's placed here as per the user's snippet structure.
export const adminSidebarItems = [
  { path: '/admin/dashboard', icon: 'dashboard' as const, label: 'Dashboard' },
  { path: '/admin/alunos', icon: 'users' as const, label: 'Alunos' },
  { path: '/admin/avaliacoes', icon: 'quiz' as const, label: 'Avaliações'},
  { path: '/admin/aulas', icon: 'book' as const, label: 'Aulas' },
  { path: '/admin/materiais', icon: 'folder' as const, label: 'Materiais' },
  { path: '/admin/chamada', icon: 'attendance' as const, label: 'Chamada' },
  { path: '/admin/avisos', icon: 'bell' as const, label: 'Avisos' },
  { path: '/admin/relatorios', icon: 'reports' as const, label: 'Relatórios' },
  { path: '/admin/configuracoes', icon: 'settings' as const, label: 'Configurações' },
];

function ProtectedRoute({ children, role }: { children: ReactNode; role: 'aluno' | 'admin' }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div aria-busy="true" aria-live="polite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="skeleton" style={{ width: 200, height: 30 }} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={role === 'admin' ? '/admin' : '/login'} replace />;
  }

  if (role === 'admin' && user.papel !== 'admin' && user.papel !== 'pastor') {
    return <Navigate to="/dashboard" replace />;
  }

  if (role === 'aluno' && user.papel !== 'aluno' && user.papel !== 'admin' && user.papel !== 'pastor') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ minHeight: '100vh' }} />}>
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<RegisterPage />} />
      <Route path="/admin" element={<AdminLoginPage />} />

      {/* Student Protected */}
      <Route path="/dashboard" element={<ProtectedRoute role="aluno"><StudentDashboard /></ProtectedRoute>} />
      <Route path="/aulas" element={<ProtectedRoute role="aluno"><StudentAulas /></ProtectedRoute>} />
      <Route path="/aula/:id" element={<ProtectedRoute role="aluno"><StudentAulaPlayer /></ProtectedRoute>} />
      <Route path="/avaliacoes" element={<ProtectedRoute role="aluno"><StudentAvaliacoes /></ProtectedRoute>} />
      <Route path="/materiais" element={<ProtectedRoute role="aluno"><StudentMateriais /></ProtectedRoute>} />
      <Route path="/perfil" element={<ProtectedRoute role="aluno"><StudentPerfil /></ProtectedRoute>} />

      {/* Admin Protected */}
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/*" element={
        <ProtectedRoute role="admin">
          <AdminLayout>
            <Routes>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="alunos" element={<AdminAlunos />} />
              <Route path="aluno/:id" element={<AdminAlunoDetalhes />} />
              <Route path="avaliacoes" element={<AdminAvaliacoes />} />
              <Route path="aulas" element={<AdminAulas />} />
              <Route path="aula/nova" element={<AdminAulaNova />} />
              <Route path="aula/:id/editar" element={<AdminAulaEditar />} />
              <Route path="materiais" element={<AdminMateriais />} />
              <Route path="chamada" element={<AdminChamada />} />
              <Route path="avisos" element={<AdminAvisos />} />
              <Route path="relatorios" element={<AdminRelatorios />} />
              <Route path="configuracoes" element={<AdminConfiguracoes />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </AdminLayout>
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
