'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

type LayoutWrapperProps = {
  children: React.ReactNode;
};

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const isDashboard = pathname === '/';

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
