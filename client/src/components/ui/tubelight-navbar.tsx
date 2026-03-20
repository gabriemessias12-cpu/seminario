import { ReactNode, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { LucideIcon } from "lucide-react";
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
  actionsInline?: boolean;
}

export function NavBar({ items, className, brand, actions, actionsInline = false }: NavBarProps) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(items[0]?.name ?? "");

  useEffect(() => {
    const hash = location.hash || "#inicio";
    const currentItem = items.find((item) =>
      item.url.startsWith("#")
        ? item.url === hash
        : location.pathname === item.url || location.pathname.startsWith(`${item.url}/`)
    );

    if (currentItem) {
      setActiveTab(currentItem.name);
    }
  }, [items, location.hash, location.pathname]);

  return (
    <div
      className={cn(
        "fixed top-0 left-1/2 z-50 w-[min(1320px,calc(100vw-1rem))] -translate-x-1/2 px-1 pt-3 sm:pt-5",
        className,
      )}
    >
      <div className="rounded-[32px] border border-white/10 bg-[rgba(16,10,28,0.86)] shadow-[0_24px_70px_rgba(7,4,16,0.42)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap sm:px-4">
          {brand ? <div className="flex min-w-0 shrink-0 items-center">{brand}</div> : null}

          <div className="order-3 flex w-full min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:order-2 sm:w-auto sm:flex-1 sm:justify-center">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              const commonClassName = cn(
                "relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
                "text-white hover:text-white",
                isActive && "bg-white/8 text-white",
              );
              const indicator = isActive ? (
                <motion.div
                  layoutId="lamp"
                  className="absolute inset-0 w-full rounded-full bg-primary/10 -z-10"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
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
                  <span className="hidden md:inline">{item.name}</span>
                  <span className="md:hidden">
                    <Icon size={18} strokeWidth={2.5} />
                  </span>
                  {indicator}
                </>
              );

              if (item.url.startsWith("#")) {
                return (
                  <a
                    key={item.name}
                    href={item.url}
                    onClick={() => setActiveTab(item.name)}
                    className={commonClassName}
                  >
                    {content}
                  </a>
                );
              }

              return (
                <Link
                  key={item.name}
                  to={item.url}
                  onClick={() => setActiveTab(item.name)}
                  className={commonClassName}
                >
                  {content}
                </Link>
              );
            })}

            {actions && actionsInline ? (
              <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
                {actions}
              </div>
            ) : null}
          </div>

          {actions && !actionsInline ? (
            <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
