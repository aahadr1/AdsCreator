'use client';

import './globals.css';
import './landing.css';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Lightbulb,
  Crown,
  Shield,
  ArrowRight
} from 'lucide-react';
import { LogIn, LogOut } from 'lucide-react';

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
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const isAuthenticated = Boolean(userEmail);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserEmail(user?.email || '');
        
        if (!user) { 
          setLoading(false); 
          return; 
        }

        // Load user tasks
        const res = await fetch(`/api/tasks/list?user_id=${encodeURIComponent(user.id)}`);
        if (res.ok) {
          const json = (await res.json()) as { tasks?: Task[] };
          setTasks(Array.isArray(json.tasks) ? json.tasks : []);
        } else {
          setTasks([]);
        }
        
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

  const features = [
    {
      title: "Ad Creative Studio",
      description: "Complete ad creation workflow from concept to final video",
      href: "/ad-creative",
      icon: <Sparkles size={24} />,
      gradient: "linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%)",
      category: "Creative Suite",
      isPopular: true,
      badge: "New"
    },
    {
      title: "AI Lipsync",
      description: "Perfect lipsync for spokesperson ads and product videos",
      href: "/lipsync-new",
      icon: <Mic size={24} />,
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      category: "Core Feature",
      isPopular: true
    },
    {
      title: "Video Generation",
      description: "Create advertising videos from text prompts with AI",
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
      description: "Convert scripts to natural voiceovers for ads",
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
      title: "New Ad Creative",
      subtitle: "Complete campaign flow",
      href: "/ad-creative",
      icon: <Sparkles size={20} />,
      gradient: "linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%)",
      shortcut: "⌘A"
    },
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

  if (!isAuthenticated) {
    return (
      <div className="landing">
        {/* Navigation */}
        <nav className="landing-nav" role="navigation">
          <div className="nav-container">
            <div className="nav-brand">
              <Activity size={28} />
              <span>AdzCreator</span>
            </div>
            <div className="nav-actions">
              <a href="/auth" className="nav-link">Sign In</a>
              <a href="/auth" className="btn btn-primary">Get Started</a>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <header className="landing-hero" role="banner">
          <div className="hero-container">
            <div className="hero-content">
              <div className="hero-badge">
                <Zap size={16} />
                <span>AI-Powered Content Creation</span>
              </div>
              <h1 className="hero-title">
                Create <span className="gradient-text">viral ads</span> that convert
              </h1>
              <p className="hero-subtitle">
                Transform your marketing with AI-powered ad creation. Generate professional videos, 
                perfect lipsync, auto-editing, and 15+ tools designed for advertisers and agencies.
              </p>
              <div className="hero-cta">
                <a className="btn btn-primary btn-large" href="/auth">
                  <span>Start Creating Free</span>
                  <ArrowRight size={20} />
                </a>
                <a className="btn btn-secondary btn-large" href="#demo">
                  <Play size={20} />
                  <span>Watch Demo</span>
                </a>
              </div>
              <div className="hero-social-proof">
                <div className="social-proof-item">
                  <Star className="star-icon" size={16} />
                  <span>4.9/5 from 5,000+ marketers</span>
                </div>
                <div className="social-proof-item">
                  <Users size={16} />
                  <span>50,000+ ads created</span>
                </div>
              </div>
            </div>
            <div className="hero-visual">
              <div className="hero-video-placeholder">
                <Play size={64} />
                <span>Demo Video</span>
              </div>
            </div>
          </div>
        </header>

        <main>
          {/* Features Section */}
          <section className="landing-features" aria-labelledby="features-heading">
            <div className="container">
              <div className="section-header">
                <h2 id="features-heading">Everything you need to create viral ads</h2>
                <p>Professional tools designed for marketers and agencies</p>
              </div>
              <div className="features-grid-landing">
                {features.slice(0, 8).map((feature, i) => (
                  <div key={i} className="feature-card-landing">
                    <div className="feature-icon" style={{ background: feature.gradient }}>
                      {feature.icon}
                    </div>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                    {feature.isPopular && <span className="feature-badge">Most Popular</span>}
                    {feature.badge && <span className="feature-badge">{feature.badge}</span>}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Pricing Section */}
          <section id="pricing" className="landing-pricing" aria-labelledby="pricing-heading">
            <div className="container">
              <div className="section-header">
                <h2 id="pricing-heading">Simple, transparent pricing</h2>
                <p>Choose the plan that fits your creative needs</p>
              </div>
              
              <div className="pricing-carousel-container">
                <div className="pricing-carousel" role="region" aria-label="Pricing plans">
                  <div className="pricing-track">
                    {/* Free Trial Card */}
                    <div className="pricing-card trial-card">
                      <div className="pricing-header">
                        <div className="plan-badge trial">Free Trial</div>
                        <h3>Try Everything</h3>
                        <div className="price">
                          <span className="currency">$</span>
                          <span className="amount">0</span>
                          <span className="period">/7 days</span>
                        </div>
                        <p className="plan-description">Perfect for testing our platform</p>
                      </div>
                      <ul className="features-list">
                        <li><CheckCircle size={16} />Access to all features</li>
                        <li><CheckCircle size={16} />5 video exports</li>
                        <li><CheckCircle size={16} />Standard processing</li>
                        <li><CheckCircle size={16} />Email support</li>
                      </ul>
                      <a href="/auth" className="btn btn-outline btn-full">Start Free Trial</a>
                    </div>

                    {/* Basic Card */}
                    <div className="pricing-card">
                      <div className="pricing-header">
                        <h3>Basic</h3>
                        <div className="price">
                          <span className="currency">$</span>
                          <span className="amount">29</span>
                          <span className="period">/month</span>
                        </div>
                        <p className="plan-description">Essential tools for creators</p>
                      </div>
                      <ul className="features-list">
                        <li><CheckCircle size={16} />AI Lipsync unlimited</li>
                        <li><CheckCircle size={16} />Image generation</li>
                        <li><CheckCircle size={16} />Text-to-speech</li>
                        <li><CheckCircle size={16} />Background removal</li>
                        <li><CheckCircle size={16} />50 exports/month</li>
                        <li><CheckCircle size={16} />Standard support</li>
                      </ul>
                      <a href="/auth" className="btn btn-outline btn-full">Choose Basic</a>
                    </div>

                    {/* Pro Card - Featured */}
                    <div className="pricing-card featured">
                      <div className="pricing-header">
                        <div className="plan-badge popular">Most Popular</div>
                        <h3>Pro</h3>
                        <div className="price">
                          <span className="currency">$</span>
                          <span className="amount">79</span>
                          <span className="period">/month</span>
                        </div>
                        <p className="plan-description">Advanced features for professionals</p>
                      </div>
                      <ul className="features-list">
                        <li><CheckCircle size={16} />Everything in Basic</li>
                        <li><CheckCircle size={16} />Advanced video generation (Veo)</li>
                        <li><CheckCircle size={16} />Auto-edit with AI</li>
                        <li><CheckCircle size={16} />Priority processing (3x faster)</li>
                        <li><CheckCircle size={16} />Unlimited exports</li>
                        <li><CheckCircle size={16} />Premium support</li>
                        <li><CheckCircle size={16} />Commercial license</li>
                        <li><CheckCircle size={16} />API access</li>
                      </ul>
                      <a href="/auth" className="btn btn-primary btn-full">
                        <span>Choose Pro</span>
                        <Crown size={16} />
                      </a>
                    </div>

                    {/* Enterprise Card */}
                    <div className="pricing-card">
                      <div className="pricing-header">
                        <h3>Enterprise</h3>
                        <div className="price">
                          <span className="currency">$</span>
                          <span className="amount">299</span>
                          <span className="period">/month</span>
                        </div>
                        <p className="plan-description">For teams and agencies</p>
                      </div>
                      <ul className="features-list">
                        <li><CheckCircle size={16} />Everything in Pro</li>
                        <li><CheckCircle size={16} />Team collaboration</li>
                        <li><CheckCircle size={16} />White-label options</li>
                        <li><CheckCircle size={16} />Custom integrations</li>
                        <li><CheckCircle size={16} />Dedicated support</li>
                        <li><CheckCircle size={16} />SLA guarantee</li>
                      </ul>
                      <a href="/auth" className="btn btn-outline btn-full">Contact Sales</a>
                    </div>
                  </div>
                  
                  <div className="carousel-nav">
                    <button 
                      className="carousel-btn prev" 
                      aria-label="Previous plan"
                      onClick={() => {
                        const track = document.querySelector('.pricing-track');
                        if (track) track.scrollBy({ left: -340, behavior: 'smooth' });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          const track = document.querySelector('.pricing-track');
                          if (track) track.scrollBy({ left: -340, behavior: 'smooth' });
                        }
                      }}
                    >
                      <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <button 
                      className="carousel-btn next" 
                      aria-label="Next plan"
                      onClick={() => {
                        const track = document.querySelector('.pricing-track');
                        if (track) track.scrollBy({ left: 340, behavior: 'smooth' });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          const track = document.querySelector('.pricing-track');
                          if (track) track.scrollBy({ left: 340, behavior: 'smooth' });
                        }
                      }}
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
                
                <div className="pricing-guarantee">
                  <Shield size={20} />
                  <span>30-day money-back guarantee • Cancel anytime</span>
                </div>
              </div>
            </div>
          </section>

          {/* Social Proof */}
          <section className="landing-testimonials" aria-labelledby="testimonials-heading">
            <div className="container">
              <h2 id="testimonials-heading">Trusted by marketers worldwide</h2>
              <div className="testimonials-grid">
                <div className="testimonial-card">
                  <div className="testimonial-rating">
                    {[...Array(5)].map((_, i) => <Star key={i} size={16} className="star-filled" />)}
                  </div>
                  <p>&ldquo;Game changer for our ad campaigns. What used to take hours now takes minutes.&rdquo;</p>
                  <div className="testimonial-author">
                    <div className="author-avatar">JD</div>
                    <div>
                      <strong>Jane Doe</strong>
                      <span>Marketing Director, E-commerce</span>
                    </div>
                  </div>
                </div>
                <div className="testimonial-card">
                  <div className="testimonial-rating">
                    {[...Array(5)].map((_, i) => <Star key={i} size={16} className="star-filled" />)}
                  </div>
                  <p>&ldquo;The AI lipsync quality is incredible. Our clients see 3x better conversion rates.&rdquo;</p>
                  <div className="testimonial-author">
                    <div className="author-avatar">MS</div>
                    <div>
                      <strong>Mike Smith</strong>
                      <span>Digital Agency Owner</span>
                    </div>
                  </div>
                </div>
                <div className="testimonial-card">
                  <div className="testimonial-rating">
                    {[...Array(5)].map((_, i) => <Star key={i} size={16} className="star-filled" />)}
                  </div>
                  <p>&ldquo;Finally, a tool that understands marketers. The workflow is perfect for scaling campaigns.&rdquo;</p>
                  <div className="testimonial-author">
                    <div className="author-avatar">AL</div>
                    <div>
                      <strong>Alex Lee</strong>
                      <span>Performance Marketing Manager</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="landing-faq" aria-labelledby="faq-heading">
            <div className="container">
              <div className="section-header">
                <h2 id="faq-heading">Frequently asked questions</h2>
                <p>Everything you need to know about our platform</p>
              </div>
              <div className="faq-grid">
                <details className="faq-item">
                  <summary>Do I need any editing experience?</summary>
                  <p>No experience required! Our AI-powered tools are designed for creators of all skill levels. Simply upload your content and let our AI handle the technical work.</p>
                </details>
                <details className="faq-item">
                  <summary>How fast is the processing?</summary>
                  <p>Most videos process in under 2 minutes. Pro users get priority processing that&rsquo;s 3x faster than Basic plans.</p>
                </details>
                <details className="faq-item">
                  <summary>Can I cancel anytime?</summary>
                  <p>Yes! Cancel anytime from your billing dashboard. No long-term contracts or cancellation fees.</p>
                </details>
                <details className="faq-item">
                  <summary>What file formats do you support?</summary>
                  <p>We support all major video formats (MP4, MOV, AVI), audio formats (MP3, WAV, M4A), and image formats (JPG, PNG, WebP).</p>
                </details>
                <details className="faq-item">
                  <summary>Is my data secure?</summary>
                  <p>Yes. We use enterprise-grade security, encrypt all data in transit and at rest, and provide full export/delete controls.</p>
                </details>
                <details className="faq-item">
                  <summary>Do you offer refunds?</summary>
                  <p>We offer a 30-day money-back guarantee. If you&rsquo;re not satisfied, contact support for a full refund.</p>
                </details>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="landing-cta">
            <div className="container">
              <div className="cta-content">
                <h2>Ready to transform your content creation?</h2>
                <p>Join thousands of marketers who&rsquo;ve already made the switch</p>
                <a href="/auth" className="btn btn-primary btn-large">
                  <span>Start Creating Today</span>
                  <ArrowRight size={20} />
                </a>
              </div>
            </div>
          </section>
        </main>

        <footer className="landing-footer" role="contentinfo">
          <div className="container">
            <div className="footer-content">
              <div className="footer-brand">
                <Activity size={24} />
                <span>AdzCreator</span>
              </div>
              <div className="footer-links">
                <a href="/privacy">Privacy</a>
                <a href="/terms">Terms</a>
                <a href="/support">Support</a>
              </div>
            </div>
            <div className="footer-bottom">
              <p>© {new Date().getFullYear()} AdzCreator. All rights reserved.</p>
            </div>
          </div>
        </footer>
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