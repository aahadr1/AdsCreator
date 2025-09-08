'use client';

export const dynamic = 'force-dynamic';

import './globals.css';
import { useEffect, useMemo, useState } from 'react';
import { supabaseClient as supabase } from '../lib/supabaseClient';
import { 
  Activity, 
  Zap, 
  TrendingUp, 
  AlertTriangle, 
  Play, 
  Clock, 
  CheckCircle, 
  XCircle,
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
  Globe,
  Settings,
  ChevronRight,
  Eye,
  Heart,
  Share,
  Star,
  Cpu,
  Layers,
  Palette,
  Music,
  Monitor,
  Lightbulb
} from 'lucide-react';

type Task = {
  id: string;
  status: string;
  created_at: string;
  backend: string | null;
  video_url: string | null;
  audio_url: string | null;
  output_url: string | null;
  user_id?: string;
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

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserEmail(user?.email || '');
        
        if (!user) { 
          setLoading(false); 
          return; 
        }

        // Load tasks
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        setTasks((tasksData as Task[]) || []);
        
        // Simulate loading recent activity
        setRecentActivity([
          { id: 1, type: 'lipsync', title: 'Video synced successfully', time: '2 minutes ago', status: 'success' },
          { id: 2, type: 'tts', title: 'Voice generated', time: '5 minutes ago', status: 'success' },
          { id: 3, type: 'enhance', title: 'Video enhanced', time: '10 minutes ago', status: 'success' },
          { id: 4, type: 'transcription', title: 'Transcription completed', time: '15 minutes ago', status: 'success' },
        ]);
        
        setLoading(false);
      } catch (error) {
        console.error('Dashboard loading error:', error);
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

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

  const features = [
    {
      title: "AI Lipsync",
      description: "Sync any audio to video with multiple AI models",
      href: "/lipsync-new",
      icon: <Mic size={24} />,
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      category: "Core Feature",
      isPopular: true
    },
    {
      title: "Video Generation",
      description: "Create videos from text prompts using Veo",
      href: "/veo",
      icon: <Video size={24} />,
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      category: "AI Generation"
    },
    {
      title: "Image Creation",
      description: "Generate stunning images with AI",
      href: "/image",
      icon: <Image size={24} />,
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      category: "AI Generation"
    },
    {
      title: "Text to Speech",
      description: "Convert text to natural speech with ElevenLabs",
      href: "/tts",
      icon: <Music size={24} />,
      gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
      category: "Audio",
      badge: "Enhanced"
    },
    {
      title: "Video Enhancement",
      description: "Improve video quality with AI upscaling",
      href: "/enhance",
      icon: <Sparkles size={24} />,
      gradient: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
      category: "Enhancement"
    },
    {
      title: "Background Removal",
      description: "Remove backgrounds from videos and images",
      href: "/background-remove",
      icon: <Scissors size={24} />,
      gradient: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
      category: "Enhancement"
    },
    {
      title: "Bulk Transcription",
      description: "Transcribe multiple videos automatically",
      href: "/transcription/bulk",
      icon: <FileText size={24} />,
      gradient: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
      category: "Productivity"
    },
    {
      title: "TikTok Downloader",
      description: "Download TikTok videos for processing",
      href: "/download",
      icon: <Download size={24} />,
      gradient: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
      category: "Utility"
    },
    {
      title: "Spy Tool",
      description: "Research competitor content and trends",
      href: "/spy",
      icon: <Search size={24} />,
      gradient: "linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)",
      category: "Research",
      badge: "Pro"
    },
    {
      title: "Video Editor",
      description: "Professional video editing suite",
      href: "/editor",
      icon: <Monitor size={24} />,
      gradient: "linear-gradient(135deg, #fdbb2d 0%, #22c1c3 100%)",
      category: "Editing"
    },
    {
      title: "Auto Edit Beta",
      description: "Automatic video editing with AI",
      href: "/auto-edit-beta",
      icon: <Cpu size={24} />,
      gradient: "linear-gradient(135deg, #e0c3fc 0%, #9bb5ff 100%)",
      category: "AI Editing",
      badge: "Beta"
    },
    {
      title: "Asset Library",
      description: "Manage and organize your content",
      href: "/library",
      icon: <Database size={24} />,
      gradient: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
      category: "Organization"
    }
  ];

  const quickActions = [
    {
      title: "New Lipsync",
      subtitle: "Sync audio to video",
      href: "/lipsync-new",
      icon: <Zap size={20} />,
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      shortcut: "⌘L"
    },
    {
      title: "Generate Video",
      subtitle: "Create from text",
      href: "/veo",
      icon: <Video size={20} />,
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      shortcut: "⌘V"
    },
    {
      title: "View Tasks",
      subtitle: "Monitor progress",
      href: "/tasks",
      icon: <Activity size={20} />,
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      shortcut: "⌘T"
    },
    {
      title: "Open Library",
      subtitle: "Browse assets",
      href: "/library",
      icon: <Database size={20} />,
      gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
      shortcut: "⌘B"
    }
  ];

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your creative workspace...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="dashboard-header-main">
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
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

        {/* Quick Actions */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">
              <Zap size={24} />
              Quick Actions
            </h2>
          </div>
          <div className="quick-actions-grid">
            {quickActions.map((action, index) => (
              <QuickAction key={index} {...action} />
            ))}
          </div>
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

        {/* Recent Activity & Tasks */}
        <div className="dashboard-row">
          {/* Recent Activity */}
          <section className="dashboard-section dashboard-section-half">
            <div className="section-header">
              <h2 className="section-title">
                <Activity size={24} />
                Recent Activity
              </h2>
            </div>
            <div className="activity-list">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-icon success">
                    <CheckCircle size={16} />
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">{activity.title}</div>
                    <div className="activity-time">{activity.time}</div>
                  </div>
                </div>
              ))}
              <a href="/tasks" className="activity-view-all">
                View all activity
                <ChevronRight size={16} />
              </a>
            </div>
          </section>

          {/* Recent Tasks */}
          <section className="dashboard-section dashboard-section-half">
            <div className="section-header">
              <h2 className="section-title">
                <FileText size={24} />
                Recent Tasks
              </h2>
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
                  {tasks.slice(0, 5).map((task) => (
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
                        {task.output_url && (
                          <a href={task.output_url} target="_blank" rel="noreferrer" className="task-action">
                            <Eye size={14} />
                          </a>
                        )}
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
        </div>

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