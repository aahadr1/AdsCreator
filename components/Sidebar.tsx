'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Cpu,
  Database,
  Download,
  FileText,
  Home,
  Image as ImageIcon,
  LogIn,
  Mic,
  Monitor,
  Music,
  Search,
  Settings,
  Sparkles,
  Scissors,
  Video,
  Zap,
} from 'lucide-react';
import { CreditCounter } from './CreditCounter';

type NavLink = {
  href: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
  badge?: string;
  disabled?: boolean;
};

type NavSection = {
  title: string;
  description?: string;
  items: NavLink[];
};

type QuickAction = {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
};

const quickActions: QuickAction[] = [
  { href: '/lipsync-new', label: 'New Lipsync', description: 'Swap dialogue in minutes', icon: <Mic size={18} /> },
  { href: '/veo', label: 'Generate Video', description: 'VEO · Sora · Kling', icon: <Video size={18} /> },
  { href: '/image', label: 'Create Image', description: 'Flux · GPT Image 1.5', icon: <ImageIcon size={18} /> },
  { href: '/tasks', label: 'View Tasks', description: 'Live production queue', icon: <Activity size={18} /> },
];

const navSections: NavSection[] = [
  {
    title: 'Workspace',
    description: 'Monitor and manage your creative operations',
    items: [
      { href: '/', label: 'Home', icon: <Home size={18} />, description: 'Command center' },
      { href: '/tasks', label: 'Tasks', icon: <Activity size={18} />, description: 'Track progress' },
      { href: '/library', label: 'Library', icon: <Database size={18} />, description: 'Asset archive' },
      { href: '/spy', label: 'Spy Tool', icon: <Search size={18} />, description: 'Competitor insights', badge: 'Pro' },
    ],
  },
  {
    title: 'Create',
    description: 'Launch new AI-powered flows',
    items: [
      { href: '/lipsync-new', label: 'Lipsync Studio', icon: <Mic size={18} />, description: 'Voices & dialogue', badge: 'New' },
      { href: '/veo', label: 'Video Generation', icon: <Video size={18} />, description: 'VEO · Sora · Kling' },
      { href: '/image', label: 'Image Lab', icon: <ImageIcon size={18} />, description: 'Flux · GPT Image' },
      { href: '/enhance', label: 'Enhance Footage', icon: <Sparkles size={18} />, description: 'Upscale & polish' },
      { href: '/tts', label: 'Text to Speech', icon: <Music size={18} />, description: 'Narration & VO' },
      { href: '/transcription/bulk', label: 'Bulk Transcription', icon: <FileText size={18} />, description: 'Batch transcripts' },
      { href: '/auto-edit-beta', label: 'Auto Edit Beta', icon: <Cpu size={18} />, description: 'Automated cuts', badge: 'Beta' },
    ],
  },
  {
    title: 'Utilities',
    description: 'Polish and download assets',
    items: [
      { href: '/background-remove', label: 'Background Remove', icon: <Scissors size={18} />, description: 'Image + Video' },
      { href: '/download', label: 'TikTok Downloader', icon: <Download size={18} />, description: 'Grab references' },
      { href: '/editor', label: 'Editor', icon: <Monitor size={18} />, description: 'Frame-accurate edits' },
    ],
  },
  {
    title: 'Account',
    description: 'Credits, billing, and access',
    items: [
      { href: '/credits', label: 'Credits', icon: <Zap size={18} />, description: 'Usage + limits' },
      { href: '/billing', label: 'Billing', icon: <Settings size={18} />, description: 'Plans & invoices' },
      { href: '/auth', label: 'Sign in / Up', icon: <LogIn size={18} />, description: 'Workspace access' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const year = new Date().getFullYear();

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <div className="sidebar-brand-card">
          <a className="sidebar-logo" title="AdzCreator" href="/">
            <div className="brand-chip">
              <img src="/icon.png" alt="AdzCreator favicon" />
            </div>
            <div className="sidebar-logo-text">
              <span>AdzCreator</span>
            </div>
          </a>
        </div>

        <div className="sidebar-scroll">
          <div className="sidebar-quick-actions">
            {quickActions.map((action) => (
              <a key={action.href} href={action.href} className="sidebar-quick-card">
                <div className="sidebar-quick-icon">{action.icon}</div>
                <div className="sidebar-quick-copy">
                  <span>{action.label}</span>
                  <p>{action.description}</p>
                </div>
              </a>
            ))}
          </div>

          {navSections.map((section) => (
            <section className="sidebar-section" key={section.title}>
              <div className="sidebar-section-heading">
                <p>{section.title}</p>
                {section.description && <span>{section.description}</span>}
              </div>
              <div className="sidebar-nav-grid">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`sidebar-nav-item ${isActive ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={item.disabled ? (e) => e.preventDefault() : undefined}
                    >
                      <span className="sidebar-nav-indicator" aria-hidden />
                      <div className="sidebar-nav-icon">{item.icon}</div>
                      <div className="sidebar-nav-copy">
                        <div className="sidebar-nav-title">
                          <span>{item.label}</span>
                          {item.badge && <span className="sidebar-nav-badge">{item.badge}</span>}
                        </div>
                        {item.description && <p>{item.description}</p>}
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="sidebar-footer-card">
          <div className="sidebar-credits-header">
            <div>
              <div className="sidebar-credits-title">Credits</div>
              <div className="sidebar-credits-subtitle">Track usage in real time</div>
            </div>
            <span className="sidebar-chip">Live</span>
          </div>
          <CreditCounter />
        </div>

        <div className="sidebar-footer-meta">
          <span>© {year} AdzCreator</span>
          <span>Build fast · Iterate daily</span>
        </div>
      </div>
    </aside>
  );
}
