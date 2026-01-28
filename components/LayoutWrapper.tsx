'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { CommandPalette, type Command } from './CommandPalette';
import { useCredits } from '../lib/creditContext';
import { FaviconTaskIndicator } from './FaviconTaskIndicator';
import { Search, Command as CommandIcon, Menu, Zap } from 'lucide-react';

type LayoutWrapperProps = {
  children: React.ReactNode;
};

type PageMeta = {
  title: string;
  description: string;
  category: string;
};

const pageDictionary: Record<string, PageMeta> = {
  '/': { title: 'Dashboard', description: 'Overview of your creative workspace', category: 'Home' },
  '/assistant': { title: 'AI Assistant', description: 'Your creative AI partner', category: 'Create' },
  '/lipsync-new': { title: 'Lipsync Studio', description: 'Synchronize audio with AI', category: 'Tools' },
  '/lipsync': { title: 'Lipsync', description: 'Sync lips to audio', category: 'Tools' },
  '/veo': { title: 'Video Generation', description: 'Create AI-powered videos', category: 'Create' },
  '/image': { title: 'Image Creation', description: 'Generate stunning visuals', category: 'Create' },
  '/enhance': { title: 'Enhance', description: 'Upscale and refine footage', category: 'Tools' },
  '/tts': { title: 'Text to Speech', description: 'Generate voiceovers', category: 'Create' },
  '/tasks': { title: 'Tasks', description: 'Monitor your jobs', category: 'Account' },
  '/credits': { title: 'Credits', description: 'Manage your usage', category: 'Account' },
  '/billing': { title: 'Billing', description: 'Plans and invoices', category: 'Account' },
  '/transcription': { title: 'Transcription', description: 'Convert audio to text', category: 'Tools' },
  '/background-remove': { title: 'Background Removal', description: 'Remove backgrounds', category: 'Tools' },
  '/download': { title: 'Download', description: 'Get your assets', category: 'Tools' },
  '/spy': { title: 'Ad Spy', description: 'Research competitors', category: 'Tools' },
  '/adscript': { title: 'Ad Script', description: 'Generate scripts', category: 'Create' },
  '/editor': { title: 'Editor', description: 'Edit your assets', category: 'Tools' },
  '/auth': { title: 'Sign In', description: 'Access your account', category: 'Account' },
};

const commandCatalog: Command[] = [
  { label: 'Dashboard', href: '/', description: 'Home', shortcut: 'G D' },
  { label: 'AI Assistant', href: '/assistant', description: 'Start creating', shortcut: 'G A' },
  { label: 'Generate Image', href: '/image', description: 'Create visuals', shortcut: 'C I' },
  { label: 'Generate Video', href: '/veo', description: 'Create videos', shortcut: 'C V' },
  { label: 'Text to Speech', href: '/tts', description: 'Create voiceovers', shortcut: 'C T' },
  { label: 'Lipsync', href: '/lipsync', description: 'Sync audio', shortcut: 'C L' },
  { label: 'Enhance', href: '/enhance', description: 'Upscale footage', shortcut: 'C E' },
  { label: 'Tasks', href: '/tasks', description: 'View jobs', shortcut: 'G T' },
  { label: 'Credits', href: '/credits', description: 'View balance', shortcut: 'G C' },
  { label: 'Billing', href: '/billing', description: 'Manage plan', shortcut: 'G B' },
];

function getPageMeta(pathname: string): PageMeta {
  // Handle dynamic routes like /storyboard/[id]
  const basePath = pathname.split('/').slice(0, 2).join('/');
  
  return pageDictionary[pathname] ?? pageDictionary[basePath] ?? {
    title: pathname === '/' ? 'Dashboard' : pathname.replace(/^\//, '').split('/')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: '',
    category: 'Workspace',
  };
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const isFullWidth = pathname === '/assistant' || pathname.startsWith('/storyboard/');
  const [commandOpen, setCommandOpen] = useState(false);
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
            <button
              type="button"
              className="workspace-menu-btn"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label="Toggle menu"
            >
              <Menu size={18} />
            </button>
            <h1 className="workspace-title">{pageMeta.title}</h1>
          </div>
          <div className="workspace-tools">
            <button
              type="button"
              className="workspace-search-btn"
              onClick={() => setCommandOpen(true)}
              aria-label="Search"
            >
              <Search size={16} />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>
            <div className="workspace-credits">
              <Zap size={14} />
              <div className="workspace-credits-value">
                <span>{credits ? credits.remaining_credits.toLocaleString() : '—'}</span>
                {credits?.monthly_limit ? (
                  <span className="workspace-credits-limit">/ {credits.monthly_limit.toLocaleString()}</span>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        <div className={`workspace-content ${isFullWidth ? 'workspace-content-full' : ''}`}>
          <div className="page-shell">{children}</div>
        </div>
      </main>
      {palette}
    </div>
  );
}
