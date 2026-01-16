'use client';

import '../globals.css';
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Paperclip,
  Brain,
  Loader2,
  MessageSquare,
  Sparkles,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Check,
  Plus,
  Trash2,
  Film,
  Play,
  ChevronRight,
  Clock,
  Volume2,
} from 'lucide-react';
import type { Message, Conversation, Storyboard, StoryboardScene } from '../../types/assistant';
import styles from './assistant.module.css';

type StreamEvent = {
  type: string;
  data?: unknown;
};

type ReplicateStatusResponse = {
  id: string;
  status: string;
  outputUrl: string | null;
  error: string | null;
};

export default function AssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [currentReflexion, setCurrentReflexion] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expandedReflexions, setExpandedReflexions] = useState<Set<string>>(new Set());
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get auth token on mount
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        setAuthToken(session.access_token);
        setUserEmail(session.user?.email || '');
      }
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token || null);
      setUserEmail(session?.user?.email || '');
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load conversations
  useEffect(() => {
    if (!authToken) return;
    
    const loadConversations = async () => {
      try {
        const res = await fetch('/api/assistant/conversations', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          setConversations(data.conversations || []);
        }
      } catch (e) {
        console.error('Failed to load conversations:', e);
      }
    };
    
    loadConversations();
  }, [authToken]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentReflexion, currentResponse]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  const toggleReflexion = (messageId: string) => {
    setExpandedReflexions(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const persistMessages = useCallback(async (nextMessages: Message[]) => {
    if (!authToken || !activeConversationId) return;
    try {
      await fetch('/api/assistant/conversations', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          conversation_id: activeConversationId,
          messages: nextMessages,
        }),
      });
    } catch {
      // ignore persistence errors; UI still shows the image
    }
  }, [authToken, activeConversationId]);

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setCurrentReflexion('');
    setCurrentResponse('');
    setError(null);
  };

  const loadConversation = (conv: Conversation) => {
    setActiveConversationId(conv.id);
    setMessages(conv.messages || []);
    setCurrentReflexion('');
    setCurrentResponse('');
    setError(null);
  };

  const deleteConversation = async (convId: string) => {
    if (!authToken) return;
    
    try {
      await fetch(`/api/assistant/conversations?id=${convId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      setConversations(prev => prev.filter(c => c.id !== convId));
      
      if (activeConversationId === convId) {
        startNewConversation();
      }
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    }
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading || !authToken) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsThinking(true);
    setCurrentReflexion('');
    setCurrentResponse('');
    setError(null);

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          conversation_id: activeConversationId,
          message: userMessage.content,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let reflexionText = '';
      let responseText = '';
      let newConversationId = activeConversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          try {
            const event: StreamEvent = JSON.parse(line.slice(6));
            
            switch (event.type) {
              case 'conversation_id':
                newConversationId = event.data as string;
                setActiveConversationId(newConversationId);
                break;
              
              case 'reflexion_start':
                setIsThinking(true);
                break;
              
              case 'reflexion_chunk':
                reflexionText += event.data as string;
                setCurrentReflexion(reflexionText);
                break;
              
              case 'reflexion_end':
                setIsThinking(false);
                break;
              
              case 'response_start':
                setIsThinking(false);
                break;
              
              case 'response_chunk':
                responseText += event.data as string;
                setCurrentResponse(responseText);
                break;
              
              case 'tool_call':
                const toolCall = event.data as { tool: string; input: unknown };
                setMessages(prev => [...prev, {
                  id: crypto.randomUUID(),
                  role: 'tool_call',
                  content: `Executing ${toolCall.tool}...`,
                  timestamp: new Date().toISOString(),
                  tool_name: toolCall.tool,
                  tool_input: toolCall.input as Record<string, unknown>,
                }]);
                break;
              
              case 'tool_result':
                const toolResult = event.data as { tool: string; result: { success: boolean; output?: unknown; error?: string } };
                setMessages(prev => [...prev, {
                  id: crypto.randomUUID(),
                  role: 'tool_result',
                  content: toolResult.result.success 
                    ? (typeof toolResult.result.output === 'string' 
                        ? toolResult.result.output 
                        : JSON.stringify(toolResult.result.output, null, 2))
                    : `Error: ${toolResult.result.error}`,
                  timestamp: new Date().toISOString(),
                  tool_name: toolResult.tool,
                  tool_output: toolResult.result as Record<string, unknown>,
                }]);
                break;
              
              case 'done':
                // Add reflexion message if present
                if (reflexionText.trim()) {
                  setMessages(prev => [...prev, {
                    id: crypto.randomUUID(),
                    role: 'reflexion',
                    content: reflexionText.replace(/<\/?reflexion>/g, '').trim(),
                    timestamp: new Date().toISOString(),
                    isCollapsed: true,
                  }]);
                }
                
                // Add assistant response
                const cleanedResponse = responseText
                  .replace(/<reflexion>[\s\S]*?<\/reflexion>/g, '')
                  .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
                  .trim();
                
                if (cleanedResponse) {
                  setMessages(prev => [...prev, {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: cleanedResponse,
                    timestamp: new Date().toISOString(),
                  }]);
                }
                
                setCurrentReflexion('');
                setCurrentResponse('');
                
                // Refresh conversations list
                const convRes = await fetch('/api/assistant/conversations', {
                  headers: { Authorization: `Bearer ${authToken}` }
                });
                if (convRes.ok) {
                  const data = await convRes.json();
                  setConversations(data.conversations || []);
                }
                break;
              
              case 'error':
                setError(event.data as string);
                break;
            }
          } catch (e) {
            console.error('Failed to parse event:', e);
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message || 'Failed to send message');
      }
    } finally {
      setIsLoading(false);
      setIsThinking(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, authToken, activeConversationId]);

  function Markdown({ content }: { content: string }) {
    return (
      <div className={styles.markdown}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  function ReflexionBlock({ id, text, isStreaming }: { id: string; text: string; isStreaming?: boolean }) {
    const expanded = expandedReflexions.has(id) || Boolean(isStreaming);
    return (
      <div>
        <button
          className={styles.reflexionToggle}
          onClick={() => toggleReflexion(id)}
          type="button"
          aria-expanded={expanded}
          title="Show/hide reflexion"
        >
          <Brain size={14} />
          <span>Reflexion</span>
          <span>{expanded ? '▾' : '▸'}</span>
        </button>
        {expanded && (
          <div className={styles.reflexionBox}>
            {text}
          </div>
        )}
      </div>
    );
  }

  function ImagePredictionCard({
    messageId,
    predictionId,
    initialStatus,
    initialUrl,
  }: {
    messageId: string;
    predictionId: string;
    initialStatus?: string;
    initialUrl?: string | null;
  }) {
    const [status, setStatus] = useState<string>(initialStatus || 'starting');
    const [outputUrl, setOutputUrl] = useState<string | null>(typeof initialUrl === 'string' ? initialUrl : null);
    const [pollError, setPollError] = useState<string | null>(null);

    useEffect(() => {
      let mounted = true;
      let timeout: any = null;

      const isTerminal = (s: string) => ['succeeded', 'failed', 'canceled'].includes((s || '').toLowerCase());

      async function poll() {
        if (!predictionId) return;
        try {
          const res = await fetch(`/api/replicate/status?id=${encodeURIComponent(predictionId)}`, { cache: 'no-store' });
          if (!res.ok) throw new Error(await res.text());
          const json = (await res.json()) as ReplicateStatusResponse;
          if (!mounted) return;

          setStatus(json.status || status);
          if (json.outputUrl) {
            const finalUrl = String(json.outputUrl);
            setOutputUrl(finalUrl);
            setPollError(null);
            // Persist outputUrl back into the stored conversation message so it stays permanent
            setMessages(prev => {
              const next = prev.map((m) => {
                if (m.id !== messageId) return m;
                const tool_output = { ...(m.tool_output || {}) } as any;
                tool_output.outputUrl = finalUrl;
                tool_output.status = json.status;
                return { ...m, tool_output, content: finalUrl };
              });
              void persistMessages(next);
              return next;
            });
            return;
          }
          if (json.error) setPollError(json.error);

          if (!isTerminal(json.status || '')) {
            timeout = setTimeout(poll, 2000);
          }
        } catch (e: any) {
          if (!mounted) return;
          setPollError(e?.message || 'Failed to fetch image status');
          timeout = setTimeout(poll, 3000);
        }
      }

      // If we already have URL, no need to poll
      if (!outputUrl) void poll();

      return () => {
        mounted = false;
        if (timeout) clearTimeout(timeout);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [predictionId]);

    return (
      <div className={styles.toolCard}>
        <div className={styles.toolHeader}>
          <ImageIcon size={16} />
          <span>Image generation</span>
          <span className={`${styles.pill} ${String(status).toLowerCase() === 'succeeded' ? styles.pillOk : ''} ${['failed','canceled'].includes(String(status).toLowerCase()) ? styles.pillBad : ''}`}>
            {String(status)}
          </span>
          {!outputUrl && <Loader2 size={14} className={styles.spinner} />}
        </div>
        <div className={styles.toolBody}>
          {outputUrl ? (
            <a href={outputUrl} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.10)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={outputUrl} alt="Generated image" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </a>
          ) : (
            <div style={{ border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 16, padding: 14, color: 'rgba(231,233,238,0.65)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={16} className={styles.spinner} />
                <span>Generating image…</span>
              </div>
              {pollError && <div style={{ marginTop: 8, color: 'rgba(239,68,68,0.95)', fontSize: 12, whiteSpace: 'pre-wrap' }}>{pollError}</div>}
            </div>
          )}
        </div>
      </div>
    );
  }

  function ScriptCard({ content }: { content: string }) {
    return (
      <div className={styles.toolCard}>
        <div className={styles.toolHeader}>
          <FileText size={16} />
          <span>Script</span>
          <span className={`${styles.pill} ${styles.pillOk}`}>ready</span>
        </div>
        <div className={styles.toolBody}>
          <Markdown content={content} />
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => navigator.clipboard.writeText(content)}
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Scene frame image component with polling - Production Ready
  function SceneFrameImage({
    predictionId,
    label,
    initialUrl,
    initialStatus,
    errorMessage,
  }: {
    predictionId?: string;
    label: string;
    initialUrl?: string;
    initialStatus?: string;
    errorMessage?: string;
  }) {
    const [url, setUrl] = useState<string | null>(initialUrl || null);
    const [status, setStatus] = useState<string>(initialUrl ? 'succeeded' : (initialStatus || 'pending'));

    useEffect(() => {
      if (url || !predictionId) return;
      
      let mounted = true;
      let timeout: ReturnType<typeof setTimeout>;

      async function poll() {
        if (!predictionId) return;
        try {
          const res = await fetch(`/api/replicate/status?id=${encodeURIComponent(predictionId)}`, { cache: 'no-store' });
          if (!res.ok || !mounted) return;
          const json = await res.json();
          
          setStatus(json.status || 'processing');
          if (json.outputUrl) {
            setUrl(String(json.outputUrl));
            return;
          }
          
          if (!['succeeded', 'failed', 'canceled'].includes(json.status || '')) {
            timeout = setTimeout(poll, 2000);
          }
        } catch {
          if (mounted) timeout = setTimeout(poll, 3000);
        }
      }

      poll();
      return () => { mounted = false; clearTimeout(timeout); };
    }, [predictionId, url]);

    const isGenerating = !url && status !== 'failed';
    const isFailed = status === 'failed';

    return (
      <div className={styles.frameCard}>
        <div className={styles.frameHeader}>
          <span className={styles.frameLabel}>{label}</span>
          {isGenerating && (
            <span className={styles.frameStatus}>
              <Loader2 size={12} className={styles.spinner} />
              <span>Generating</span>
            </span>
          )}
          {url && (
            <span className={styles.frameStatusDone}>
              <Check size={12} />
            </span>
          )}
          {isFailed && (
            <span className={styles.frameStatusFailed}>
              <AlertCircle size={12} />
            </span>
          )}
        </div>
        <div className={styles.frameImageWrap}>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className={styles.frameImageLink}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={label} className={styles.frameImage} />
            </a>
          ) : (
            <div className={styles.frameImagePlaceholder}>
              {isGenerating ? (
                <>
                  <div className={styles.frameImageLoader}>
                    <Loader2 size={24} className={styles.spinner} />
                  </div>
                  <span>Generating {label.toLowerCase()}...</span>
                </>
              ) : (
                <>
                  <AlertCircle size={24} />
                  <span>Generation failed</span>
                  {errorMessage && (
                    <span className={styles.frameErrorText}>
                      {errorMessage}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Individual scene card component - Production Ready
  function SceneCard({ scene, aspectRatio }: { scene: StoryboardScene; aspectRatio?: string }) {
    return (
      <div className={styles.sceneCard}>
        {/* Scene Header */}
        <div className={styles.sceneHeader}>
          <div className={styles.sceneNumberBadge}>{scene.scene_number}</div>
          <div className={styles.sceneHeaderContent}>
            <h4 className={styles.sceneName}>{scene.scene_name}</h4>
            <div className={styles.sceneTags}>
              {scene.duration_seconds && (
                <span className={styles.sceneTag}>
                  <Clock size={10} />
                  {scene.duration_seconds}s
                </span>
              )}
              {scene.transition_type && (
                <span className={styles.sceneTag}>
                  {scene.transition_type === 'smooth' ? '↔️' : '✂️'} {scene.transition_type}
                </span>
              )}
              {scene.camera_angle && scene.camera_angle !== 'same' && (
                <span className={styles.sceneTag}>📷 {scene.camera_angle}</span>
              )}
            </div>
          </div>
        </div>

        {/* Scene Description */}
        <div className={styles.sceneDescription}>
          {scene.description}
        </div>

        {/* Frames Grid */}
        <div className={styles.framesGrid}>
          <SceneFrameImage
            predictionId={scene.first_frame_prediction_id}
            label="First Frame"
            initialUrl={scene.first_frame_url}
            initialStatus={scene.first_frame_status}
            errorMessage={scene.first_frame_error}
          />
          <div className={styles.framesArrow}>
            <div className={styles.arrowLine} />
            <Play size={14} />
            <div className={styles.arrowLine} />
          </div>
          <SceneFrameImage
            predictionId={scene.last_frame_prediction_id}
            label="Last Frame"
            initialUrl={scene.last_frame_url}
            initialStatus={scene.last_frame_status}
            errorMessage={scene.last_frame_error}
          />
        </div>

        {/* Video Generation Prompt */}
        {scene.video_generation_prompt && (
          <div className={styles.videoPromptBox}>
            <div className={styles.videoPromptLabel}>
              <Film size={12} />
              <span>Video Generation Prompt</span>
            </div>
            <p className={styles.videoPromptText}>{scene.video_generation_prompt}</p>
          </div>
        )}

        {/* Audio Notes */}
        {scene.audio_notes && (
          <div className={styles.audioNotesBox}>
            <div className={styles.audioNotesLabel}>
              <Volume2 size={12} />
              <span>Audio</span>
            </div>
            <p className={styles.audioNotesText}>{scene.audio_notes}</p>
          </div>
        )}
      </div>
    );
  }

  // Full storyboard card component - Production Ready
  function StoryboardCard({ storyboard }: { storyboard: Storyboard }) {
    const totalDuration = storyboard.total_duration_seconds || 
      storyboard.scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    
    const generatingCount = storyboard.scenes.filter(s => 
      s.first_frame_status === 'generating' || s.last_frame_status === 'generating'
    ).length;

    return (
      <div className={styles.storyboardCard}>
        {/* Header */}
        <div className={styles.storyboardHeader}>
          <div className={styles.storyboardHeaderLeft}>
            <div className={styles.storyboardIcon}>
              <Film size={18} />
            </div>
            <div>
              <h3 className={styles.storyboardTitle}>{storyboard.title}</h3>
              <div className={styles.storyboardSubtitle}>
                {storyboard.scenes.length} scenes • {totalDuration}s total
                {generatingCount > 0 && (
                  <span className={styles.generatingBadge}>
                    <Loader2 size={10} className={styles.spinner} />
                    {generatingCount * 2} frames generating
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={styles.storyboardTags}>
            {storyboard.platform && (
              <span className={styles.storyboardTag}>{storyboard.platform}</span>
            )}
            {storyboard.aspect_ratio && (
              <span className={styles.storyboardTag}>{storyboard.aspect_ratio}</span>
            )}
          </div>
        </div>

        {/* Meta Info */}
        {(storyboard.brand_name || storyboard.product || storyboard.style) && (
          <div className={styles.storyboardMeta}>
            {storyboard.brand_name && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Brand</span>
                <span className={styles.metaValue}>{storyboard.brand_name}</span>
              </div>
            )}
            {storyboard.product && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Product</span>
                <span className={styles.metaValue}>{storyboard.product}</span>
              </div>
            )}
            {storyboard.style && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Style</span>
                <span className={styles.metaValue}>{storyboard.style}</span>
              </div>
            )}
          </div>
        )}

        {/* Avatar Reference (if exists) */}
        {storyboard.avatar_image_url && (
          <div className={styles.avatarReference}>
            <div className={styles.avatarLabel}>
              <span>🎭 Avatar Reference</span>
              {storyboard.avatar_description && (
                <span className={styles.avatarDesc}>{storyboard.avatar_description}</span>
              )}
            </div>
            <div className={styles.avatarThumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={storyboard.avatar_image_url} alt="Avatar reference" />
            </div>
          </div>
        )}

        {/* Scenes */}
        <div className={styles.scenesContainer}>
          {storyboard.scenes.map((scene) => (
            <SceneCard 
              key={scene.scene_number} 
              scene={scene} 
              aspectRatio={storyboard.aspect_ratio}
            />
          ))}
        </div>
      </div>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderMessage = (message: Message, index: number) => {
    const isUser = message.role === 'user';
    const isReflexion = message.role === 'reflexion';
    const isToolCall = message.role === 'tool_call';
    const isToolResult = message.role === 'tool_result';

    if (isReflexion) {
      return (
        <div key={message.id} className={styles.row}>
          <div className={`${styles.avatar} ${styles.avatarAssistant}`}>
            <Brain size={16} />
          </div>
          <div className={styles.bubble}>
            <ReflexionBlock id={message.id} text={message.content} />
          </div>
        </div>
      );
    }

    if (isToolCall) {
      const getToolIcon = () => {
        switch (message.tool_name) {
          case 'script_creation': return <FileText size={16} />;
          case 'storyboard_creation': return <Film size={16} />;
          default: return <ImageIcon size={16} />;
        }
      };
      const getToolLabel = () => {
        switch (message.tool_name) {
          case 'script_creation': return 'Generating script…';
          case 'storyboard_creation': return 'Creating storyboard…';
          default: return 'Generating image…';
        }
      };
      return (
        <div key={message.id} className={styles.row}>
          <div className={`${styles.avatar} ${styles.avatarAssistant}`}>
            <Sparkles size={16} />
          </div>
          <div className={styles.bubble}>
            <div className={styles.toolHeader}>
              {getToolIcon()}
              <span>{getToolLabel()}</span>
              <Loader2 size={14} className={styles.spinner} />
            </div>
          </div>
        </div>
      );
    }

    if (isToolResult) {
      const success = message.tool_output && (message.tool_output as any).success !== false;
      const predictionId =
        message.tool_name === 'image_generation'
          ? (message.tool_output as any)?.output?.id ||
            (message.tool_output as any)?.id ||
            (message.tool_output as any)?.prediction_id ||
            (message.tool_output as any)?.predictionId ||
            null
          : null;
      const persistedUrl =
        message.tool_name === 'image_generation'
          ? (message.tool_output as any)?.outputUrl ||
            (message.tool_output as any)?.output_url ||
            (message.tool_output as any)?.output?.outputUrl ||
            (typeof message.content === 'string' && message.content.startsWith('http') ? message.content : null)
          : null;
      const initialStatus =
        message.tool_name === 'image_generation'
          ? (message.tool_output as any)?.output?.status || (message.tool_output as any)?.status
          : undefined;
      
      // Extract storyboard data
      const storyboardData =
        message.tool_name === 'storyboard_creation'
          ? (message.tool_output as any)?.output?.storyboard ||
            (message.tool_output as any)?.storyboard ||
            null
          : null;

      return (
        <div key={message.id} className={styles.row}>
          <div className={`${styles.avatar} ${styles.avatarAssistant}`}>
            {success ? <Check size={16} /> : <AlertCircle size={16} />}
          </div>
          <div className={`${styles.bubble} ${message.tool_name === 'storyboard_creation' ? styles.bubbleWide : ''}`}>
            {message.tool_name === 'image_generation' && predictionId ? (
              <ImagePredictionCard
                messageId={message.id}
                predictionId={String(predictionId)}
                initialStatus={initialStatus}
                initialUrl={persistedUrl}
              />
            ) : message.tool_name === 'script_creation' ? (
              <ScriptCard content={message.content} />
            ) : message.tool_name === 'storyboard_creation' && storyboardData ? (
              <StoryboardCard storyboard={storyboardData as Storyboard} />
            ) : (
              <Markdown content={message.content} />
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        key={message.id}
        className={`${styles.row} ${isUser ? styles.rowUser : ''}`}
      >
        <div className={`${styles.avatar} ${isUser ? '' : styles.avatarAssistant}`}>
          {isUser ? <span>{userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}</span> : <Sparkles size={16} />}
        </div>
        <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : ''}`}>
          <div className={styles.metaLine}>
            <span className={styles.metaRole}>{isUser ? 'You' : 'Assistant'}</span>
            <span className={styles.metaTime}>{new Date(message.timestamp).toLocaleTimeString()}</span>
          </div>
          <Markdown content={message.content} />
        </div>
      </div>
    );
  };

  if (!authToken) {
    return (
      <div style={{ minHeight: 'calc(100vh - 60px)', display: 'grid', placeItems: 'center', background: '#0b0c0f', color: '#e7e9ee', padding: 20 }}>
        <div style={{ maxWidth: 420, width: '100%', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 22, padding: 18, background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
            <MessageSquare size={18} />
            <span>AI Assistant</span>
          </div>
          <p style={{ marginTop: 10, color: 'rgba(231,233,238,0.65)', lineHeight: 1.6 }}>
            Sign in to start chatting with your creative AI assistant.
          </p>
          <a href="/auth" className="btn" style={{ marginTop: 10, display: 'inline-flex' }}>Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div>
            <div className={styles.brand}>
              <span className={styles.iconChip}><Sparkles size={16} /></span>
              <span>AI Assistant</span>
            </div>
            <div className={styles.brandSub}>Minimal, pro chat</div>
          </div>
          <button className={styles.newBtn} onClick={startNewConversation} type="button" title="New chat">
            <Plus size={18} />
          </button>
        </div>
        <div className={styles.sidebarBody}>
          {conversations.length === 0 ? (
            <div style={{ padding: 10, color: 'rgba(231,233,238,0.6)', fontSize: 13 }}>
              No conversations yet.
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = activeConversationId === conv.id;
              const lastMsg = (conv.messages || []).slice(-1)[0];
              const preview = lastMsg?.content ? String(lastMsg.content).slice(0, 46) : '…';
              return (
                <div
                  key={conv.id}
                  className={`${styles.convItem} ${isActive ? styles.convItemActive : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => loadConversation(conv)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') loadConversation(conv); }}
                >
                  <div>
                    <div className={styles.convTitle}>{conv.title || 'Untitled'}</div>
                    <div className={styles.convMeta}>{preview}</div>
                  </div>
                  <button
                    className={styles.trashBtn}
                    type="button"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.topbarTitle}>
            <span className={styles.iconChip}><MessageSquare size={16} /></span>
            <span>Chat</span>
          </div>
          <div className={styles.topbarHint}>
            {isLoading ? 'Generating…' : 'Enter to send · Shift+Enter for newline'}
          </div>
        </div>

        <div className={styles.scroll}>
          <div className={styles.content}>
            {messages.length === 0 && !isLoading ? (
              <div className={styles.welcome}>
                <h2 className={styles.welcomeTitle}>What are we making today?</h2>
                <div className={styles.welcomeSub}>
                  Ask for ad scripts, complete video storyboards, or image prompts. I&apos;ll ask precise follow‑ups when needed.
                </div>
                <div className={styles.chips}>
                  <button className={styles.chip} type="button" onClick={() => setInput('Create a complete UGC video ad storyboard for a vitamin C serum targeting women 25-35, 30 seconds for TikTok.')}>
                    🎬 Complete UGC Storyboard
                  </button>
                  <button className={styles.chip} type="button" onClick={() => setInput('Create a UGC TikTok script for a mascara brand with a strong hook and CTA.')}>
                    UGC script (TikTok)
                  </button>
                  <button className={styles.chip} type="button" onClick={() => setInput('Generate a first-frame image for a UGC product ad in a clean bathroom setting, vertical 9:16.')}>
                    First-frame image (9:16)
                  </button>
                  <button className={styles.chip} type="button" onClick={() => setInput('Help me brainstorm 5 ad angles for a new skincare product.')}>
                    5 ad angles
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map(renderMessage)}

                {/* Streaming reflexion: show live, then user can collapse via Reflexion button */}
                {currentReflexion && (
                  <div className={styles.row}>
                    <div className={`${styles.avatar} ${styles.avatarAssistant}`}>
                      <Brain size={16} />
                    </div>
                    <div className={styles.bubble}>
                      <ReflexionBlock
                        id="__streaming_reflexion__"
                        text={currentReflexion.replace(/<\/?reflexion>/g, '').trim()}
                        isStreaming={isThinking}
                      />
                    </div>
                  </div>
                )}

                {/* Streaming response (formatted) */}
                {currentResponse && (
                  <div className={styles.row}>
                    <div className={`${styles.avatar} ${styles.avatarAssistant}`}>
                      <Sparkles size={16} />
                    </div>
                    <div className={styles.bubble}>
                      <div className={styles.metaLine}>
                        <span className={styles.metaRole}>Assistant</span>
                        <span className={styles.metaTime}>now</span>
                      </div>
                      <Markdown
                        content={currentResponse
                          .replace(/<reflexion>[\s\S]*?<\/reflexion>/g, '')
                          .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
                          .trim()}
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className={styles.toolCard}>
                    <div className={styles.toolHeader}>
                      <AlertCircle size={16} />
                      <span>Error</span>
                      <span className={`${styles.pill} ${styles.pillBad}`}>failed</span>
                    </div>
                    <div className={styles.toolBody}>
                      <div style={{ color: 'rgba(239,68,68,0.95)', whiteSpace: 'pre-wrap', fontSize: 13 }}>{error}</div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className={styles.composerWrap}>
          <div className={styles.composer}>
            <button className={styles.iconBtn} type="button" title="Attach (coming soon)">
              <Paperclip size={18} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message the assistant…"
              rows={1}
              disabled={isLoading}
            />
            <button
              className={`${styles.iconBtn} ${styles.sendBtn}`}
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              type="button"
              title="Send"
            >
              {isLoading ? <Loader2 size={18} className={styles.spinner} /> : <Send size={18} />}
            </button>
          </div>
          <div className={styles.statusLine}>
            {isThinking ? 'Reflexion running…' : isLoading ? 'Generating response…' : ' '}
          </div>
        </div>
      </main>
    </div>
  );
}
