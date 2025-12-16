'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  Home,
  Mic,
  FileText,
  Video,
  Image,
  Sparkles,
  Music,
  PenTool,
  Scissors,
  Download,
  Search,
  Monitor,
  Cpu,
  Database,
  Activity,
  LogIn,
  Settings,
  Zap
} from 'lucide-react';
import { CreditCounter } from './CreditCounter';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  accent?: boolean;
  disabled?: boolean;
};

type NavGroup = {
  title: string;
  description?: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: 'Workspace',
    description: 'Monitor and manage your creative operations',
    items: [
      { href: '/', label: 'Home', icon: <Home size={18} /> },
      { href: '/tasks', label: 'Tasks', icon: <Activity size={18} /> },
      { href: '/library', label: 'Library', icon: <Database size={18} /> },
      { href: '/spy', label: 'Spy Tool', icon: <Search size={18} /> },
    ],
  },
  {
    title: 'Create',
    description: 'Launch new AI-powered production flows',
    items: [
      { href: '/lipsync-new', label: '+ New Lipsync', icon: <Mic size={18} />, accent: true },
      { href: '/transcription/bulk', label: '+ Bulk Transcription', icon: <FileText size={18} />, accent: true },
      { href: '/veo', label: '+ New Video', icon: <Video size={18} />, accent: true },
      { href: '/image', label: '+ New Image', icon: <Image size={18} />, accent: true },
      { href: '/enhance', label: '+ New Enhance', icon: <Sparkles size={18} />, accent: true },
      { href: '/tts', label: '+ New Text to Speech', icon: <Music size={18} />, accent: true },
      { href: '/adscript', label: '+ New Ad Script', icon: <PenTool size={18} />, accent: true },
      { href: '/auto-edit', label: '+ Auto Edit (New)', icon: <Cpu size={18} />, accent: true },
      { href: '/auto-edit-beta', label: 'Auto Edit Beta', icon: <Cpu size={18} /> },
    ],
  },
  {
    title: 'Enhance & Utilities',
    description: 'Finish assets and pull resources into your workflow',
    items: [
      { href: '/background-remove', label: 'Remove Background', icon: <Scissors size={18} />, accent: true },
      { href: '/download', label: 'TikTok Downloader', icon: <Download size={18} /> },
      { href: '/editor', label: 'Editor', icon: <Monitor size={18} /> },
    ],
  },
  {
    title: 'Account',
    description: 'Credits, billing, and access',
    items: [
      { href: '/credits', label: 'Credits', icon: <Zap size={18} /> },
      { href: '/billing', label: 'Plan & Billing', icon: <Settings size={18} /> },
      { href: '/auth', label: 'Sign in / Up', icon: <LogIn size={18} /> },
      { href: '#', label: 'Settings (soon)', icon: <Settings size={18} />, disabled: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo" title="AdzCreator">
          <div className="sidebar-logo-mark">AC</div>
          <div className="sidebar-logo-text">
            <span>AdzCreator</span>
            <span className="sidebar-logo-tagline">Minimal Lab</span>
          </div>
        </div>
        <div className="sidebar-signal">
          <span className="sidebar-signal-dot" />
          <span>Live</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div className="nav-group" key={group.title}>
            <div className="nav-group-header">
              <div>
                <div className="nav-group-title">{group.title}</div>
                {group.description && <div className="nav-group-description">{group.description}</div>}
              </div>
            </div>
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              const isAccent = item.accent;
              
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive ? 'nav-item-active' : ''} ${isAccent ? 'nav-item-accent' : ''} ${
                    item.disabled ? 'nav-item-disabled' : ''
                  }`}
                  onClick={item.disabled ? (e) => e.preventDefault() : undefined}
                  title={item.label}
                >
                  <span className="nav-item-indicator" aria-hidden />
                  <span className="nav-item-icon">{item.icon}</span>
                  <span className="nav-item-label">{item.label}</span>
                </a>
              );
            })}
          </div>
        ))}
      </nav>
      
      <div className="sidebar-credits">
        <CreditCounter />
      </div>
      
      <div className="sidebar-footer">
        <div className="sidebar-watermark">AdzCreator</div>
        <div className="sidebar-copyright">
          © {new Date().getFullYear()} AdzCreator
        </div>
      </div>
    </aside>
  );
}
