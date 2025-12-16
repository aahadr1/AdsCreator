'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

type LayoutWrapperProps = {
  children: React.ReactNode;
};

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const isDashboard = pathname === '/';
  const routeSlug = React.useMemo(() => {
    if (!pathname) return 'page';
    if (pathname === '/') return 'dashboard';
    const slug = pathname.replace(/^\/+/, '').replace(/\/+/g, '-').replace(/[^a-z0-9-]/gi, '-');
    return slug || 'page';
  }, [pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.dataset.page = routeSlug;
    return () => {
      if (document.body.dataset.page === routeSlug) {
        delete document.body.dataset.page;
      }
    };
  }, [routeSlug]);

  if (isDashboard) {
    return <>{children}</>;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <div className="app-header">
          <div className="app-header-content">
            <div className="app-tagline">Create viral ads with AI.</div>
            <div className="app-user">
              <div className="user-email" id="user-email"></div>
              <div className="user-avatar-small"></div>
              <a href="/billing" className="btn small" title="View your plan" aria-label="View your plan">
                Plan
              </a>
            </div>
          </div>
        </div>
        <div className="app-content">
          {children}
        </div>
      </main>
    </div>
  );
}
