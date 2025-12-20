'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';
import { type SerializedTask } from '../../lib/tasksData';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Download, 
  ExternalLink, 
  Copy,
  Filter,
  Search,
  Calendar,
  Play,
  RefreshCcw,
  Volume2,
  Image as ImageIcon,
  Video,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Trash2,
  Eye,
  Wand2,
  Scissors,
  Type,
  Mic
} from 'lucide-react';

type TaskStatus = 'finished' | 'completed' | 'succeeded' | 'running' | 'processing' | 'queued' | 'error' | 'failed' | 'cancelled' | 'unknown';

type Task = SerializedTask;

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [persisted, setPersisted] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [refreshing, setRefreshing] = useState(false);

  const normalizeUrl = (kind: 'video' | 'audio' | 'image', url: string, opts?: { download?: boolean }) => {
    const encoded = encodeURIComponent(url);
    if (kind === 'video') {
      return `/api/proxy?type=video${opts?.download ? '&download=true' : ''}&url=${encoded}`;
    }
    return `/api/proxy?${opts?.download ? 'download=true&' : ''}url=${encoded}`;
  };

  const buildSecondaryActions = (kind: 'video' | 'audio' | 'image', url: string, text?: string) => {
    const actions: Array<{ href: string; label: string; icon: JSX.Element }> = [];
    if (kind === 'video') {
      actions.push(
        { href: `/lipsync?source=${encodeURIComponent(url)}`, label: 'Use in Lipsync', icon: <Play size={14} /> },
        { href: `/veo?reference_video=${encodeURIComponent(url)}`, label: 'Use in Video Gen', icon: <RefreshCcw size={14} /> },
        { href: `/auto-edit?source=${encodeURIComponent(url)}`, label: 'Refine Video', icon: <Scissors size={14} /> },
      );
    }
    if (kind === 'image') {
      actions.push(
        { href: `/veo?start_image=${encodeURIComponent(url)}`, label: 'Animate to Video', icon: <Video size={14} /> },
        { href: `/image?input_image=${encodeURIComponent(url)}`, label: 'Remix in Image Gen', icon: <Wand2 size={14} /> },
        { href: `/enhance?image=${encodeURIComponent(url)}`, label: 'Enhance', icon: <Wand2 size={14} /> },
        { href: `/background-remove?image=${encodeURIComponent(url)}`, label: 'Remove Background', icon: <Scissors size={14} /> },
      );
    }
    if (kind === 'audio') {
      actions.push(
        { href: `/lipsync?audio=${encodeURIComponent(url)}`, label: 'Use in Lipsync', icon: <Play size={14} /> },
        { href: `/transcription?audio=${encodeURIComponent(url)}`, label: 'Transcribe', icon: <Type size={14} /> },
        { href: `/transcription/bulk?audio=${encodeURIComponent(url)}`, label: 'Bulk Transcribe', icon: <Mic size={14} /> },
      );
    }
    if (text) {
      actions.push(
        { href: `/tts?text=${encodeURIComponent(text)}`, label: 'Send to TTS', icon: <Volume2 size={14} /> },
        { href: `/adscript?script=${encodeURIComponent(text)}`, label: 'Use in Script', icon: <Type size={14} /> },
      );
    }
    return actions;
  };

  const renderMediaActions = (kind: 'video' | 'audio' | 'image', url: string, textForExtras?: string) => {
    const openUrl = normalizeUrl(kind, url);
    const downloadUrl = normalizeUrl(kind, url, { download: true });
    const extras = buildSecondaryActions(kind, url, textForExtras);

    return (
      <div className="task-media-actions">
        <a href={openUrl} target="_blank" rel="noreferrer" className="media-action">
          <ExternalLink size={14} />
          Open
        </a>
        <a href={downloadUrl} className="media-action">
          <Download size={14} />
          Download
        </a>
        {extras.map((action) => (
          <a key={action.href} href={action.href} className="media-action">
            {action.icon}
            {action.label}
          </a>
        ))}
      </div>
    );
  };

  const getBackendLabel = (task: Task): string => {
    const candidates: Array<unknown> = [task.backend, task.model_id, task.provider];

    const opts = task.options_json;
    if (opts && typeof opts === 'object') {
      const model = (opts as Record<string, unknown>).model;
      const backend = (opts as Record<string, unknown>).backend;
      candidates.push(model, backend);
    }

    const label = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return typeof label === 'string' ? String(label) : 'Unknown';
  };

  const loadTasks = async () => {
    try {
      setRefreshing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { 
        setLoading(false);
        return; 
      }
      const res = await fetch(`/api/tasks/list?user_id=${encodeURIComponent(user.id)}&limit=10000&timeout_ms=8000`);
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        setError(txt || 'Failed to load tasks');
        return;
      }
        const json = (await res.json()) as { tasks?: Task[] };
        setTasks(Array.isArray(json.tasks) ? json.tasks : []);
      setError(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load tasks');
      } finally {
        setLoading(false);
      setRefreshing(false);
      }
    };

  useEffect(() => {
    loadTasks();
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = searchQuery === '' || 
        task.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.backend || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.text_input || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || 
        task.status.toLowerCase().includes(statusFilter.toLowerCase());
      
      return matchesSearch && matchesStatus;
    });
  }, [tasks, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const finished = tasks.filter(t => 
      t.status.toLowerCase().includes('finished') || 
      t.status.toLowerCase().includes('completed') || 
      t.status.toLowerCase().includes('succeeded')
    ).length;
    const running = tasks.filter(t => 
      t.status.toLowerCase().includes('running') || 
      t.status.toLowerCase().includes('processing') || 
      t.status.toLowerCase().includes('queued')
    ).length;
    const failed = tasks.filter(t => 
      t.status.toLowerCase().includes('error') || 
      t.status.toLowerCase().includes('failed') || 
      t.status.toLowerCase().includes('cancelled')
    ).length;
    
    return { total, finished, running, failed };
  }, [tasks]);

  const getTaskIcon = (task: Task) => {
    if (task.status.toLowerCase().includes('finished') || 
        task.status.toLowerCase().includes('completed') || 
        task.status.toLowerCase().includes('succeeded')) {
      return <CheckCircle size={20} className="task-icon-success" />;
    }
    if (task.status.toLowerCase().includes('running') || 
        task.status.toLowerCase().includes('processing') || 
        task.status.toLowerCase().includes('queued')) {
      return <Clock size={20} className="task-icon-running" />;
    }
    if (task.status.toLowerCase().includes('error') || 
        task.status.toLowerCase().includes('failed') || 
        task.status.toLowerCase().includes('cancelled')) {
      return <XCircle size={20} className="task-icon-error" />;
    }
    return <Activity size={20} className="task-icon-unknown" />;
  };

  const getTaskTypeIcon = (task: Task) => {
    if (task.type === 'tts') return <Volume2 size={16} />;
    const isImage = (url?: string | null) => !!url && /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);
    const isVideo = (url?: string | null) => !!url && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
    const isAudio = (url?: string | null) => !!url && /\.(mp3|wav|flac|m4a|aac|ogg)(\?|$)/i.test(url);
    if (isVideo(task.video_url) || isVideo(task.output_url)) return <Video size={16} />;
    if (isAudio(task.audio_url)) return <Volume2 size={16} />;
    if (isImage(task.output_url)) return <ImageIcon size={16} />;
    return <Activity size={16} />;
  };

  const copyToClipboard = async (text: string, button: HTMLButtonElement) => {
    try {
      await navigator.clipboard.writeText(text);
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(() => button.textContent = originalText, 1000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  if (loading) {
    return (
      <div className="tasks-loading">
        <div className="loading-spinner"></div>
        <p>Loading your tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tasks-error">
        <AlertCircle size={48} />
        <h3>Failed to load tasks</h3>
        <p>{error}</p>
        <p className="small">Please check your connection and try again, or contact support if the issue persists.</p>
        <button className="btn" onClick={loadTasks}>
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="tasks-page fade-in">
      {/* Header */}
      <div className="tasks-header">
        <div className="tasks-header-main">
          <h1 className="tasks-title">
            <Activity size={28} />
            Task Manager
            <span className="tasks-subtitle">Monitor and manage your AI processing tasks</span>
          </h1>
        </div>
        <div className="tasks-header-actions">
          <button 
            className="header-action-btn"
            onClick={loadTasks}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="tasks-stats">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(102, 126, 234, 0.2)', color: '#667eea' }}>
            <BarChart3 size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Tasks</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
            <CheckCircle size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.finished}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
            <Clock size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.running}</div>
            <div className="stat-label">In Progress</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
            <XCircle size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.failed}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="tasks-filters">
        <div className="filter-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-status">
          <Filter size={16} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | TaskStatus)}
            className="status-select"
          >
            <option value="all">All Status</option>
            <option value="finished">Completed</option>
            <option value="running">In Progress</option>
            <option value="error">Failed</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="tasks-content">
        {filteredTasks.length === 0 ? (
          <div className="tasks-empty">
            <Activity size={64} />
            <h3>No tasks found</h3>
            <p>
              {tasks.length === 0 
                ? "You haven't created any tasks yet. Start by creating a new lipsync or text-to-speech."
                : "No tasks match your current filter criteria."
              }
            </p>
            <a href="/lipsync-new" className="btn">
              Create Your First Task
            </a>
          </div>
        ) : (
          <div className="tasks-grid">
            {filteredTasks.map((task) => (
              <div key={task.id} className="task-card">
                <div className="task-card-header">
                  <div className="task-card-info">
                    <div className="task-card-title">
                      {getTaskIcon(task)}
                      <span>Task {task.id.slice(0, 8)}...</span>
                      {getTaskTypeIcon(task)}
                    </div>
                    <div className="task-card-meta">
                      <span className="task-backend">
                        {getBackendLabel(task)}
                      </span>
                      <span className="task-date">
                        <Calendar size={12} />
                        {new Date(task.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className={`task-status-badge ${task.status.toLowerCase()}`}>
                    {task.status}
                  </div>
                </div>

                <div className="task-card-content">
                  {((task.options_json && (task.options_json as any).source === 'assistant') || (task as any).assistant_conversation_id) && (
                    <div className="task-section assistant-summary">
                      <div className="assistant-badge-row">
                        <div className="assistant-badge">Assistant</div>
                        {(task as any).assistant_conversation_id && (
                          <a
                            href={`/assistant/conversation?id=${(task as any).assistant_conversation_id}`}
                            className="assistant-conversation-link"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Eye size={14} />
                            View Conversation
                          </a>
                        )}
                      </div>
                      <p className="muted">{(task.options_json as any)?.summary || task.output_text || task.text_input}</p>
                      <div className="assistant-steps">
                        {Array.isArray((task.options_json as any).steps) && (task.options_json as any).steps.map((step: any, idx: number) => (
                          <div key={step.id || idx} className="assistant-step-row">
                            <div>
                              <div className="assistant-step-title">{step.title || step.tool || `Step ${idx + 1}`}</div>
                              <div className="assistant-step-sub">
                                {step.tool} · {step.model}
                              </div>
                              {step.inputs?.prompt && <div className="assistant-step-prompt">Prompt: {String(step.inputs.prompt).slice(0, 140)}</div>}
                            </div>
                            <div className="assistant-step-output">
                              {step.output?.url ? (
                                <a href={step.output.url} className="chip subtle" target="_blank" rel="noreferrer">Output</a>
                              ) : step.output?.text ? (
                                <span className="chip subtle">Text</span>
                              ) : (
                                <span className="chip subtle">Pending</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Text Input */}
                  {task.text_input && (
                    <div className="task-section">
                      <h4>Prompt</h4>
                      <div className="task-text-input">
                        {task.text_input}
                      </div>
                      </div>
                    )}

                  {/* Media Inputs */}
                  <div className="task-media-grid">
                    {/* Video inputs */}
                    {task.video_url && (
                      <div className="task-media-section">
                        <h4>Input Video</h4>
                        <div className="task-media">
                          <video src={task.video_url} controls className="task-video" />
                          {renderMediaActions('video', task.video_url)}
                        </div>
                      </div>
                    )}

                    {/* Audio inputs */}
                    {task.audio_url && (
                      <div className="task-media-section">
                        <h4>Input Audio</h4>
                        <div className="task-media">
                          <audio src={task.audio_url} controls className="task-audio" />
                          {renderMediaActions('audio', task.audio_url)}
                        </div>
                      </div>
                    )}

                    {/* Image inputs from top-level and options */}
                    {(task as any).image_url || (task.options_json as any)?.input_image ? (
                      <div className="task-media-section">
                        <h4>Input Image</h4>
                        <div className="task-media">
                          <img src={(task as any).image_url || (task.options_json as any).input_image} alt="Input" className="task-image" />
                          {renderMediaActions('image', ((task as any).image_url || (task.options_json as any).input_image) as string)}
                        </div>
                      </div>
                    ) : null}

                    {/* Generic media discovery from options_json (URIs) */}
                    {(() => {
                      const urls: string[] = [];
                      const pushUrl = (u: unknown) => { const s = typeof u === 'string' ? u : null; if (s && /^(https?:)?\/\//.test(s)) urls.push(s); };
                      const walk = (v: unknown) => {
                        if (!v) return;
                        if (typeof v === 'string') { pushUrl(v); return; }
                        if (Array.isArray(v)) { for (const it of v) walk(it); return; }
                        if (typeof v === 'object') { for (const it of Object.values(v as Record<string, unknown>)) walk(it); }
                      };
                      walk(task.options_json as any);
                      const uniq = Array.from(new Set(urls));
                      const images = uniq.filter(u=>/\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(u));
                      const videos = uniq.filter(u=>/\.(mp4|mov|webm|m4v)(\?|$)/i.test(u));
                      const audios = uniq.filter(u=>/\.(mp3|wav|flac|m4a|aac|ogg)(\?|$)/i.test(u));
                      const extras = [] as JSX.Element[];
                      if (videos.length) extras.push(
                        <div key="opt-videos" className="task-media-section">
                          <h4>Reference Videos</h4>
                          <div className="task-media">
                            {videos.slice(0,3).map(v => (
                              <div key={v} style={{marginBottom:8}}>
                                <video src={v} controls className="task-video" />
                                {renderMediaActions('video', v)}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                      if (images.length) extras.push(
                        <div key="opt-images" className="task-media-section">
                          <h4>Reference Images</h4>
                          <div className="task-media">
                            {images.slice(0,6).map(img => (
                              <div key={img} style={{marginBottom:8}}>
                                <img src={img} alt="reference" className="task-image" />
                                {renderMediaActions('image', img)}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                      if (audios.length) extras.push(
                        <div key="opt-audios" className="task-media-section">
                          <h4>Reference Audios</h4>
                          <div className="task-media">
                            {audios.slice(0,3).map(a => (
                              <div key={a} style={{marginBottom:8}}>
                                <audio src={a} controls className="task-audio" />
                                {renderMediaActions('audio', a)}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                      return extras.length ? extras : null;
                    })()}
                </div>

                  {/* Output */}
                  <div className="task-section">
                    <h4>Output</h4>
                    {task.output_text ? (
                      <div className="task-output-text">
                        <div className="output-text-content">
                          {task.output_text}
                      </div>
                        <div className="output-text-actions">
                        <button 
                            className="output-action-btn"
                            onClick={(e) => copyToClipboard(task.output_text!, e.currentTarget)}
                          >
                            <Copy size={14} />
                          Copy Text
                        </button>
                        <a className="media-action" href={`/tts?text=${encodeURIComponent(task.output_text)}`}>
                          <Volume2 size={14} />
                          Send to TTS
                        </a>
                        <a className="media-action" href={`/adscript?script=${encodeURIComponent(task.output_text)}`}>
                          <Type size={14} />
                          Use in Script
                        </a>
                          <span className="output-text-length">
                            {task.output_text.length} characters
                          </span>
                        </div>
                      </div>
                    ) : task.output_url ? (
                      <div className="task-output-media">
                      {(() => {
                          const raw = String(task.output_url);
                          const preferred = persisted[task.id] || raw;

                        const persistAndSwap = async () => {
                          try {
                              const res = await fetch('/api/persist', { 
                                method: 'POST', 
                                headers: { 'Content-Type': 'application/json' }, 
                                body: JSON.stringify({ 
                                  url: raw, 
                                  filename: raw.split('/').pop() || null, 
                                  folder: 'tasks' 
                                }) 
                              });
                            if (!res.ok) return;
                            const j = await res.json();
                              if (j?.url) setPersisted((m) => ({ ...m, [task.id]: String(j.url) }));
                          } catch {}
                        };

                          if (task.type === 'tts') {
                          return (
                              <>
                                <audio src={preferred} controls className="task-audio" onError={persistAndSwap} />
                                {renderMediaActions('audio', preferred)}
                              </>
                            );
                          }
                          
                          if (/\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(raw)) {
                            return (
                              <>
                                <img 
                                  src={preferred.startsWith('/api/proxy') ? preferred : `/api/proxy?url=${encodeURIComponent(preferred)}`}
                                  alt="Output"
                                  className="task-image" 
                                  onError={persistAndSwap}
                                />
                                {renderMediaActions('image', preferred)}
                                {/* Database functionality removed */}
                              </>
                          );
                        }
                          
                          return (
                            <>
                              <video 
                                controls 
                                preload="metadata" 
                                playsInline 
                                className="task-video"
                                onError={persistAndSwap}
                              >
                                <source 
                                  src={preferred.startsWith('/api/proxy') ? preferred : `/api/proxy?type=video&url=${encodeURIComponent(preferred)}`}
                                  type="video/mp4" 
                                />
                                <source src={preferred} />
                              </video>
                              {renderMediaActions('video', preferred)}
                              {/* Database functionality removed */}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="task-output-empty">
                        <Clock size={24} />
                        <span>Output not available yet</span>
                      </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
