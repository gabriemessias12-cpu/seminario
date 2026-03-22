import { useEffect, useRef, useState } from 'react';
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
import BrandMark from './BrandMark';
import { NavBar } from './ui/tubelight-navbar';

interface SidebarProps {
  type: 'student' | 'admin';
}

export default function Sidebar({ type }: SidebarProps) {
  const { user, logout } = useAuth();
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const studentLinks = [
    { name: 'Inicio', url: '/dashboard', icon: Home },
    { name: 'Conteudos', url: '/aulas', icon: Play },
    { name: 'Avaliacoes', url: '/avaliacoes', icon: ScrollText },
    { name: 'Biblioteca', url: '/materiais', icon: BookOpen },
    { name: 'Perfil', url: '/perfil', icon: UserRound }
  ];

  const adminLinks = [
    { name: 'Inicio', url: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Alunos', url: '/admin/alunos', icon: Users },
    { name: 'Avaliacoes', url: '/admin/avaliacoes', icon: ScrollText },
    { name: 'Aulas', url: '/admin/aulas', icon: Play },
    { name: 'Materiais', url: '/admin/materiais', icon: BookOpen },
    { name: 'Chamada', url: '/admin/chamada', icon: ClipboardCheck },
    { name: 'Avisos', url: '/admin/avisos', icon: BellRing },
    { name: 'Relatorios', url: '/admin/relatorios', icon: BarChart3 }
  ];

  const items = type === 'admin' ? adminLinks : studentLinks;
  const initials = user?.nome?.split(' ').map((item) => item[0]).slice(0, 2).join('').toUpperCase() || '?';

  const handleLogout = () => {
    setShowLogoutPopup(false);
    logout();
    window.location.href = '/';
  };

  // Close popup on outside click
  useEffect(() => {
    if (!showLogoutPopup) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowLogoutPopup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLogoutPopup]);

  const ProfileButton = (
    <div className="relative" ref={popupRef}>
      <button
        aria-label="Perfil e opcoes de conta"
        className="nav-user-chip flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white transition-colors hover:bg-white/10 cursor-pointer"
        onClick={() => setShowLogoutPopup((v) => !v)}
        type="button"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-white">
          {initials}
        </div>
        <div className="hidden min-w-0 lg:block">
          <strong className="block max-w-[120px] truncate text-sm leading-none text-white">{user?.nome}</strong>
          <span className="block truncate pt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/55">
            {type === 'admin' ? 'Administrador' : 'Aluno'}
          </span>
        </div>
      </button>

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
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/20 text-base font-bold text-white">
              {initials}
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
            <button
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
              onClick={handleLogout}
              type="button"
            >
              <LogOut size={16} />
              <span>Encerrar sessao</span>
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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0">
          <strong className="block truncate text-sm text-white">{user?.nome}</strong>
          <span className="block truncate text-xs text-white/45">
            {type === 'admin' ? 'Administrador' : 'Aluno'}
          </span>
        </div>
      </div>
      <button
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
        onClick={handleLogout}
        type="button"
      >
        <LogOut size={16} />
        <span>Encerrar sessao</span>
      </button>
    </div>
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
              {type === 'admin' ? 'IBVN Admin' : 'Area do Aluno'}
            </strong>
            <span className="nav-brand-subtitle block truncate pt-1 text-[11px] uppercase tracking-[0.22em] text-white/55">
              {type === 'admin' ? 'Instituto Biblico Vinha Nova' : 'Seminario Teologico IBVN'}
            </span>
          </div>
        </Link>
      )}
      actions={ProfileButton}
      mobileActions={MobileActions}
    />
  );
}
