'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient as supabase } from '../lib/supabaseClient';
import { prefetchUserData } from '../lib/dataCache';
import {
  Activity,
  Zap,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Mic,
  Video,
  Image,
  Scissors,
  Search,
  Download,
  Database,
  Users,
  BarChart3,
  Calendar,
  FileText,
  Sparkles,
  Settings,
  ChevronRight,
  Eye,
  Heart,
  Cpu,
  Layers,
  Palette,
  Music,
  Monitor,
  Lightbulb,
  LogIn,
  LogOut,
  Copy,
  MessageSquare,
} from 'lucide-react';

export type Task = {
  id: string;
  status: string;
  created_at: string;
  backend: string | null;
  model_id?: string | null;
  provider?: string | null;
  video_url: string | null;
  audio_url: string | null;
  output_url: string | null;
  output_text?: string | null;
  text_input?: string | null;
  type?: string | null;
  user_id?: string | null;
};

type FeatureCardProps = {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  gradient: string;
  category: string;
  isPopular?: boolean;
  badge?: string;
};

const FeatureCard = ({ title, description, href, icon, gradient, category, isPopular, badge }: FeatureCardProps) => (
  <a 
    href={href} 
    className="feature-card group"
    style={{ background: gradient }}
  >
    <div className="feature-card-content">
      <div className="feature-card-header">
        <div className="feature-card-icon">
          {icon}
        </div>
        <div className="feature-card-badges">
          {isPopular && <span className="badge-popular">🔥 Popular</span>}
          {badge && <span className="badge-new">{badge}</span>}
        </div>
      </div>
      <div className="feature-card-info">
        <h3 className="feature-card-title">{title}</h3>
        <p className="feature-card-description">{description}</p>
        <div className="feature-card-category">{category}</div>
      </div>
      <div className="feature-card-arrow">
        <ChevronRight size={20} />
      </div>
    </div>
  </a>
);

type MetricCardProps = {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'stable';
};

const MetricCard = ({ title, value, change, icon, color, trend }: MetricCardProps) => (
  <div className="metric-card" style={{ '--accent-color': color } as React.CSSProperties}>
    <div className="metric-card-header">
      <div className="metric-card-icon" style={{ background: `${color}20`, color }}>
        {icon}
      </div>
      {change !== undefined && (
        <div className={`metric-change ${trend}`}>
          {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
          {Math.abs(change)}%
        </div>
      )}
    </div>
    <div className="metric-card-content">
      <div className="metric-value">{value}</div>
      <div className="metric-title">{title}</div>
    </div>
  </div>
);

type QuickActionProps = {
  title: string;
  subtitle: string;
  href: string;
  icon: React.ReactNode;
  gradient: string;
  shortcut?: string;
};

const MINIMAL_GRADIENT = 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0.85))';
const ACCENT_GRADIENT = 'linear-gradient(135deg, rgba(204, 255, 0, 0.18), rgba(10, 10, 10, 0.96))';

const QuickAction = ({ title, subtitle, href, icon, gradient, shortcut }: QuickActionProps) => (
  <a 
    href={href} 
    className="quick-action group"
    style={{ background: gradient }}
  >
    <div className="quick-action-icon">
      {icon}
    </div>
    <div className="quick-action-content">
      <div className="quick-action-title">{title}</div>
      <div className="quick-action-subtitle">{subtitle}</div>
    </div>
    {shortcut && (
      <div className="quick-action-shortcut">
        {shortcut}
      </div>
    )}
    <ChevronRight className="quick-action-arrow" size={16} />
  </a>
);

export default function DashboardClient({ initialTasks, initialUserEmail }: { initialTasks: Task[]; initialUserEmail: string; }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks || []);
  const [userEmail, setUserEmail] = useState<string>(initialUserEmail || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [dataReady, setDataReady] = useState<boolean>(false);
  const loadStarted = useRef(false);
  
  const [recentActivity] = useState<any[]>([
    { id: 1, type: 'lipsync', title: 'Video synced successfully', time: '2 minutes ago', status: 'success' },
    { id: 2, type: 'tts', title: 'Voice generated', time: '5 minutes ago', status: 'success' },
    { id: 3, type: 'enhance', title: 'Video enhanced', time: '10 minutes ago', status: 'success' },
    { id: 4, type: 'transcription', title: 'Transcription completed', time: '15 minutes ago', status: 'success' },
  ]);

  const isAuthenticated = Boolean(userEmail);

  const copyTextOutput = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus({ preventScroll: true });
      textArea.select();
      try {
        document.execCommand('copy');
      } catch {
        // ignore
      }
      document.body.removeChild(textArea);
    }
  }, []);

  // Fast data loading with caching
  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;

    const loadData = async () => {
      // If we have initial data from SSR, we're ready
      if (initialUserEmail && initialTasks.length > 0) {
        setDataReady(true);
        return;
      }

      setLoading(true);
      
      try {
        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Use the new fast prefetch endpoint with caching
        const cachedData = await prefetchUserData(user.id);
        
        if (cachedData) {
          setUserEmail(cachedData.user?.email || user.email || '');
          setTasks(cachedData.tasks || []);
          setDataReady(true);
        } else {
          // Fallback to basic data
          setUserEmail(user.email || '');
          setDataReady(true);
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
        setDataReady(true); // Show dashboard anyway
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [initialUserEmail, initialTasks]);

  const goToAuth = () => {
    router.push('/auth');
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUserEmail('');
      router.replace('/auth');
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  };

  const metrics = useMemo(() => {
    const total = tasks.length;
    const finished = tasks.filter(t =>
      (t.status || '').toLowerCase().includes('finished') ||
      (t.status || '').toLowerCase().includes('completed') ||
      (t.status || '').toLowerCase().includes('succeeded')
    ).length;
    const running = tasks.filter(t =>
      (t.status || '').toLowerCase().includes('running') ||
      (t.status || '').toLowerCase().includes('processing') ||
      (t.status || '').toLowerCase().includes('queued')
    ).length;
    const failed = tasks.filter(t =>
      (t.status || '').toLowerCase().includes('error') ||
      (t.status || '').toLowerCase().includes('failed') ||
      (t.status || '').toLowerCase().includes('cancel')
    ).length;

    const successRate = total > 0 ? Math.round((finished / total) * 100) : 0;
    const todaysTasks = tasks.filter(t => {
      const taskDate = new Date(t.created_at);
      const today = new Date();
      return taskDate.toDateString() === today.toDateString();
    }).length;

    return { total, finished, running, failed, successRate, todaysTasks };
  }, [tasks]);

  const heroSummary = useMemo(() => ([
    { label: 'Tasks Today', value: metrics.todaysTasks, helper: 'Launched in last 24h' },
    { label: 'In Progress', value: metrics.running, helper: 'Currently processing' },
    { label: 'Completed', value: metrics.finished, helper: 'Delivered successfully' },
    { label: 'Success Rate', value: `${metrics.successRate}%`, helper: 'This month' },
  ]), [metrics]);

  const insightCards = useMemo(() => ([
    {
      title: 'Pipeline Health',
      detail: metrics.running > metrics.failed ? 'Stable' : 'Investigate failures',
      tone: metrics.running > metrics.failed ? 'good' : 'warn',
      helper: `${metrics.running} running, ${metrics.failed} blocked`
    },
    {
      title: 'Focus Recommendation',
      detail: metrics.running > 0 ? 'Review active jobs' : 'Start a new campaign',
      tone: metrics.running > 0 ? 'info' : 'accent',
      helper: metrics.running > 0 ? 'Ensure your assets are ready' : 'No jobs in queue'
    },
    {
      title: 'Next Best Action',
      detail: metrics.todaysTasks > 2 ? 'Share outputs with team' : 'Launch a new experiment',
      tone: metrics.todaysTasks > 2 ? 'good' : 'accent',
      helper: metrics.todaysTasks > 2 ? 'Momentum is high' : 'Keep pipeline full'
    },
  ]), [metrics]);

  const features = [
    {
      title: "AI Lipsync",
      description: "Perfect lipsync for spokesperson ads and product videos",
      href: "/lipsync-new",
      icon: <Mic size={24} />,
      gradient: ACCENT_GRADIENT,
      category: "Core Feature",
      isPopular: true
    },
    {
      title: "Video Generation",
      description: "Create advertising videos from text prompts with AI",
      href: "/veo",
      icon: <Video size={24} />,
      gradient: MINIMAL_GRADIENT,
      category: "AI Generation"
    },
    {
      title: "Image Creation",
      description: "Generate stunning images with AI",
      href: "/image",
      icon: <Image size={24} />,
      gradient: MINIMAL_GRADIENT,
      category: "AI Generation"
    },
    {
      title: "Text to Speech",
      description: "Convert scripts to natural voiceovers for ads",
      href: "/tts",
      icon: <Music size={24} />,
      gradient: MINIMAL_GRADIENT,
      category: "Audio",
      badge: "Enhanced"
    },
    {
      title: "Video Enhancement",
      description: "Improve video quality with AI upscaling",
      href: "/enhance",
      icon: <Sparkles size={24} />,
      gradient: MINIMAL_GRADIENT,
      category: "Enhancement"
    },
    {
      title: "Background Removal",
      description: "Remove backgrounds from videos and images",
      href: "/background-remove",
      icon: <Scissors size={24} />,
      gradient: MINIMAL_GRADIENT,
      category: "Enhancement"
    },
    {
      title: "Bulk Transcription",
      description: "Transcribe multiple videos automatically",
      href: "/transcription/bulk",
      icon: <FileText size={24} />,
      gradient: MINIMAL_GRADIENT,
      category: "Productivity"
    },
    {
      title: "TikTok Downloader",
      description: "Download TikTok videos for processing",
      href: "/download",
      icon: <Download size={24} />,
      gradient: MINIMAL_GRADIENT,
      category: "Utility"
    },
    {
      title: "Spy Tool",
      description: "Research competitor content and trends",
      href: "/spy",
      icon: <Search size={24} />,
      gradient: MINIMAL_GRADIENT,
      category: "Research",
      badge: "Pro"
    },
    {
      title: "Video Editor",
      description: "Professional video editing suite",
      href: "/editor",
      icon: <Monitor size={24} />,
      gradient: MINIMAL_GRADIENT,
      category: "Editing"
    },
    {
      title: "Auto Edit Beta",
      description: "Automatic video editing with AI",
      href: "/auto-edit-beta",
      icon: <Cpu size={24} />,
      gradient: MINIMAL_GRADIENT,
      category: "AI Editing",
      badge: "Beta"
    },
    {
      title: "Asset Library",
      description: "Manage and organize your content",
      href: "/library",
      icon: <Database size={24} />,
      gradient: MINIMAL_GRADIENT,
      category: "Organization"
    }
  ];

  const quickActions = [
    {
      title: "AI Assistant",
      subtitle: "Creative partner",
      href: "/assistant",
      icon: <MessageSquare size={20} />,
      gradient: ACCENT_GRADIENT,
      shortcut: "⌘A"
    },
    {
      title: "New Lipsync",
      subtitle: "Sync audio to video",
      href: "/lipsync-new",
      icon: <Zap size={20} />,
      gradient: MINIMAL_GRADIENT,
      shortcut: "⌘L"
    },
    {
      title: "Generate Video",
      subtitle: "Create from text",
      href: "/veo",
      icon: <Video size={20} />,
      gradient: MINIMAL_GRADIENT,
      shortcut: "⌘V"
    },
    {
      title: "View Tasks",
      subtitle: "Monitor progress",
      href: "/tasks",
      icon: <Activity size={20} />,
      gradient: MINIMAL_GRADIENT,
      shortcut: "⌘T"
    }
  ];

  // Show loading only on initial load
  if (loading && !dataReady) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your creative workspace...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="dashboard dashboard-minimal fade-in">
        <div className="dashboard-auth-gate">
          <div className="dashboard-auth-card">
            <div className="dashboard-auth-icon">
              <Activity size={32} />
            </div>
            <p className="dashboard-auth-eyebrow">Workspace Access</p>
            <h1>Sign in to start creating</h1>
            <p className="dashboard-auth-subtitle">
              Access lipsync, video generation, auto-editing, and every tool in your studio from one place.
            </p>
            <div className="dashboard-auth-actions">
              <a className="btn inline" href="/auth">
                Sign in
              </a>
              <a className="btn secondary inline" href="/auth#signup">
                Create account
              </a>
            </div>
            <p className="dashboard-auth-footnote">
              Need a walking tour? <a href="/support">Contact support</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard dashboard-minimal fade-in">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="dashboard-header-main">
            <div className="dashboard-branding">
              <div className="dashboard-logo-mark">AC</div>
              <span className="dashboard-brand-label">AdzCreator Studio</span>
            </div>
            <h1 className="dashboard-title">
              <span className="desktop-only">Welcome back{userEmail ? `, ${userEmail.split('@')[0]}` : ''}</span>
              <span className="mobile-only">Welcome{userEmail ? `, ${userEmail.split('@')[0]}` : ''}</span>
              <span className="dashboard-subtitle">Ready to create something amazing?</span>
            </h1>
          </div>
          <div className="dashboard-header-actions">
            <button className="header-action-btn">
              <Settings size={18} />
              <span className="desktop-only">Settings</span>
            </button>
            <div className="user-avatar">
              {userEmail ? userEmail.charAt(0).toUpperCase() : 'G'}
            </div>
            <button
              type="button"
              className="header-action-btn"
              aria-label={isAuthenticated ? 'Sign out' : 'Sign in or Sign up'}
              onClick={isAuthenticated ? handleSignOut : goToAuth}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (isAuthenticated) {
                    void handleSignOut();
                  } else {
                    goToAuth();
                  }
                }
              }}
            >
              {isAuthenticated ? (
                <>
                  <LogOut size={18} />
                  <span className="desktop-only">Sign out</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span className="desktop-only">Sign in / Up</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <section className="dashboard-section dashboard-spotlight">
          <div className="dashboard-welcome-card">
            <div className="dashboard-welcome-text">
              <p className="dashboard-hero-eyebrow">Workflow Status</p>
              <h2>Run the next viral experiment{userEmail ? `, ${userEmail.split('@')[0]}` : ''}</h2>
              <p>Spin up new productions, monitor pipelines, and keep credits in view without leaving this screen.</p>
              <div className="dashboard-hero-actions">
                <a href="/lipsync-new" className="btn inline" title="Start a new lipsync project">
                  Launch Lipsync
                </a>
                <a href="/veo" className="btn inline" title="Create an AI video">
                  Generate Video
                </a>
              </div>
            </div>
          </div>
          <div className="dashboard-highlight-grid">
            {heroSummary.map((summary) => (
              <div key={summary.label} className="dashboard-highlight">
                <div className="dashboard-highlight-label">{summary.label}</div>
                <div className="dashboard-highlight-value">{summary.value}</div>
                <div className="dashboard-highlight-helper">{summary.helper}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Metrics Grid */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">
              <BarChart3 size={24} />
              Analytics Overview
            </h2>
          </div>
          <div className="metrics-grid">
            <MetricCard
              title="Total Tasks"
              value={metrics.total}
              change={12}
              trend="up"
              icon={<Activity size={20} />}
              color="#667eea"
            />
            <MetricCard
              title="Success Rate"
              value={`${metrics.successRate}%`}
              change={5}
              trend="up"
              icon={<CheckCircle size={20} />}
              color="#10b981"
            />
            <MetricCard
              title="In Progress"
              value={metrics.running}
              icon={<Clock size={20} />}
              color="#f59e0b"
            />
            <MetricCard
              title="Today's Tasks"
              value={metrics.todaysTasks}
              change={3}
              trend="up"
              icon={<Calendar size={20} />}
              color="#8b5cf6"
            />
          </div>
        </section>

        <section className="dashboard-section dashboard-workflow-grid">
          <div className="workflow-column">
            <div className="section-header">
              <h2 className="section-title">
                <Zap size={24} />
                Start Creating
              </h2>
              <p className="section-description">Spin up new jobs in a single click.</p>
            </div>
            <div className="quick-actions-grid">
              {quickActions.map((action, index) => (
                <QuickAction key={action.href + index} {...action} />
              ))}
            </div>
          </div>
          <div className="workflow-column">
            <div className="section-header">
              <h2 className="section-title">
                <Activity size={24} />
                Activity Timeline
              </h2>
              <p className="section-description">Live view of your recent automations.</p>
            </div>
            <div className="activity-timeline">
              {recentActivity.map((activity) => (
                <div key={activity.id} className={`timeline-item ${activity.status}`}>
                  <div className="timeline-marker" />
                  <div className="timeline-content">
                    <div className="timeline-title">{activity.title}</div>
                    <div className="timeline-meta">{activity.time}</div>
                  </div>
                </div>
              ))}
              <a href="/tasks" className="activity-view-all">
                View all activity
                <ChevronRight size={16} />
              </a>
            </div>
          </div>
          <aside className="dashboard-insights">
            {insightCards.map((insight) => (
              <div key={insight.title} className={`insight-card ${insight.tone}`}>
                <div className="insight-header">
                  <h3>{insight.title}</h3>
                </div>
                <div className="insight-content">
                  <div className="insight-value">{insight.detail}</div>
                  <div className="insight-description">{insight.helper}</div>
                </div>
              </div>
            ))}
          </aside>
        </section>

        {/* Features Grid */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">
              <Layers size={24} />
              AI-Powered Features
            </h2>
            <p className="section-description">
              Explore our comprehensive suite of content creation tools
            </p>
          </div>
          <div className="features-grid">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">
              <FileText size={24} />
              Active Tasks
            </h2>
            <p className="section-description">Monitor the most recent jobs across all tools.</p>
          </div>
          <div className="tasks-list">
            {tasks.length === 0 ? (
              <div className="empty-state">
                <Lightbulb size={48} />
                <h3>No tasks yet</h3>
                <p>Start creating your first project above</p>
              </div>
            ) : (
              <>
                {tasks.slice(0, 6).map((task) => (
                  <div key={task.id} className="task-item">
                    <div className={`task-status ${task.status?.toLowerCase()}`}>
                      {task.status?.toLowerCase().includes('finished') ||
                       task.status?.toLowerCase().includes('completed') ||
                       task.status?.toLowerCase().includes('succeeded') ? (
                        <CheckCircle size={16} />
                      ) : task.status?.toLowerCase().includes('running') ||
                           task.status?.toLowerCase().includes('processing') ? (
                        <Clock size={16} />
                      ) : task.status?.toLowerCase().includes('error') ||
                           task.status?.toLowerCase().includes('failed') ? (
                        <XCircle size={16} />
                      ) : (
                        <Activity size={16} />
                      )}
                    </div>
                    <div className="task-content">
                      <div className="task-title">Task {task.id.slice(0, 8)}...</div>
                      <div className="task-meta">
                        <span className="task-backend">{task.backend || 'Unknown'}</span>
                        <span className="task-time">
                          {new Date(task.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="task-actions">
                      {task.output_url ? (
                        <a href={task.output_url} target="_blank" rel="noreferrer" className="task-action">
                          <Eye size={14} />
                        </a>
                      ) : task.output_text ? (
                        <button
                          type="button"
                          className="task-action"
                          onClick={() => copyTextOutput(task.output_text ?? '')}
                          title="Copy text output"
                        >
                          <Copy size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                <a href="/tasks" className="tasks-view-all">
                  View all tasks
                  <ChevronRight size={16} />
                </a>
              </>
            )}
          </div>
        </section>

        {/* Performance Insights */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">
              <TrendingUp size={24} />
              Performance Insights
            </h2>
          </div>
          <div className="insights-grid">
            <div className="insight-card">
              <div className="insight-header">
                <h3>Processing Speed</h3>
                <TrendingUp className="insight-icon" />
              </div>
              <div className="insight-content">
                <div className="insight-value">2.3x</div>
                <div className="insight-description">Faster than last month</div>
              </div>
            </div>
            <div className="insight-card">
              <div className="insight-header">
                <h3>Success Rate</h3>
                <CheckCircle className="insight-icon" />
              </div>
              <div className="insight-content">
                <div className="insight-value">{metrics.successRate}%</div>
                <div className="insight-description">Task completion rate</div>
              </div>
            </div>
            <div className="insight-card">
              <div className="insight-header">
                <h3>User Satisfaction</h3>
                <Heart className="insight-icon" />
              </div>
              <div className="insight-content">
                <div className="insight-value">4.9/5</div>
                <div className="insight-description">Average rating</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
