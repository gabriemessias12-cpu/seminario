import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import StudentDashboard from './pages/student/Dashboard';
import StudentAulas from './pages/student/Aulas';
import StudentAulaPlayer from './pages/student/AulaPlayer';
import StudentAvaliacoes from './pages/student/Avaliacoes';
import StudentMateriais from './pages/student/Materiais';
import StudentPerfil from './pages/student/Perfil';
import AdminDashboard from './pages/admin/Dashboard';
import AdminAlunos from './pages/admin/Alunos';
import AdminAlunoDetalhes from './pages/admin/AlunoDetalhes';
import AdminAvaliacoes from './pages/admin/Avaliacoes';
import AdminAulas from './pages/admin/Aulas';
import AdminAulaNova from './pages/admin/AulaNova';
import AdminAulaEditar from './pages/admin/AulaEditar';
import AdminMateriais from './pages/admin/Materiais';
import AdminChamada from './pages/admin/Chamada';
import AdminAvisos from './pages/admin/Avisos';
import AdminRelatorios from './pages/admin/Relatorios';
import AdminLayout from './components/layouts/AdminLayout';
import { ReactNode } from 'react';

// This array would typically be in a separate config file or a Sidebar component
// For the purpose of this edit, it's placed here as per the user's snippet structure.
export const adminSidebarItems = [
  { path: '/admin/dashboard', icon: 'dashboard' as const, label: 'Dashboard' },
  { path: '/admin/alunos', icon: 'users' as const, label: 'Alunos' },
  { path: '/admin/avaliacoes', icon: 'quiz' as const, label: 'Avaliacoes' },
  { path: '/admin/aulas', icon: 'book' as const, label: 'Aulas' },
  { path: '/admin/materiais', icon: 'folder' as const, label: 'Materiais' },
  { path: '/admin/chamada', icon: 'attendance' as const, label: 'Chamada' },
  { path: '/admin/avisos', icon: 'bell' as const, label: 'Avisos' },
  { path: '/admin/relatorios', icon: 'reports' as const, label: 'Relatorios' },
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

  if (role === 'aluno' && user.papel !== 'aluno') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
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
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </AdminLayout>
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
