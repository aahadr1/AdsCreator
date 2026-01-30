'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Home,
  Sparkles,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  Scissors,
  Download,
  Eraser,
  Search,
  LogIn,
  CreditCard,
  Zap,
  MessageSquare,
  Layers,
  PenTool,
  Users,
} from 'lucide-react';
import { CreditCounter } from './CreditCounter';

type NavLink = {
  href: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
  badge?: string;
};

type NavSection = {
  title: string;
  items: NavLink[];
};

const navSections: NavSection[] = [
  {
    title: 'Main',
    items: [
      { href: '/', label: 'Dashboard', icon: <Home size={16} /> },
      { href: '/assistant', label: 'Assistant', icon: <MessageSquare size={16} />, badge: 'AI' },
    ],
  },
  {
    title: 'Create',
    items: [
      { href: '/image', label: 'Image', icon: <ImageIcon size={16} /> },
      { href: '/veo', label: 'Video', icon: <Video size={16} /> },
      { href: '/tts', label: 'Text to Speech', icon: <Mic size={16} /> },
      { href: '/adscript', label: 'Ad Script', icon: <FileText size={16} /> },
      { href: '/influencer-lab', label: 'Influencer Lab', icon: <Users size={16} />, badge: 'NEW' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { href: '/transcription', label: 'Transcription', icon: <FileText size={16} /> },
      { href: '/lipsync', label: 'Lipsync', icon: <Sparkles size={16} /> },
      { href: '/enhance', label: 'Enhance', icon: <Scissors size={16} /> },
      { href: '/background-remove', label: 'BG Remove', icon: <Eraser size={16} /> },
      { href: '/download', label: 'Download', icon: <Download size={16} /> },
      { href: '/spy', label: 'Ad Spy', icon: <Search size={16} /> },
      { href: '/editor', label: 'Editor', icon: <PenTool size={16} /> },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/tasks', label: 'Tasks', icon: <Activity size={16} /> },
      { href: '/credits', label: 'Credits', icon: <Zap size={16} /> },
      { href: '/billing', label: 'Billing', icon: <CreditCard size={16} /> },
      { href: '/auth', label: 'Sign In', icon: <LogIn size={16} /> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        {/* Brand */}
        <div className="sidebar-brand-card">
          <a className="sidebar-logo" title="AdsCreator" href="/">
            <div className="brand-chip">
              <Layers size={18} />
            </div>
            <div className="sidebar-logo-text">
              <span>AdsCreator</span>
            </div>
          </a>
        </div>

        {/* Navigation */}
        <div className="sidebar-scroll">
          {/* Quick Action */}
          <div className="sidebar-quick-actions">
            <a href="/assistant" className="sidebar-quick-card sidebar-quick-main">
              <div className="sidebar-quick-icon">
                <Sparkles size={18} />
              </div>
              <div className="sidebar-quick-copy">
                <span>New Project</span>
                <p>Start with AI</p>
              </div>
            </a>
          </div>

          {/* Nav Sections */}
          {navSections.map((section) => (
            <section className="sidebar-section" key={section.title}>
              <div className="sidebar-section-heading">
                <p>{section.title}</p>
              </div>
              <div className="sidebar-nav-grid">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== '/' && pathname.startsWith(item.href));
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <div className="sidebar-nav-icon">{item.icon}</div>
                      <div className="sidebar-nav-copy">
                        <div className="sidebar-nav-title">
                          <span>{item.label}</span>
                          {item.badge && <span className="sidebar-nav-badge">{item.badge}</span>}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Footer Credits */}
        <div className="sidebar-footer-card">
          <div className="sidebar-credits-header">
            <div className="sidebar-credits-title">Credits</div>
            <span className="sidebar-chip">Active</span>
          </div>
          <CreditCounter />
        </div>
      </div>
    </aside>
  );
}
