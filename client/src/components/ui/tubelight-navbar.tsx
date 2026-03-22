import { ReactNode, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { LucideIcon, Menu, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface NavItem {
  name: string;
  url: string;
  icon: LucideIcon;
}

interface NavBarProps {
  items: NavItem[];
  className?: string;
  brand?: ReactNode;
  actions?: ReactNode;
  mobileActions?: ReactNode;
  actionsInline?: boolean;
}

export function NavBar({ items, className, brand, actions, mobileActions, actionsInline = false }: NavBarProps) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(items[0]?.name ?? "");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hash = location.hash || "#inicio";
    const currentItem = items.find((item) =>
      item.url.startsWith("#")
        ? item.url === hash
        : location.pathname === item.url || location.pathname.startsWith(`${item.url}/`)
    );
    if (currentItem) setActiveTab(currentItem.name);
  }, [items, location.hash, location.pathname]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [drawerOpen]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const drawerFooterContent = mobileActions ?? actions;

  return (
    <>
      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            ref={drawerRef}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed left-0 top-0 z-[70] h-full w-[min(300px,85vw)] border-r border-white/10 bg-[rgba(12,8,22,0.98)] shadow-2xl lg:hidden flex flex-col"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              {brand && <div className="min-w-0 flex-1">{brand}</div>}
              <button
                aria-label="Fechar menu"
                className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
                onClick={() => setDrawerOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Nav Items */}
            <nav className="flex-1 overflow-y-auto p-3" aria-label="Navegação principal">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Páginas
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.name;
                  const inner = (
                    <span
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all min-h-[48px]",
                        isActive
                          ? "bg-primary/15 text-white border border-primary/25 shadow-sm"
                          : "text-white/65 hover:bg-white/8 hover:text-white border border-transparent"
                      )}
                    >
                      <Icon size={18} strokeWidth={2} className={isActive ? "text-primary shrink-0" : "shrink-0"} />
                      <span className="truncate">{item.name}</span>
                      {isActive && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </span>
                  );

                  if (item.url.startsWith("#")) {
                    return (
                      <li key={item.name}>
                        <a href={item.url} onClick={() => { setActiveTab(item.name); setDrawerOpen(false); }}>
                          {inner}
                        </a>
                      </li>
                    );
                  }
                  return (
                    <li key={item.name}>
                      <Link to={item.url} onClick={() => { setActiveTab(item.name); setDrawerOpen(false); }}>
                        {inner}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Drawer Footer */}
            {drawerFooterContent && (
              <div className="border-t border-white/10 p-4">
                {drawerFooterContent}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Top NavBar ─── */}
      <div
        className={cn(
          "nav-shell fixed top-0 left-1/2 z-50 w-[min(1320px,calc(100vw-0.75rem))] -translate-x-1/2 px-1 pt-2 sm:pt-5",
          className,
        )}
      >
        <div className="nav-surface rounded-[28px] border border-white/10 bg-[rgba(16,10,28,0.86)] shadow-[0_24px_70px_rgba(7,4,16,0.42)] backdrop-blur-xl">
          <div className="nav-row flex items-center gap-2 px-2.5 py-2.5 sm:gap-3 sm:px-4 sm:py-3">

            {/* Brand */}
            {brand ? (
              <div className="nav-brand-slot flex min-w-0 flex-1 shrink items-center sm:flex-none">
                {brand}
              </div>
            ) : null}

            {/* Desktop Nav Items (md+) */}
            <div className="nav-items-track hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex lg:gap-1">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.name;
                const commonClassName = cn(
                  "nav-item relative inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full px-2.5 py-2 text-[0.8rem] font-semibold transition-colors lg:px-5 lg:py-2.5 lg:text-[0.85rem]",
                  "text-white/80 hover:text-white",
                  isActive && "text-white",
                );
                const indicator = isActive ? (
                  <motion.div
                    layoutId="lamp"
                    className="absolute inset-0 w-full rounded-full bg-primary/10 -z-10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-1 w-8 rounded-t-full bg-primary">
                      <div className="absolute -left-2 -top-2 h-6 w-12 rounded-full bg-primary/20 blur-md" />
                      <div className="absolute -top-1 h-6 w-8 rounded-full bg-primary/20 blur-md" />
                      <div className="absolute left-2 top-0 h-4 w-4 rounded-full bg-primary/20 blur-sm" />
                    </div>
                  </motion.div>
                ) : null;

                const content = (
                  <>
                    <span className="hidden lg:inline">{item.name}</span>
                    <Icon size={17} strokeWidth={2.5} className="lg:hidden" />
                    {indicator}
                  </>
                );

                if (item.url.startsWith("#")) {
                  return (
                    <a key={item.name} aria-label={item.name} href={item.url} onClick={() => setActiveTab(item.name)} className={commonClassName}>
                      {content}
                    </a>
                  );
                }
                return (
                  <Link key={item.name} aria-label={item.name} to={item.url} onClick={() => setActiveTab(item.name)} className={commonClassName}>
                    {content}
                  </Link>
                );
              })}

              {/* Actions inline on desktop */}
              {actions && actionsInline && (
                <div className="nav-actions-slot ml-auto flex shrink-0 items-center gap-2 pl-2">
                  {actions}
                </div>
              )}
            </div>

            {/* Desktop Actions slot (not inline) */}
            {actions && !actionsInline && (
              <div className="nav-actions-slot hidden shrink-0 items-center gap-2 lg:flex">
                {actions}
              </div>
            )}

            {/* Mobile: actions + hamburger */}
            <div className="ml-auto flex shrink-0 items-center gap-2 lg:hidden">
              {/* Show compact actions on mobile (profile button, or CTA button) */}
              {actions && (
                <div className="flex shrink-0 items-center">
                  {actions}
                </div>
              )}
              <button
                aria-label="Abrir menu de navegação"
                aria-expanded={drawerOpen}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 active:scale-95"
                onClick={() => setDrawerOpen(true)}
                type="button"
              >
                <Menu size={19} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
