import { ReactNode } from 'react';
import Sidebar from '../Sidebar';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="layout admin-layout">
      <Sidebar type="admin" />
      <main className="main-content admin-main">
        {children}
      </main>
    </div>
  );
}
