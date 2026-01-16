'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Home,
  Wand2,
  Image as ImageIcon,
  Video,
  Mic,
  Captions,
  Scissors,
  Download,
  Shield,
  Search,
  LogIn,
  Settings,
  Zap,
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
  description?: string;
  items: NavLink[];
};

const navSections: NavSection[] = [
  {
    title: 'Create',
    description: 'All tools',
    items: [
      { href: '/', label: 'Home', icon: <Home size={18} />, description: 'Dashboard' },
      { href: '/image', label: 'Image', icon: <ImageIcon size={18} />, description: 'Generate images' },
      { href: '/veo', label: 'Video', icon: <Video size={18} />, description: 'Generate videos' },
      { href: '/tts', label: 'TTS', icon: <Mic size={18} />, description: 'Text to speech' },
      { href: '/transcription', label: 'Transcription', icon: <Captions size={18} />, description: 'Audio → text' },
      { href: '/lipsync', label: 'Lipsync', icon: <Wand2 size={18} />, description: 'Sync lips to audio' },
      { href: '/enhance', label: 'Enhance', icon: <Scissors size={18} />, description: 'Upscale / enhance' },
      { href: '/background-remove', label: 'BG Remove', icon: <Shield size={18} />, description: 'Remove background' },
      { href: '/download', label: 'Download', icon: <Download size={18} />, description: 'Grab videos/assets' },
      { href: '/spy', label: 'Spy', icon: <Search size={18} />, description: 'Ad research' },
      { href: '/tasks', label: 'Tasks', icon: <Activity size={18} />, description: 'Track progress' },
      { href: '/adscript', label: 'Ad Script', icon: <Wand2 size={18} />, description: 'Generate scripts' },
      { href: '/editor', label: 'Editor', icon: <Wand2 size={18} />, description: 'Edit assets' },
    ],
  },
  {
    title: 'Account',
    description: 'Credits and billing',
    items: [
      { href: '/credits', label: 'Credits', icon: <Zap size={18} />, description: 'Usage + limits' },
      { href: '/billing', label: 'Billing', icon: <Settings size={18} />, description: 'Plans & invoices' },
      { href: '/auth', label: 'Sign in / Up', icon: <LogIn size={18} />, description: 'Account access' },
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
          <a className="sidebar-logo" title="AdsCreator" href="/">
            <div className="brand-chip">
              <Wand2 size={20} style={{ color: '#a78bfa' }} />
            </div>
            <div className="sidebar-logo-text">
              <span>AdsCreator</span>
            </div>
          </a>
        </div>

        <div className="sidebar-scroll">
          {/* Main CTA */}
          <div className="sidebar-quick-actions">
            <a href="/image" className="sidebar-quick-card sidebar-quick-main">
              <div className="sidebar-quick-icon">
                <ImageIcon size={22} />
              </div>
              <div className="sidebar-quick-copy">
                <span>Generate Image</span>
                <p>Start with an image</p>
              </div>
            </a>
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
                      className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
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
              <div className="sidebar-credits-subtitle">Track usage</div>
            </div>
            <span className="sidebar-chip">Live</span>
          </div>
          <CreditCounter />
        </div>

        <div className="sidebar-footer-meta">
          <span>© {year} AdsCreator</span>
          <span>All-in-one creative tools</span>
        </div>
      </div>
    </aside>
  );
}
