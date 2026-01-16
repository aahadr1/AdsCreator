'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Home,
  Sparkles,
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
    description: 'AI-powered UGC video creation',
    items: [
      { href: '/assistant', label: 'UGC Creator', icon: <Sparkles size={18} />, description: 'Create viral UGC ads', badge: 'New' },
      { href: '/tasks', label: 'Tasks', icon: <Activity size={18} />, description: 'Track progress' },
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
          <a className="sidebar-logo" title="UGC Creator" href="/">
            <div className="brand-chip">
              <Sparkles size={20} style={{ color: '#a78bfa' }} />
            </div>
            <div className="sidebar-logo-text">
              <span>UGC Creator</span>
            </div>
          </a>
        </div>

        <div className="sidebar-scroll">
          {/* Main CTA */}
          <div className="sidebar-quick-actions">
            <a href="/assistant" className="sidebar-quick-card sidebar-quick-main">
              <div className="sidebar-quick-icon">
                <Sparkles size={22} />
              </div>
              <div className="sidebar-quick-copy">
                <span>Create UGC Ad</span>
                <p>AI-powered video creation</p>
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
          <span>© {year} UGC Creator</span>
          <span>Create viral ads in minutes</span>
        </div>
      </div>
    </aside>
  );
}
