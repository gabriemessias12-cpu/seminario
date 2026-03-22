type IconName =
  | 'dashboard'
  | 'play'
  | 'materials'
  | 'profile'
  | 'students'
  | 'attendance'
  | 'reports'
  | 'logout'
  | 'menu'
  | 'book'
  | 'search'
  | 'bell'
  | 'clock'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'arrow-left'
  | 'download'
  | 'external'
  | 'lock'
  | 'notes'
  | 'quiz'
  | 'pause'
  | 'volume'
  | 'mute'
  | 'check'
  | 'file'
  | 'folder'
  | 'settings'
  | 'shield'
  | 'target'
  | 'home'
  | 'library'
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'spotify'
  | 'map-pin'
  | 'fullscreen'
  | 'fullscreen-exit'
  | 'alert-triangle'
  | 'users';

interface AppIconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export default function AppIcon({ name, size = 20, className, strokeWidth = 1.8 }: AppIconProps) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth
  };

  const icon = (() => {
    switch (name) {
      case 'dashboard':
        return (
          <>
            <rect x="3" y="3" width="7" height="7" rx="1.5" {...common} />
            <rect x="14" y="3" width="7" height="11" rx="1.5" {...common} />
            <rect x="3" y="14" width="7" height="7" rx="1.5" {...common} />
            <rect x="14" y="18" width="7" height="3" rx="1.5" {...common} />
          </>
        );
      case 'play':
        return <path d="M8 6v12l10-6-10-6Z" {...common} />;
      case 'pause':
        return (
          <>
            <rect x="7" y="6" width="3" height="12" rx="1" {...common} />
            <rect x="14" y="6" width="3" height="12" rx="1" {...common} />
          </>
        );
      case 'materials':
      case 'library':
        return (
          <>
            <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v16.5A1.5 1.5 0 0 0 18.5 18H7.5A2.5 2.5 0 0 0 5 20.5V5.5Z" {...common} />
            <path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H20" {...common} />
          </>
        );
      case 'book':
        return (
          <>
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 0 4 23.5V5.5Z" {...common} />
            <path d="M9 7h6" {...common} />
            <path d="M9 11h7" {...common} />
          </>
        );
      case 'profile':
        return (
          <>
            <circle cx="12" cy="8" r="4" {...common} />
            <path d="M5 20c1.8-3 4.2-4.5 7-4.5S17.2 17 19 20" {...common} />
          </>
        );
      case 'students':
        return (
          <>
            <circle cx="9" cy="9" r="3" {...common} />
            <circle cx="17" cy="10" r="2.5" {...common} />
            <path d="M4.5 19c1.2-2.7 3.2-4 5.9-4 2.5 0 4.5 1.1 5.8 3.4" {...common} />
            <path d="M16.2 17.5c.8-1.4 2-2.2 3.6-2.5" {...common} />
          </>
        );
      case 'attendance':
        return (
          <>
            <rect x="4" y="3" width="16" height="18" rx="2.5" {...common} />
            <path d="M8 7h8" {...common} />
            <path d="M8 11h8" {...common} />
            <path d="m8 15 2 2 4-4" {...common} />
          </>
        );
      case 'reports':
        return (
          <>
            <path d="M5 19V9" {...common} />
            <path d="M12 19V5" {...common} />
            <path d="M19 19v-7" {...common} />
            <path d="M3 19h18" {...common} />
          </>
        );
      case 'logout':
        return (
          <>
            <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" {...common} />
            <path d="m14 8 4 4-4 4" {...common} />
            <path d="M9 12h9" {...common} />
          </>
        );
      case 'menu':
        return (
          <>
            <path d="M4 7h16" {...common} />
            <path d="M4 12h16" {...common} />
            <path d="M4 17h16" {...common} />
          </>
        );
      case 'search':
        return (
          <>
            <circle cx="11" cy="11" r="6" {...common} />
            <path d="m19 19-3.4-3.4" {...common} />
          </>
        );
      case 'bell':
        return (
          <>
            <path d="M8 17h8" {...common} />
            <path d="M10 20a2 2 0 0 0 4 0" {...common} />
            <path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 1.5H4.5L6 17Z" {...common} />
          </>
        );
      case 'clock':
        return (
          <>
            <circle cx="12" cy="12" r="8.5" {...common} />
            <path d="M12 7.5v5l3.5 2" {...common} />
          </>
        );
      case 'chevron-right':
        return <path d="m9 6 6 6-6 6" {...common} />;
      case 'chevron-left':
        return <path d="m15 6-6 6 6 6" {...common} />;
      case 'chevron-down':
        return <path d="m6 9 6 6 6-6" {...common} />;
      case 'arrow-left':
        return (
          <>
            <path d="m9 6-6 6 6 6" {...common} />
            <path d="M4 12h16" {...common} />
          </>
        );
      case 'download':
        return (
          <>
            <path d="M12 4v10" {...common} />
            <path d="m8 10 4 4 4-4" {...common} />
            <path d="M5 19h14" {...common} />
          </>
        );
      case 'external':
        return (
          <>
            <path d="M13 5h6v6" {...common} />
            <path d="M10 14 19 5" {...common} />
            <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" {...common} />
          </>
        );
      case 'lock':
        return (
          <>
            <rect x="6" y="11" width="12" height="9" rx="2" {...common} />
            <path d="M9 11V8a3 3 0 0 1 6 0v3" {...common} />
          </>
        );
      case 'notes':
        return (
          <>
            <path d="M7 4h10l3 3v13H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" {...common} />
            <path d="M14 4v4h4" {...common} />
            <path d="M9 11h6" {...common} />
            <path d="M9 15h6" {...common} />
          </>
        );
      case 'quiz':
        return (
          <>
            <path d="M9.2 9a3 3 0 1 1 4.6 2.5c-.8.5-1.3 1-1.3 2" {...common} />
            <path d="M12 18h.01" {...common} />
            <circle cx="12" cy="12" r="9" {...common} />
          </>
        );
      case 'volume':
        return (
          <>
            <path d="M4 14h4l5 4V6L8 10H4Z" {...common} />
            <path d="M17 9a5 5 0 0 1 0 6" {...common} />
            <path d="M19 7a8 8 0 0 1 0 10" {...common} />
          </>
        );
      case 'mute':
        return (
          <>
            <path d="M4 14h4l5 4V6L8 10H4Z" {...common} />
            <path d="m17 10 4 4" {...common} />
            <path d="m21 10-4 4" {...common} />
          </>
        );
      case 'check':
        return (
          <>
            <circle cx="12" cy="12" r="8.5" {...common} />
            <path d="m8.5 12.5 2.2 2.2 4.8-5" {...common} />
          </>
        );
      case 'file':
        return (
          <>
            <path d="M8 3h7l4 4v14H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" {...common} />
            <path d="M15 3v4h4" {...common} />
          </>
        );
      case 'folder':
        return (
          <>
            <path d="M3 8h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" {...common} />
            <path d="M3 8V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2" {...common} />
          </>
        );
      case 'settings':
        return (
          <>
            <path d="M12 8.8A3.2 3.2 0 1 1 8.8 12 3.2 3.2 0 0 1 12 8.8Z" {...common} />
            <path d="M12 3v2.2" {...common} />
            <path d="M12 18.8V21" {...common} />
            <path d="m4.9 4.9 1.6 1.6" {...common} />
            <path d="m17.5 17.5 1.6 1.6" {...common} />
            <path d="M3 12h2.2" {...common} />
            <path d="M18.8 12H21" {...common} />
            <path d="m4.9 19.1 1.6-1.6" {...common} />
            <path d="m17.5 6.5 1.6-1.6" {...common} />
          </>
        );
      case 'shield':
        return (
          <>
            <path d="M12 3 5.5 5.5v5.2c0 4.1 2.5 7.6 6.5 9.3 4-1.7 6.5-5.2 6.5-9.3V5.5L12 3Z" {...common} />
            <path d="m9.2 12 1.8 1.8 3.8-4.1" {...common} />
          </>
        );
      case 'target':
        return (
          <>
            <circle cx="12" cy="12" r="8.5" {...common} />
            <circle cx="12" cy="12" r="4.5" {...common} />
            <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          </>
        );
      case 'home':
        return (
          <>
            <path d="m4 11 8-6 8 6" {...common} />
            <path d="M6.5 10.5V20h11v-9.5" {...common} />
            <path d="M10 20v-5h4v5" {...common} />
          </>
        );
      case 'instagram':
        return (
          <>
            <rect x="4" y="4" width="16" height="16" rx="4.5" {...common} />
            <circle cx="12" cy="12" r="3.6" {...common} />
            <circle cx="17.1" cy="6.9" r="0.8" fill="currentColor" stroke="none" />
          </>
        );
      case 'facebook':
        return (
          <>
            <path d="M13.2 20v-6.1h2.6l.4-3h-3v-1.9c0-.9.3-1.6 1.6-1.6h1.5V4.7c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.9v2.2H8v3h2.4V20" {...common} />
          </>
        );
      case 'youtube':
        return (
          <>
            <path d="M21 12.2c0 1.8-.2 3.2-.5 4.1a2.9 2.9 0 0 1-2 2c-1 .3-3.2.5-6.5.5s-5.5-.2-6.5-.5a2.9 2.9 0 0 1-2-2C3.2 15.4 3 14 3 12.2s.2-3.2.5-4.1a2.9 2.9 0 0 1 2-2c1-.3 3.2-.5 6.5-.5s5.5.2 6.5.5a2.9 2.9 0 0 1 2 2c.3.9.5 2.3.5 4.1Z" {...common} />
            <path d="m10 9 5 3-5 3V9Z" {...common} />
          </>
        );
      case 'spotify':
        return (
          <>
            <circle cx="12" cy="12" r="9" {...common} />
            <path d="M8 10.1c2.6-.8 5.6-.6 8 .7" {...common} />
            <path d="M8.7 13c2.1-.5 4.4-.3 6.2.7" {...common} />
            <path d="M9.5 15.7c1.4-.3 2.9-.2 4.2.5" {...common} />
          </>
        );
      case 'map-pin':
        return (
          <>
            <path d="M12 20s5.5-5.4 5.5-10A5.5 5.5 0 1 0 6.5 10c0 4.6 5.5 10 5.5 10Z" {...common} />
            <circle cx="12" cy="10" r="2.1" {...common} />
          </>
        );
      case 'fullscreen':
        return (
          <>
            <path d="M8 3H5a2 2 0 0 0-2 2v3" {...common} />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" {...common} />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" {...common} />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" {...common} />
          </>
        );
      case 'fullscreen-exit':
        return (
          <>
            <path d="M8 3v3a2 2 0 0 1-2 2H3" {...common} />
            <path d="M21 8h-3a2 2 0 0 1-2-2V3" {...common} />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" {...common} />
            <path d="M16 21v-3a2 2 0 0 1 2-2h3" {...common} />
          </>
        );
      case 'alert-triangle':
        return (
          <>
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" {...common} />
            <line x1="12" y1="9" x2="12" y2="13" {...common} />
            <line x1="12" y1="17" x2="12.01" y2="17" {...common} />
          </>
        );
      case 'users':
        return (
          <>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...common} />
            <circle cx="9" cy="7" r="4" {...common} />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" {...common} />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" {...common} />
          </>
        );
      default:
        return <circle cx="12" cy="12" r="8" {...common} />;
    }
  })();

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}
