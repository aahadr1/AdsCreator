'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { CommandPalette, type Command } from './CommandPalette';
import { useCredits } from '../lib/creditContext';
import { FaviconTaskIndicator } from './FaviconTaskIndicator';

type LayoutWrapperProps = {
  children: React.ReactNode;
};

type PageMeta = {
  title: string;
  description: string;
  category: string;
};

const pageDictionary: Record<string, PageMeta> = {
  '/': { title: 'Dashboard', description: 'Insight into production velocity and recent wins.', category: 'Overview' },
  '/assistant': { title: 'Assistant', description: 'Plan and run multimodal workflows.', category: 'Assistant' },
  '/lipsync-new': { title: 'Lipsync Studio', description: 'Upload a clip and synchronize audio with AI precision.', category: 'Generator' },
  '/veo': { title: 'Video Generation', description: 'Storyboard and render AI-powered spots.', category: 'Generator' },
  '/image': { title: 'Image Creation', description: 'Produce brand-ready visuals from text prompts.', category: 'Generator' },
  '/enhance': { title: 'Video Enhancement', description: 'Upscale and refine footage in minutes.', category: 'Enhance' },
  '/tts': { title: 'Text to Speech', description: 'Create premium voiceovers from scripts.', category: 'Generator' },
  '/tasks': { title: 'Task Command Center', description: 'Track status, rerun jobs, and resolve blockers.', category: 'Management' },
  '/credits': { title: 'Credit Management', description: 'Monitor usage and replenish your balance.', category: 'Account' },
  '/billing': { title: 'Billing & Plans', description: 'Review your plan, invoices, and upgrade paths.', category: 'Account' },
};

const commandCatalog: Command[] = [
  { label: 'Dashboard', href: '/', description: 'Overview & insights', shortcut: 'G D' },
  { label: 'Assistant', href: '/assistant', description: 'Plan + execute workflows', shortcut: 'G A' },
  { label: 'New Lipsync', href: '/lipsync-new', description: 'Generator workflow', shortcut: 'C L' },
  { label: 'New Video', href: '/veo', description: 'Generate ads from scripts', shortcut: 'C V' },
  { label: 'Image Lab', href: '/image', description: 'Create ad-ready imagery', shortcut: 'C I' },
  { label: 'Enhance Footage', href: '/enhance', description: 'Upscale & polish', shortcut: 'C E' },
  { label: 'Tasks', href: '/tasks', description: 'Monitor job queue', shortcut: 'G T' },
  { label: 'Credit Center', href: '/credits', description: 'Track remaining credits', shortcut: 'G C' },
  { label: 'Billing', href: '/billing', description: 'Plans and invoices', shortcut: 'G B' },
  { label: 'Library', href: '/library', description: 'Assets and references', shortcut: 'G L' },
  { label: 'Auth', href: '/auth', description: 'Sign in / Sign up', shortcut: 'G A' },
];

function getPageMeta(pathname: string): PageMeta {
  return pageDictionary[pathname] ?? {
    title: pathname === '/' ? 'Dashboard' : pathname.replace(/\//g, ' ').trim() || 'Workspace',
    description: 'Navigate your creative workspace.',
    category: 'Workspace',
  };
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const isDashboard = pathname === '/';
  const [commandOpen, setCommandOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { credits } = useCredits();
  const pageMeta = useMemo(() => getPageMeta(pathname), [pathname]);
  const commandList = useMemo(() => commandCatalog, []);

  const routeSlug = useMemo(() => {
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

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const palette = (
    <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} commands={commandList} />
  );

  return (
    <div className={`workspace-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <FaviconTaskIndicator />
      <Sidebar />
      <main className="workspace-main">
        <header className="workspace-header">
          <div className="workspace-title-block">
            <p className="workspace-eyebrow">{pageMeta.category}</p>
            <h1 className="workspace-title">{pageMeta.title}</h1>
            <p className="workspace-description">{pageMeta.description}</p>
          </div>
          <div className="workspace-tools">
            <button
              type="button"
              className="workspace-toggle-btn"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            >
              {sidebarCollapsed ? 'Show Menu' : 'Hide Menu'}
            </button>
            <div className="workspace-search">
              <input
                type="search"
                placeholder="Search the workspace"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                aria-label="Search the workspace"
              />
              <span className="workspace-search-hint">⌘K</span>
            </div>
            <button
              type="button"
              className="workspace-command-btn"
              onClick={() => setCommandOpen(true)}
              aria-label="Open command palette"
            >
              Command
            </button>
            <div className="workspace-credits">
              <div className="workspace-credits-label">Credits</div>
              <div className="workspace-credits-value">
                <span>{credits ? credits.remaining_credits : '—'}</span>
                {credits?.monthly_limit ? (
                  <span className="workspace-credits-limit">/ {credits.monthly_limit}</span>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        <div className="workspace-content">
          {isDashboard ? (
            <div className="page-shell dashboard-shell">{children}</div>
          ) : (
            <div className="page-shell">{children}</div>
          )}
        </div>
      </main>
      {palette}
    </div>
  );
}
