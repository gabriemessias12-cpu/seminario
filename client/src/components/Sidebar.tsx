import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  BellRing,
  BookOpen,
  ClipboardCheck,
  Home,
  LayoutDashboard,
  LogOut,
  Play,
  ScrollText,
  UserRound,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { VINHA_NOVA_HOME_URL } from '../lib/external-links';
import BrandMark from './BrandMark';
import { NavBar } from './ui/tubelight-navbar';

const STUDENT_LINKS = [
  { name: 'Início', url: '/dashboard', icon: Home },
  { name: 'Conteúdos', url: '/aulas', icon: Play },
  { name: 'Avaliações', url: '/avaliacoes', icon: ScrollText },
  { name: 'Biblioteca', url: '/materiais', icon: BookOpen },
  { name: 'Perfil', url: '/perfil', icon: UserRound }
];

const ADMIN_LINKS = [
  { name: 'Início', url: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Alunos', url: '/admin/alunos', icon: Users },
  { name: 'Avaliações', url: '/admin/avaliacoes', icon: ScrollText },
  { name: 'Aulas', url: '/admin/aulas', icon: Play },
  { name: 'Materiais', url: '/admin/materiais', icon: BookOpen },
  { name: 'Chamada', url: '/admin/chamada', icon: ClipboardCheck },
  { name: 'Avisos', url: '/admin/avisos', icon: BellRing },
  { name: 'Relatórios', url: '/admin/relatorios', icon: BarChart3 }
];

interface SidebarProps {
  type: 'student' | 'admin';
}

export default function Sidebar({ type }: SidebarProps) {
  const { user } = useAuth();
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);

  const items = type === 'admin' ? ADMIN_LINKS : STUDENT_LINKS;

  const initials = useMemo(() =>
    user?.nome?.split(' ').map((item: string) => item[0]).slice(0, 2).join('').toUpperCase() || '?',
    [user?.nome]
  );

  const handleToggleLogoutPopup = useCallback(() => {
    setShowLogoutPopup((v) => !v);
  }, []);

  const handleLogout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    // Invalidate refresh token server-side (fire-and-forget)
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    }).catch(() => undefined);
    // Hard navigate to login — bypasses React Router and any re-render race conditions
    window.location.href = type === 'admin' ? '/admin' : '/login';
  };

  // Ensure popup is closed on unmount
  useEffect(() => {
    return () => { setShowLogoutPopup(false); };
  }, []);

  const ProfileButton = (
    <div className="relative">
      <button
        aria-label="Perfil e opções de conta"
        className="nav-user-chip flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white transition-colors hover:bg-white/10 cursor-pointer"
        onClick={handleToggleLogoutPopup}
        type="button"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-white overflow-hidden">
          {user?.foto ? <img alt="" className="h-full w-full object-cover" loading="lazy" src={user.foto} /> : initials}
        </div>
        <div className="hidden min-w-0 lg:block">
          <strong className="block max-w-[120px] truncate text-sm leading-none text-white">{user?.nome}</strong>
          <span className="block truncate pt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/55">
            {type === 'admin' ? 'Administrador' : 'Aluno'}
          </span>
        </div>
      </button>

      {/* Overlay to close popup on outside click */}
      {showLogoutPopup && (
        <div aria-hidden className="fixed inset-0 z-[190]" onClick={() => setShowLogoutPopup(false)} />
      )}

      {/* Logout Popup */}
      {showLogoutPopup && (
        <div className="absolute right-0 top-full mt-2 z-[200] w-64 rounded-2xl border border-white/10 bg-[rgba(16,10,28,0.97)] shadow-2xl backdrop-blur-xl overflow-hidden">
          {/* Popup header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-white/40">Conta</span>
            <button
              aria-label="Fechar"
              className="flex h-6 w-6 items-center justify-center rounded-full text-white/40 hover:text-white transition-colors"
              onClick={() => setShowLogoutPopup(false)}
              type="button"
            >
              <X size={14} />
            </button>
          </div>

          {/* User info */}
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/20 text-base font-bold text-white overflow-hidden">
              {user?.foto ? <img alt="" className="h-full w-full object-cover" loading="lazy" src={user.foto} /> : initials}
            </div>
            <div className="min-w-0">
              <strong className="block truncate text-sm text-white">{user?.nome}</strong>
              <span className="block truncate text-xs text-white/45">{user?.email || (type === 'admin' ? 'Administrador' : 'Aluno')}</span>
              <span className="mt-1 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {type === 'admin' ? 'Administrador' : 'Aluno'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-white/10 p-3">
            <a
              className="mb-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/8 hover:text-white"
              href={VINHA_NOVA_HOME_URL}
              rel="noreferrer"
            >
              <Home size={16} />
              <span>Ir para Vinha Nova</span>
            </a>
            <button
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
              onClick={handleLogout}
              type="button"
            >
              <LogOut size={16} />
              <span>Encerrar sessão</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // In the mobile drawer, show a simple logout button too
  const MobileActions = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-white overflow-hidden">
          {user?.foto ? <img alt="" className="h-full w-full object-cover" loading="lazy" src={user.foto} /> : initials}
        </div>
        <div className="min-w-0">
          <strong className="block truncate text-sm text-white">{user?.nome}</strong>
          <span className="block truncate text-xs text-white/45">
            {type === 'admin' ? 'Administrador' : 'Aluno'}
          </span>
        </div>
      </div>
      <a
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/8 hover:text-white"
        href={VINHA_NOVA_HOME_URL}
        rel="noreferrer"
      >
        <Home size={16} />
        <span>Ir para Vinha Nova</span>
      </a>
      <button
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
        onClick={handleLogout}
        type="button"
      >
        <LogOut size={16} />
        <span>Encerrar sessão</span>
      </button>
    </div>
  );

  const DesktopActions = (
    <>
      <a
        className="btn btn-outline btn-sm hidden xl:inline-flex"
        href={VINHA_NOVA_HOME_URL}
        rel="noreferrer"
      >
        Vinha Nova
      </a>
      {ProfileButton}
    </>
  );

  return (
    <NavBar
      items={items}
      className={type === 'admin' ? 'dashboard-navbar admin-nav-floating' : 'dashboard-navbar'}
      brand={(
        <Link className="nav-brand-link flex min-w-0 items-center gap-3 text-white" to={type === 'admin' ? '/admin/dashboard' : '/dashboard'}>
          <BrandMark className="nav-brand-mark h-11 w-11 rounded-xl bg-white p-1 object-contain shadow-[0_12px_24px_rgba(255,255,255,0.12)]" />
          <div className="nav-brand-copy min-w-0">
            <strong className="nav-brand-title block truncate text-base font-semibold leading-none text-white">
              {type === 'admin' ? 'IBVN Admin' : 'Área do Aluno'}
            </strong>
            <span className="nav-brand-subtitle block truncate pt-1 text-[11px] uppercase tracking-[0.22em] text-white/55">
              {type === 'admin' ? 'Instituto Bíblico Vinha Nova' : 'Seminário Teológico IBVN'}
            </span>
          </div>
        </Link>
      )}
      actions={DesktopActions}
      mobileActions={MobileActions}
    />
  );
}
