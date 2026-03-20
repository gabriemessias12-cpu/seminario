import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BellRing,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  Play,
  UserRound,
  Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BrandMark from './BrandMark';
import { NavBar } from './ui/tubelight-navbar';

interface SidebarProps {
  type: 'student' | 'admin';
}

export default function Sidebar({ type }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const studentLinks = [
    { name: 'Inicio', url: '/dashboard', icon: Home },
    { name: 'Conteudos', url: '/aulas', icon: Play },
    { name: 'Biblioteca', url: '/materiais', icon: BookOpen },
    { name: 'Perfil', url: '/perfil', icon: UserRound }
  ];

  const adminLinks = [
    { name: 'Inicio', url: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Alunos', url: '/admin/alunos', icon: Users },
    { name: 'Aulas', url: '/admin/aulas', icon: Play },
    { name: 'Materiais', url: '/admin/materiais', icon: BookOpen },
    { name: 'Chamada', url: '/admin/chamada', icon: ClipboardCheck },
    { name: 'Avisos', url: '/admin/avisos', icon: BellRing },
    { name: 'Relatorios', url: '/admin/relatorios', icon: BarChart3 }
  ];

  const items = type === 'admin' ? adminLinks : studentLinks;
  const initials = user?.nome?.split(' ').map((item) => item[0]).slice(0, 2).join('').toUpperCase() || '?';

  const handleLogout = () => {
    logout();
    navigate(type === 'admin' ? '/admin' : '/login');
  };

  return (
    <NavBar
      items={items}
      className={type === 'admin' ? 'dashboard-navbar admin-nav-floating' : 'dashboard-navbar'}
      brand={(
        <Link className="flex items-center gap-3 text-white" to={type === 'admin' ? '/admin/dashboard' : '/dashboard'}>
          <BrandMark className="h-11 w-11 rounded-xl bg-white p-1 object-contain shadow-[0_12px_24px_rgba(255,255,255,0.12)]" />
          <div className="min-w-0">
            <strong className="block truncate text-base font-semibold leading-none text-white">
              {type === 'admin' ? 'Painel Vinha Nova' : 'Area do Aluno'}
            </strong>
            <span className="block truncate pt-1 text-[11px] uppercase tracking-[0.22em] text-white/55">
              {type === 'admin' ? 'Gestao do Seminario' : 'Seminario Teologico'}
            </span>
          </div>
        </Link>
      )}
      actions={(
        <>
          <div className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white lg:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <strong className="block truncate text-sm leading-none text-white">{user?.nome}</strong>
              <span className="block truncate pt-1 text-[10px] uppercase tracking-[0.2em] text-white/55">
                {type === 'admin' ? 'Administrador' : 'Aluno'}
              </span>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            onClick={handleLogout}
            type="button"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </>
      )}
    />
  );
}
