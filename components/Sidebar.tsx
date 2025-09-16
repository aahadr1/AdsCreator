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
  Zap,
  MessageCircle
} from 'lucide-react';
import { CreditCounter } from './CreditCounter';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  gradient?: string;
  disabled?: boolean;
};

const navigationItems: NavItem[] = [
  { href: '/', label: 'Home', icon: <Home size={18} /> },
  { 
    href: '/lipsync-new', 
    label: '+ New Lipsync', 
    icon: <Mic size={18} />,
    gradient: 'linear-gradient(90deg, #6aa4ff, #ff9f43)'
  },
  { 
    href: '/infinite-talk', 
    label: '+ New Infinite Talk', 
    icon: <MessageCircle size={18} />,
    gradient: 'linear-gradient(90deg, #ff6b6b, #4ecdc4)'
  },
  { 
    href: '/transcription/bulk', 
    label: '+ Bulk Transcription', 
    icon: <FileText size={18} />,
    gradient: 'linear-gradient(90deg, #ff9f43, #6aa4ff)'
  },
  { 
    href: '/veo', 
    label: '+ New Video', 
    icon: <Video size={18} />,
    gradient: 'linear-gradient(90deg, #a36bff, #6aa4ff)'
  },
  { 
    href: '/image', 
    label: '+ New Image', 
    icon: <Image size={18} />,
    gradient: 'linear-gradient(90deg, #42d392, #a36bff)'
  },
  { 
    href: '/enhance', 
    label: '+ New Enhance', 
    icon: <Sparkles size={18} />,
    gradient: 'linear-gradient(90deg, #ffbd2e, #42d392)'
  },
  { 
    href: '/tts', 
    label: '+ New Text to Speech', 
    icon: <Music size={18} />,
    gradient: 'linear-gradient(90deg, #ffbd2e, #ff6b6b)'
  },
  { 
    href: '/adscript', 
    label: '+ New Ad Script', 
    icon: <PenTool size={18} />,
    gradient: 'linear-gradient(90deg, #6aa4ff, #ff9f43)'
  },
  { 
    href: '/background-remove', 
    label: '+ Remove Background', 
    icon: <Scissors size={18} />,
    gradient: 'linear-gradient(90deg, #42d392, #ff6b6b)'
  },
  { 
    href: '/download', 
    label: '+ TikTok Downloader', 
    icon: <Download size={18} />,
    gradient: 'linear-gradient(90deg, #1db954, #2b8a3e)'
  },
  { 
    href: '/spy', 
    label: 'Spy Tool', 
    icon: <Search size={18} />,
    gradient: 'linear-gradient(90deg, #6aa4ff, #42d392)'
  },
  { 
    href: '/editor', 
    label: 'Editor', 
    icon: <Monitor size={18} />,
    gradient: 'linear-gradient(90deg, #42d392, #a36bff)'
  },
  { 
    href: '/auto-edit', 
    label: '+ Auto Edit (New)', 
    icon: <Cpu size={18} />,
    gradient: 'linear-gradient(90deg, #1db954, #a36bff)'
  },
  { 
    href: '/auto-edit-beta', 
    label: '+ Auto Edit Beta', 
    icon: <Cpu size={18} />,
    gradient: 'linear-gradient(90deg, #6aa4ff, #a36bff)'
  },
  { 
    href: '/library', 
    label: 'Database', 
    icon: <Database size={18} />,
    gradient: 'linear-gradient(90deg, #1db954, #6aa4ff)'
  },
  { href: '/tasks', label: 'Tasks', icon: <Activity size={18} /> },
  { href: '/credits', label: 'Credits', icon: <Zap size={18} /> },
  { href: '/billing', label: 'Plan & Billing', icon: <Settings size={18} /> },
  { href: '/auth', label: 'Sign in / Up', icon: <LogIn size={18} /> },
  { href: '#', label: 'Settings (soon)', icon: <Settings size={18} />, disabled: true }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">AdzCreator</h1>
      </div>
      
      <nav className="sidebar-nav">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href;
          const isGradientButton = !!item.gradient;
          
          return (
            <a
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'nav-item-active' : ''} ${
                isGradientButton ? 'nav-item-gradient' : ''
              } ${item.disabled ? 'nav-item-disabled' : ''}`}
              style={isGradientButton ? { background: item.gradient } : undefined}
              onClick={item.disabled ? (e) => e.preventDefault() : undefined}
              title={item.label}
            >
              <span className="nav-item-icon">{item.icon}</span>
              <span className="nav-item-label">{item.label}</span>
            </a>
          );
        })}
      </nav>
      
      <div className="sidebar-credits">
        <CreditCounter />
      </div>
      
      <div className="sidebar-footer">
        <div className="sidebar-copyright">
          © {new Date().getFullYear()} AdzCreator
        </div>
      </div>
    </aside>
  );
}
