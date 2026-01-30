'use client';

import '../globals.css';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  ArrowLeft,
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
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ url: string; name: string; type: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [visibleConversations, setVisibleConversations] = useState(12);
  
  // Storyboard modal state
  const [openStoryboardId, setOpenStoryboardId] = useState<string | null>(null);
  const [openStoryboard, setOpenStoryboard] = useState<Storyboard | null>(null);
  const storyboardPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isGeneratingVideos, setIsGeneratingVideos] = useState(false);
  const [videoGenerationError, setVideoGenerationError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const aTime = new Date(a.updated_at).getTime();
      const bTime = new Date(b.updated_at).getTime();
      return bTime - aTime;
    });
  }, [conversations]);

  useEffect(() => {
    if (!sortedConversations.length) return;
    setVisibleConversations((prev) => Math.min(Math.max(prev, 12), sortedConversations.length));
  }, [sortedConversations.length]);

  useEffect(() => {
    if (!activeConversationId) return;
    const idx = sortedConversations.findIndex((c) => c.id === activeConversationId);
    if (idx >= 0 && idx + 1 > visibleConversations) {
      setVisibleConversations(idx + 1);
    }
  }, [activeConversationId, sortedConversations, visibleConversations]);

  const displayedConversations = sortedConversations.slice(0, visibleConversations);
  const remainingConversations = Math.max(0, sortedConversations.length - visibleConversations);

  // Non-intrusive scroll behavior - NEVER force scroll, only follow if user wants
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const userScrolledAwayRef = useRef(false);

  // Check if user is at bottom
  const isAtBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    const threshold = 50; // pixels from bottom
    const position = container.scrollHeight - container.scrollTop - container.clientHeight;
    return position < threshold;
  }, []);

  // Scroll to bottom smoothly (only called when user explicitly wants it)
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    setShouldAutoScroll(true);
    setShowScrollButton(false);
    userScrolledAwayRef.current = false;
  }, []);

  // Track scroll position and show/hide scroll button
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const atBottom = isAtBottom();

        if (!atBottom && !userScrolledAwayRef.current) {
          userScrolledAwayRef.current = true;
          setShouldAutoScroll(false);
          setShowScrollButton(true);
        } else if (atBottom) {
          userScrolledAwayRef.current = false;
          setShouldAutoScroll(true);
          setShowScrollButton(false);
        }
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isAtBottom]);

  // ONLY auto-scroll when shouldAutoScroll is true (user is at bottom)
  useEffect(() => {
    if (shouldAutoScroll && !userScrolledAwayRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom('auto');
      });
    }
  }, [messages, currentReflexion, currentResponse, shouldAutoScroll, scrollToBottom]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Upload to R2
        const formData = new FormData();
        formData.append('file', file);
        formData.append('filename', file.name);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const { url } = await uploadRes.json();
        
        return {
          url,
          name: file.name,
          type: file.type,
        };
      });

      const uploaded = await Promise.all(uploadPromises);
      setUploadedFiles(prev => [...prev, ...uploaded]);

      // Auto-append video URL to input if it's a video
      const videoFiles = uploaded.filter(f => f.type.startsWith('video/'));
      if (videoFiles.length > 0) {
        const videoUrls = videoFiles.map(f => f.url).join('\n');
        setInput(prev => prev ? `${prev}\n\nVideo: ${videoUrls}` : `Video: ${videoUrls}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeUploadedFile = (url: string) => {
    setUploadedFiles(prev => prev.filter(f => f.url !== url));
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

  async function persistUrlIfPossible(url: string): Promise<string> {
    try {
      const res = await fetch('/api/persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, filename: url.split('/').pop() || null, folder: 'assistant-videos' }),
      });
      if (!res.ok) return url;
      const j = await res.json();
      return typeof j?.url === 'string' ? j.url : url;
    } catch {
      return url;
    }
  }

  const patchStoryboardInMessage = useCallback((
    messageId: string,
    updater: (prev: Storyboard) => Storyboard
  ) => {
    setMessages((prev) => {
      const next = prev.map((m) => {
        if (m.id !== messageId) return m;
        const toolOutput = (m.tool_output || {}) as any;
        const prevStoryboard: Storyboard | null =
          toolOutput?.output?.storyboard || toolOutput?.storyboard || null;
        if (!prevStoryboard) return m;
        const updated = updater(prevStoryboard);
        const nextToolOutput = {
          ...(toolOutput || {}),
          output: { ...(toolOutput?.output || {}), storyboard: updated },
        };
        return { ...m, tool_output: nextToolOutput, content: JSON.stringify({ storyboard_id: updated.id }, null, 2) };
      });
      void persistMessages(next);
      return next;
    });
  }, [persistMessages]);

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
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading || !authToken) return;

    // Prepare message content with file URLs
    let messageContent = input.trim();
    if (uploadedFiles.length > 0) {
      const fileUrls = uploadedFiles.map(f => f.url).join('\n');
      messageContent = messageContent 
        ? `${messageContent}\n\nAttached files:\n${fileUrls}` 
        : `Attached files:\n${fileUrls}`;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageContent,
      timestamp: new Date().toISOString(),
      files: uploadedFiles.map(f => f.url),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setUploadedFiles([]);
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
          files: userMessage.files || [],
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
                const toolCall = event.data as { tool: string; input: unknown; message_id?: string };
                // For image generation, render the image card immediately (placeholder),
                // then overwrite it when tool_result arrives with the same message_id.
                if (toolCall.tool === 'image_generation') {
                  setMessages(prev => [...prev, {
                    id: typeof toolCall.message_id === 'string' ? toolCall.message_id : crypto.randomUUID(),
                    role: 'tool_result',
                    content: '',
                    timestamp: new Date().toISOString(),
                    tool_name: toolCall.tool,
                    tool_input: toolCall.input as Record<string, unknown>,
                    tool_output: { success: true, output: { status: 'starting' } } as any,
                  }]);
                  break;
                }
                setMessages(prev => [...prev, {
                  id: typeof toolCall.message_id === 'string' ? toolCall.message_id : crypto.randomUUID(),
                  role: 'tool_call',
                  content: `Executing ${toolCall.tool}...`,
                  timestamp: new Date().toISOString(),
                  tool_name: toolCall.tool,
                  tool_input: toolCall.input as Record<string, unknown>,
                }]);
                break;
              
              case 'tool_result':
                const toolResult = event.data as { tool: string; result: { success: boolean; output?: unknown; error?: string; message_id?: string } };
                setMessages(prev => {
                  const msgId = typeof toolResult.result?.message_id === 'string' ? toolResult.result.message_id : crypto.randomUUID();
                  const content = toolResult.result.success 
                    ? (typeof toolResult.result.output === 'string' 
                        ? toolResult.result.output 
                        : JSON.stringify(toolResult.result.output, null, 2))
                    : `Error: ${toolResult.result.error}`;
                  
                  const nextMsg: Message = {
                    id: msgId,
                    role: 'tool_result',
                    content,
                    timestamp: new Date().toISOString(),
                    tool_name: toolResult.tool,
                    tool_output: toolResult.result as Record<string, unknown>,
                  };

                  const idx = prev.findIndex((m) => m.id === msgId);
                  if (idx === -1) return [...prev, nextMsg];
                  const next = [...prev];
                  next[idx] = { ...prev[idx], ...nextMsg };
                  return next;
                });
                break;
              
              case 'video_generation_update': {
                const payload = event.data as { message_id: string; storyboard: Storyboard };
                if (!payload?.message_id || !payload?.storyboard) break;
                patchStoryboardInMessage(payload.message_id, () => payload.storyboard);
                break;
              }
              
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
        const msg = String(e?.message || '');
        const transient =
          msg.includes('Failed to fetch') ||
          msg.includes('NetworkError') ||
          msg.includes('ERR_NETWORK_CHANGED') ||
          msg.includes('ERR_HTTP2_PING_FAILED');

        if (transient) {
          // Roll back the optimistic user message so retry doesn't duplicate it,
          // and restore the input for a seamless retry.
          setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
          setInput(userMessage.content);
          setError('Network connection interrupted (HTTP/2). Please try sending again.');
        } else {
          setError(e.message || 'Failed to send message');
        }
      }
    } finally {
      setIsLoading(false);
      setIsThinking(false);
      abortControllerRef.current = null;
    }
  }, [input, uploadedFiles, isLoading, authToken, activeConversationId, patchStoryboardInMessage]);

  function Markdown({ content }: { content: string }) {
    // Custom link renderer to intercept storyboard links
    const components = {
      a: ({ href, children, ...props }: any) => {
        // Check if this is a storyboard link
        if (href && href.startsWith('#storyboard:')) {
          const storyboardId = href.replace('#storyboard:', '');
          return (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                // Load and open the storyboard in modal
                loadStoryboardById(storyboardId);
              }}
              className={styles.storyboardLink}
              {...props}
            >
              {children}
            </a>
          );
        }
        // Regular link
        return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
      }
    };

    return (
      <div className={styles.markdown}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
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

  // Individual scene card component - Production Ready with Enhanced Fields
  function SceneVideoPreview({
    messageId,
    sceneNumber,
    predictionId,
    initialUrl,
    initialStatus,
    errorMessage,
  }: {
    messageId: string;
    sceneNumber: number;
    predictionId?: string;
    initialUrl?: string;
    initialStatus?: string;
    errorMessage?: string;
  }) {
    const [url, setUrl] = useState<string | null>(initialUrl || null);
    const [status, setStatus] = useState<string>(initialUrl ? 'succeeded' : (initialStatus || 'pending'));
    const [pollError, setPollError] = useState<string | null>(errorMessage || null);

    useEffect(() => {
      if (url || !predictionId) return;
      let mounted = true;
      let timeout: ReturnType<typeof setTimeout>;

      async function poll() {
        try {
          const pid = predictionId;
          if (!pid) return;
          const res = await fetch(`/api/replicate/status?id=${encodeURIComponent(pid)}`, { cache: 'no-store' });
          if (!res.ok || !mounted) return;
          const json = (await res.json()) as ReplicateStatusResponse;
          if (!mounted) return;
          setStatus(json.status || 'processing');
          if (json.outputUrl) {
            const persisted = await persistUrlIfPossible(String(json.outputUrl));
            const proxied = `/api/proxy?type=video&url=${encodeURIComponent(persisted)}`;
            setUrl(proxied);
            setPollError(null);
            patchStoryboardInMessage(messageId, (prevStoryboard) => {
              const nextScenes = prevStoryboard.scenes.map((s): StoryboardScene => {
                if (s.scene_number !== sceneNumber) return s;
                return {
                  ...s,
                  video_status: 'succeeded',
                  video_raw_url: persisted,
                  video_url: proxied,
                };
              });
              return { ...prevStoryboard, scenes: nextScenes };
            });
            return;
          }
          if (json.error) setPollError(json.error);
          if (!['succeeded', 'failed', 'canceled'].includes(String(json.status || '').toLowerCase())) {
            timeout = setTimeout(poll, 2500);
          } else if (String(json.status || '').toLowerCase() !== 'succeeded') {
            setPollError(json.error || 'Video generation failed');
            patchStoryboardInMessage(messageId, (prevStoryboard) => {
              const nextScenes = prevStoryboard.scenes.map((s): StoryboardScene => {
                if (s.scene_number !== sceneNumber) return s;
                return {
                  ...s,
                  video_status: 'failed',
                  video_error: json.error || 'Video generation failed',
                };
              });
              return { ...prevStoryboard, scenes: nextScenes };
            });
          }
        } catch (e: any) {
          if (!mounted) return;
          setPollError(e?.message || 'Failed to fetch video status');
          timeout = setTimeout(poll, 3500);
        }
      }

      poll();
      return () => { mounted = false; clearTimeout(timeout); };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [predictionId, url]);

    const isGenerating = !url && Boolean(predictionId) && !['failed', 'canceled'].includes(status);
    const isFailed = status === 'failed' || status === 'canceled';

    return (
      <div className={styles.toolCard}>
        <div className={styles.toolHeader}>
          <Film size={16} />
          <span>Video (scene {sceneNumber})</span>
          <span className={`${styles.pill} ${String(status).toLowerCase() === 'succeeded' ? styles.pillOk : ''} ${isFailed ? styles.pillBad : ''}`}>
            {String(status)}
          </span>
          {isGenerating && <Loader2 size={14} className={styles.spinner} />}
        </div>
        <div className={styles.toolBody}>
          {url ? (
            <video controls preload="metadata" playsInline style={{ width: '100%', borderRadius: 14 }}>
              <source src={url} type="video/mp4" />
            </video>
          ) : (
            <div style={{ border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 14, padding: 14, color: 'rgba(231,233,238,0.65)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={16} className={styles.spinner} />
                <span>{predictionId ? 'Generating video…' : 'Not started'}</span>
              </div>
              {pollError && <div style={{ marginTop: 8, color: 'rgba(239,68,68,0.95)', fontSize: 12, whiteSpace: 'pre-wrap' }}>{pollError}</div>}
            </div>
          )}
        </div>
      </div>
    );
  }

  function SceneCard({
    scene,
    aspectRatio,
    messageId,
  }: {
    scene: StoryboardScene;
    aspectRatio?: string;
    messageId: string;
  }) {
    const sceneTypeLabel = (type?: string) => {
      switch (type) {
        case 'talking_head': return '🎤 Talking Head';
        case 'product_showcase': return '📦 Product Shot';
        case 'b_roll': return '🎬 B-Roll';
        case 'demonstration': return '👆 Demo';
        case 'text_card': return '📝 Text Card';
        case 'transition': return '🔄 Transition';
        default: return null;
      }
    };
    
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
              {scene.scene_type && (
                <span className={styles.sceneTag}>
                  {sceneTypeLabel(scene.scene_type)}
                </span>
              )}
              {scene.uses_avatar === true && (
                <span className={styles.sceneTag} title="Uses avatar reference">
                  🎭 Avatar
                </span>
              )}
              {scene.uses_avatar === false && (
                <span className={styles.sceneTag} title="No avatar">
                  📷 No Avatar
                </span>
              )}
              {scene.transition_type && (
                <span className={styles.sceneTag}>
                  {scene.transition_type === 'smooth' ? '↔️' : '✂️'} {scene.transition_type}
                </span>
              )}
              {scene.camera_movement && scene.camera_movement !== 'Static' && (
                <span className={styles.sceneTag}>📹 {scene.camera_movement}</span>
              )}
            </div>
          </div>
        </div>

        {/* Scene Description */}
        <div className={styles.sceneDescription}>
          {scene.description}
        </div>

        {/* Needs user details */}
        {scene.needs_user_details && scene.user_question && (
          <div className={styles.textOverlayBox}>
            <div className={styles.textOverlayLabel}>
              <AlertCircle size={12} />
              <span>Needs your input</span>
            </div>
            <p className={styles.textOverlayText}>{scene.user_question}</p>
          </div>
        )}

        {/* Avatar Details (if uses avatar) */}
        {scene.uses_avatar && (scene.avatar_action || scene.avatar_expression) && (
          <div className={styles.avatarDetailsBox}>
            <div className={styles.avatarDetailsLabel}>
              <span>🎭 Avatar Direction</span>
            </div>
            <div className={styles.avatarDetailsContent}>
              {scene.avatar_action && (
                <div><strong>Action:</strong> {scene.avatar_action}</div>
              )}
              {scene.avatar_expression && (
                <div><strong>Expression:</strong> {scene.avatar_expression}</div>
              )}
              {scene.avatar_position && (
                <div><strong>Position:</strong> {scene.avatar_position}</div>
              )}
            </div>
          </div>
        )}

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

        {/* Video Preview (if started) */}
        {(scene.video_prediction_id || scene.video_url || scene.video_error) && (
          <SceneVideoPreview
            messageId={messageId}
            sceneNumber={scene.scene_number}
            predictionId={scene.video_prediction_id}
            initialUrl={scene.video_url}
            initialStatus={scene.video_status}
            errorMessage={scene.video_error}
          />
        )}

        {/* Voiceover Text - New Enhanced Field */}
        {scene.voiceover_text && (
          <div className={styles.voiceoverBox}>
            <div className={styles.voiceoverLabel}>
              <span>🎙️ Voiceover Script</span>
            </div>
            <p className={styles.voiceoverText}>&quot;{scene.voiceover_text}&quot;</p>
          </div>
        )}

        {/* Audio Details - New Enhanced Section */}
        {(scene.audio_mood || scene.sound_effects?.length || scene.audio_notes) && (
          <div className={styles.audioNotesBox}>
            <div className={styles.audioNotesLabel}>
              <Volume2 size={12} />
              <span>Audio</span>
            </div>
            <div className={styles.audioDetailsContent}>
              {scene.audio_mood && (
                <div className={styles.audioDetailItem}>
                  <strong>Music Mood:</strong> {scene.audio_mood}
                </div>
              )}
              {scene.sound_effects && scene.sound_effects.length > 0 && (
                <div className={styles.audioDetailItem}>
                  <strong>Sound Effects:</strong> {scene.sound_effects.join(', ')}
                </div>
              )}
              {scene.audio_notes && (
                <div className={styles.audioDetailItem}>
                  <strong>Notes:</strong> {scene.audio_notes}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Text Overlay - for end cards */}
        {scene.text_overlay && (
          <div className={styles.textOverlayBox}>
            <div className={styles.textOverlayLabel}>
              <FileText size={12} />
              <span>Text Overlay</span>
            </div>
            <p className={styles.textOverlayText}>{scene.text_overlay}</p>
          </div>
        )}
      </div>
    );
  }

  // Full storyboard card component - Production Ready
  const openStoryboardModal = (storyboard: Storyboard) => {
    setOpenStoryboard(storyboard);
    setOpenStoryboardId(storyboard.id);
    setIsGeneratingVideos(false);
    setVideoGenerationError(null);
    
    // Start polling if storyboard has generating frames or videos
    const hasGeneratingItems = storyboard.scenes.some(s => 
      s.first_frame_status === 'generating' || 
      s.last_frame_status === 'generating' ||
      (s.first_frame_prediction_id && !s.first_frame_url) ||
      (s.last_frame_prediction_id && !s.last_frame_url) ||
      (s.video_prediction_id && !s.video_url && s.video_status !== 'failed')
    );
    
    if (hasGeneratingItems) {
      startStoryboardPolling(storyboard.id);
    }
  };

  const closeStoryboardModal = () => {
    setOpenStoryboard(null);
    setOpenStoryboardId(null);
    stopStoryboardPolling();
  };

  const startStoryboardPolling = (storyboardId: string) => {
    // Clear any existing polling
    stopStoryboardPolling();
    
    // Poll every 3 seconds
    storyboardPollIntervalRef.current = setInterval(async () => {
      if (!authToken) return;
      
      try {
        const res = await fetch(`/api/storyboard?id=${storyboardId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.storyboard) {
            // Check for video predictions that need polling
            let updatedStoryboard = data.storyboard;
            let hasUpdates = false;
            
            for (let i = 0; i < updatedStoryboard.scenes.length; i++) {
              const scene = updatedStoryboard.scenes[i];
              
              // If scene has a video_prediction_id but no video_url, poll for status
              if (scene.video_prediction_id && !scene.video_url && scene.video_status !== 'failed') {
                try {
                  const statusRes = await fetch(`/api/replicate/status?id=${encodeURIComponent(scene.video_prediction_id)}`, { cache: 'no-store' });
                  if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    
                    if (statusData.outputUrl) {
                      // Video is ready!
                      const videoUrl = `/api/proxy?type=video&url=${encodeURIComponent(statusData.outputUrl)}`;
                      updatedStoryboard = {
                        ...updatedStoryboard,
                        scenes: updatedStoryboard.scenes.map((s: any, idx: number) => 
                          idx === i ? { ...s, video_url: videoUrl, video_status: 'succeeded', video_raw_url: statusData.outputUrl } : s
                        )
                      };
                      hasUpdates = true;
                      
                      // Update database
                      await fetch('/api/storyboard', {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${authToken}`,
                        },
                        body: JSON.stringify({
                          id: storyboardId,
                          scenes: updatedStoryboard.scenes,
                        }),
                      });
                    } else if (statusData.error || statusData.status === 'failed') {
                      updatedStoryboard = {
                        ...updatedStoryboard,
                        scenes: updatedStoryboard.scenes.map((s: any, idx: number) => 
                          idx === i ? { ...s, video_status: 'failed', video_error: statusData.error || 'Video generation failed' } : s
                        )
                      };
                      hasUpdates = true;
                    }
                  }
                } catch (err) {
                  console.error('Error polling video status:', err);
                }
              }
            }
            
            setOpenStoryboard(updatedStoryboard);
            
            // Stop polling if all frames and videos are ready or failed
            const hasGeneratingItems = updatedStoryboard.scenes.some((s: any) => 
              s.first_frame_status === 'generating' || 
              s.last_frame_status === 'generating' ||
              (s.first_frame_prediction_id && !s.first_frame_url) ||
              (s.last_frame_prediction_id && !s.last_frame_url) ||
              (s.video_prediction_id && !s.video_url && s.video_status !== 'failed')
            );
            
            if (!hasGeneratingItems) {
              stopStoryboardPolling();
            }
          }
        }
      } catch (error) {
        console.error('Error polling storyboard:', error);
      }
    }, 3000);
  };

  const stopStoryboardPolling = () => {
    if (storyboardPollIntervalRef.current) {
      clearInterval(storyboardPollIntervalRef.current);
      storyboardPollIntervalRef.current = null;
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopStoryboardPolling();
    };
  }, []);

  const loadStoryboardById = async (storyboardId: string) => {
    if (!authToken) return;
    
    try {
      const res = await fetch(`/api/storyboard?id=${storyboardId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.storyboard) {
          openStoryboardModal(data.storyboard);
        } else {
          console.error('Storyboard not found');
        }
      } else {
        console.error('Failed to load storyboard');
      }
    } catch (error) {
      console.error('Error loading storyboard:', error);
    }
  };

  const handleGenerateVideos = async () => {
    if (!openStoryboard || !authToken || isGeneratingVideos) return;

    setIsGeneratingVideos(true);
    setVideoGenerationError(null);

    try {
      const res = await fetch('/api/storyboard/generate-videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          storyboard_id: openStoryboard.id,
        }),
      });

      if (!res.ok) {
        // Try to get detailed error message from server
        let errorMessage = 'Failed to start video generation';
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `${errorMessage} (${res.status} ${res.statusText})`;
        }
        throw new Error(errorMessage);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const event = JSON.parse(line.slice(6));

            switch (event.type) {
              case 'storyboard_update':
                if (event.storyboard) {
                  setOpenStoryboard(event.storyboard);
                }
                break;

              case 'complete':
                if (event.storyboard) {
                  setOpenStoryboard(event.storyboard);
                }
                setIsGeneratingVideos(false);
                // Start polling to check video status
                if (openStoryboard.id) {
                  startStoryboardPolling(openStoryboard.id);
                }
                break;

              case 'error':
                setVideoGenerationError(event.message || 'Failed to generate videos');
                setIsGeneratingVideos(false);
                break;
            }
          } catch (e) {
            console.error('Failed to parse event:', e);
          }
        }
      }
    } catch (error: any) {
      console.error('Error generating videos:', error);
      setVideoGenerationError(error.message || 'Failed to generate videos');
      setIsGeneratingVideos(false);
    }
  };

  function StoryboardCard({ storyboard, messageId }: { storyboard: Storyboard; messageId: string }) {
    const totalDuration = storyboard.total_duration_seconds || 
      storyboard.scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    
    const generatingCount = storyboard.scenes.filter(s => 
      s.first_frame_status === 'generating' || s.last_frame_status === 'generating'
    ).length;

    return (
      <div className={styles.storyboardCard}>
        {/* View Full Storyboard Button */}
        <button 
          className={styles.viewStoryboardBtn}
          onClick={() => openStoryboardModal(storyboard)}
          type="button"
        >
          <Film size={16} />
          View Full Storyboard
          <ChevronRight size={16} />
        </button>
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
              messageId={messageId}
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
          case 'video_analysis': return <Film size={16} />;
          case 'motion_control': return <Play size={16} />;
          default: return <ImageIcon size={16} />;
        }
      };
      const getToolLabel = () => {
        switch (message.tool_name) {
          case 'script_creation': return 'Generating script…';
          case 'storyboard_creation': return 'Creating storyboard…';
          case 'video_analysis': return 'Analyzing video…';
          case 'motion_control': return 'Creating motion control video…';
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
        (message.tool_name === 'storyboard_creation' || message.tool_name === 'video_generation')
          ? (message.tool_output as any)?.output?.storyboard ||
            (message.tool_output as any)?.storyboard ||
            null
          : null;

      return (
        <div key={message.id} className={styles.row}>
          <div className={`${styles.avatar} ${styles.avatarAssistant}`}>
            {success ? <Check size={16} /> : <AlertCircle size={16} />}
          </div>
          <div className={`${styles.bubble} ${(message.tool_name === 'storyboard_creation' || message.tool_name === 'video_generation') ? styles.bubbleWide : ''}`}>
            {message.tool_name === 'image_generation' ? (
              (() => {
                // Hide scene frames from chat - they're shown in the storyboard modal
                const toolInput = (message.tool_input || message.tool_output) as any;
                const purpose = toolInput?.purpose || '';
                const isSceneFrame = purpose === 'scene_frame' || purpose === 'scene_first_frame' || purpose === 'scene_last_frame';
                
                if (isSceneFrame) {
                  // Don't show scene frames in chat
                  return null;
                }
                
                // Show avatars and other images normally
                return (
                  <ImagePredictionCard
                    messageId={message.id}
                    predictionId={predictionId ? String(predictionId) : ''}
                    initialStatus={initialStatus}
                    initialUrl={persistedUrl}
                  />
                );
              })()
            ) : message.tool_name === 'script_creation' ? (
              <ScriptCard content={message.content} />
            ) : message.tool_name === 'video_analysis' ? (
              <div className={styles.toolCard}>
                <div className={styles.toolHeader}>
                  <Film size={16} />
                  <span>Video Analysis</span>
                  <span className={`${styles.pill} ${success ? styles.pillGood : styles.pillBad}`}>
                    {success ? 'complete' : 'failed'}
                  </span>
                </div>
                <div className={styles.toolBody}>
                  {success && message.tool_output ? (
                    <>
                      <div style={{ marginBottom: '12px', color: 'rgba(231,233,238,0.8)' }}>
                        {(message.tool_output as any).output?.summary || 'Video analyzed successfully'}
                      </div>
                      <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', gap: '8px', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                          <span style={{ color: 'rgba(231,233,238,0.6)' }}>Duration:</span>
                          <span>{(message.tool_output as any).output?.duration_seconds || 0}s</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                          <span style={{ color: 'rgba(231,233,238,0.6)' }}>Motion Control Eligible:</span>
                          <span style={{ color: (message.tool_output as any).output?.eligibility?.recommended_for_motion_control ? '#22c55e' : '#ef4444' }}>
                            {(message.tool_output as any).output?.eligibility?.recommended_for_motion_control ? 'Yes' : 'No'}
                          </span>
                        </div>
                        {(message.tool_output as any).output?.eligibility?.reasoning && (
                          <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '12px', color: 'rgba(231,233,238,0.65)' }}>
                            {(message.tool_output as any).output.eligibility.reasoning}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <Markdown content={message.content} />
                  )}
                </div>
              </div>
            ) : message.tool_name === 'motion_control' ? (
              <div className={styles.toolCard}>
                <div className={styles.toolHeader}>
                  <Play size={16} />
                  <span>Motion Control Video</span>
                  <span className={`${styles.pill} ${success ? styles.pillGood : styles.pillBad}`}>
                    {success ? 'generating' : 'failed'}
                  </span>
                </div>
                <div className={styles.toolBody}>
                  {success && (message.tool_output as any)?.output?.id ? (
                    <div style={{ color: 'rgba(231,233,238,0.8)' }}>
                      Video generation started. Prediction ID: {(message.tool_output as any).output.id}
                      <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(231,233,238,0.6)' }}>
                        Check status via the API or wait for the result.
                      </div>
                    </div>
                  ) : (
                    <Markdown content={message.content} />
                  )}
                </div>
              </div>
            ) : (message.tool_name === 'storyboard_creation' || message.tool_name === 'video_generation') && storyboardData ? (
              <div className={styles.toolCard}>
                <div className={styles.toolHeader}>
                  <Film size={16} />
                  <span>Storyboard Created</span>
                  <span className={`${styles.pill} ${styles.pillGood}`}>
                    {(storyboardData as Storyboard).scenes.length} scenes
                  </span>
                </div>
                <div className={styles.toolBody}>
                  <button 
                    className={styles.viewStoryboardBtn}
                    onClick={() => openStoryboardModal(storyboardData as Storyboard)}
                    type="button"
                  >
                    <Film size={16} />
                    View Full Storyboard
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
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
      <div className={styles.authGate}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <span className={styles.iconChip}><MessageSquare size={16} /></span>
            <span>AI Assistant</span>
          </div>
          <p className={styles.authText}>
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
          {sortedConversations.length === 0 ? (
            <div style={{ padding: 10, color: 'rgba(231,233,238,0.6)', fontSize: 13 }}>
              No conversations yet.
            </div>
          ) : (
            displayedConversations.map((conv) => {
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
          {remainingConversations > 0 && (
            <button
              type="button"
              className={styles.seeMoreBtn}
              onClick={() => setVisibleConversations((prev) => Math.min(prev + 10, sortedConversations.length))}
            >
              See more ({remainingConversations})
            </button>
          )}
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.topbarTitle}>
            <span className={styles.iconChip}><MessageSquare size={16} /></span>
            <div>
              <div className={styles.topbarTitleText}>Assistant</div>
              <div className={styles.topbarSubtext}>
                {activeConversationId ? 'Conversation active' : 'Start a new conversation'}
              </div>
            </div>
          </div>
          <div className={styles.topbarActions}>
            <div className={styles.topbarHint}>
              {isLoading ? 'Generating…' : 'Enter to send · Shift+Enter for newline'}
            </div>
            <button
              className={styles.topbarActionBtn}
              type="button"
              onClick={startNewConversation}
            >
              <Plus size={14} />
              New chat
            </button>
            {userEmail && <div className={styles.userChip}>{userEmail}</div>}
          </div>
        </div>

        <div className={styles.scroll} ref={scrollContainerRef}>
          <div className={styles.content}>
            {/* Scroll to bottom button - appears when user scrolls up */}
            {showScrollButton && (
              <button
                className={styles.scrollToBottomBtn}
                onClick={() => scrollToBottom()}
                type="button"
                title="Scroll to bottom"
              >
                <ChevronRight size={16} style={{ transform: 'rotate(90deg)' }} />
                <span>New messages</span>
              </button>
            )}
            
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
                      <div className={styles.errorText}>{error}</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className={styles.composerWrap}>
          {uploadedFiles.length > 0 && (
            <div className={styles.uploadTray}>
              <div className={styles.uploadLabel}>Attached files</div>
              <div className={styles.uploadChips}>
                {uploadedFiles.map((file) => (
                  <div key={file.url} className={styles.uploadChip}>
                    {file.type.startsWith('video/') ? <Film size={14} /> : <Paperclip size={14} />}
                    <span className={styles.uploadChipName}>{file.name}</span>
                    <button
                      onClick={() => removeUploadedFile(file.url)}
                      className={styles.uploadRemove}
                      type="button"
                      aria-label={`Remove ${file.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={styles.composer}>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*"
              multiple
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button 
              className={styles.iconBtn} 
              type="button" 
              title="Attach files (videos, images)"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isLoading}
            >
              {isUploading ? <Loader2 size={18} className={styles.spinner} /> : <Paperclip size={18} />}
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
              disabled={((!input.trim() && uploadedFiles.length === 0) || isLoading)}
              type="button"
              title="Send"
            >
              {isLoading ? <Loader2 size={18} className={styles.spinner} /> : <Send size={18} />}
            </button>
          </div>
          <div className={styles.statusLine}>
            {isUploading ? 'Uploading files…' : isThinking ? 'Reflexion running…' : isLoading ? 'Generating response…' : ' '}
          </div>
        </div>
      </main>

      {/* Storyboard Modal Overlay */}
      {openStoryboard && (
        <div className={styles.storyboardModalOverlay} onClick={closeStoryboardModal}>
          <div className={styles.storyboardModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.storyboardModalHeader}>
              <div className={styles.storyboardModalTitle}>
                <Film size={20} />
                <h2>{openStoryboard.title}</h2>
              </div>
              <button 
                className={styles.storyboardModalClose}
                onClick={closeStoryboardModal}
                type="button"
              >
                <ArrowLeft size={20} />
                Back to Chat
              </button>
            </div>
            <div className={styles.storyboardModalBody}>
              {/* Storyboard Info */}
              <div className={styles.storyboardModalInfo}>
                <div className={styles.storyboardModalMeta}>
                  {openStoryboard.brand_name && (
                    <div className={styles.metaChip}>
                      <span>Brand:</span> {openStoryboard.brand_name}
                    </div>
                  )}
                  {openStoryboard.product && (
                    <div className={styles.metaChip}>
                      <span>Product:</span> {openStoryboard.product}
                    </div>
                  )}
                  {openStoryboard.platform && (
                    <div className={styles.metaChip}>
                      <span>Platform:</span> {openStoryboard.platform}
                    </div>
                  )}
                  {openStoryboard.aspect_ratio && (
                    <div className={styles.metaChip}>
                      <span>Aspect Ratio:</span> {openStoryboard.aspect_ratio}
                    </div>
                  )}
                  <div className={styles.metaChip}>
                    <Clock size={14} />
                    {openStoryboard.total_duration_seconds || 
                      openStoryboard.scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0)}s
                  </div>
                </div>
              </div>

              {/* Avatar Reference */}
              {openStoryboard.avatar_image_url && (
                <div className={styles.storyboardModalAvatar}>
                  <h3>Avatar Reference</h3>
                  <div className={styles.avatarPreview}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={openStoryboard.avatar_image_url} alt="Avatar" />
                    {openStoryboard.avatar_description && (
                      <p>{openStoryboard.avatar_description}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Video Generation Control */}
              {(!openStoryboard.scenes.some(s => s.video_prediction_id || s.video_url || s.video_status === 'generating') || isGeneratingVideos || videoGenerationError) && (
                <div className={styles.videoGenerationControl}>
                  {!openStoryboard.scenes.some(s => s.video_prediction_id || s.video_url || s.video_status === 'generating') && (
                    <button
                      className={styles.generateVideosBtn}
                      onClick={handleGenerateVideos}
                      disabled={isGeneratingVideos}
                      type="button"
                    >
                      {isGeneratingVideos ? (
                        <>
                          <Loader2 size={18} className={styles.spinner} />
                          Generating Videos...
                        </>
                      ) : (
                        <>
                          <Play size={18} />
                          Proceed with Video Generation
                        </>
                      )}
                    </button>
                  )}
                  {videoGenerationError && (
                    <div className={styles.videoGenerationError}>
                      <AlertCircle size={16} />
                      {videoGenerationError}
                    </div>
                  )}
                  {isGeneratingVideos && (
                    <div className={styles.videoGenerationStatus}>
                      <Loader2 size={16} className={styles.spinner} />
                      <span>Generating videos for {openStoryboard.scenes.length} scenes. This may take a few minutes...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Scenes Grid */}
              <div className={styles.storyboardModalScenes}>
                <h3>{openStoryboard.scenes.length} Scenes</h3>
                <div className={styles.scenesGrid}>
                  {openStoryboard.scenes.map((scene) => (
                    <div key={scene.scene_number} className={styles.sceneModalCard}>
                      <div className={styles.sceneModalHeader}>
                        <div className={styles.sceneNumber}>#{scene.scene_number}</div>
                        <div className={styles.sceneName}>{scene.scene_name}</div>
                        <div className={styles.sceneDuration}>
                          <Clock size={12} />
                          {scene.duration_seconds}s
                        </div>
                      </div>
                      
                      {/* Frames Side-by-Side */}
                      <div className={styles.framesRow}>
                        {/* First Frame */}
                        <div className={styles.frameSection}>
                          <div className={styles.frameLabel}>First Frame</div>
                          {scene.first_frame_url ? (
                            <div className={styles.framePreview}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={scene.first_frame_url} alt={`Scene ${scene.scene_number} first frame`} />
                            </div>
                          ) : scene.first_frame_status === 'generating' ? (
                            <div className={styles.frameGenerating}>
                              <Loader2 size={16} className={styles.spinner} />
                              Generating...
                            </div>
                          ) : (
                            <div className={styles.framePending}>
                              <ImageIcon size={16} />
                              Pending
                            </div>
                          )}
                        </div>

                        {/* Last Frame */}
                        <div className={styles.frameSection}>
                          <div className={styles.frameLabel}>Last Frame</div>
                          {scene.last_frame_url ? (
                            <div className={styles.framePreview}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={scene.last_frame_url} alt={`Scene ${scene.scene_number} last frame`} />
                            </div>
                          ) : scene.last_frame_status === 'generating' ? (
                            <div className={styles.frameGenerating}>
                              <Loader2 size={16} className={styles.spinner} />
                              Generating...
                            </div>
                          ) : (
                            <div className={styles.framePending}>
                              <ImageIcon size={16} />
                              Pending
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Video Section */}
                      {(scene.video_prediction_id || scene.video_url || scene.video_status === 'generating' || scene.video_status === 'pending') && (
                        <div className={styles.videoSection}>
                          <div className={styles.frameLabel}>
                            {scene.video_url ? 'Generated Video' : 'Video Generation'}
                          </div>
                          {scene.video_url ? (
                            <video 
                              src={scene.video_url} 
                              controls 
                              className={styles.videoPreview}
                            />
                          ) : scene.video_status === 'generating' ? (
                            <div className={styles.videoGenerating}>
                              <Loader2 size={24} className={styles.spinner} />
                              <span>Generating video...</span>
                              <p className={styles.videoGeneratingHint}>
                                This may take 2-3 minutes. The video will appear here automatically when ready.
                              </p>
                            </div>
                          ) : scene.video_status === 'pending' ? (
                            <div className={styles.videoPending}>
                              <Clock size={24} />
                              <span>Waiting to start...</span>
                            </div>
                          ) : scene.video_prediction_id && !scene.video_url ? (
                            <div className={styles.videoGenerating}>
                              <Loader2 size={24} className={styles.spinner} />
                              <span>Processing video...</span>
                              <p className={styles.videoGeneratingHint}>
                                Checking status...
                              </p>
                            </div>
                          ) : null}
                        </div>
                      )}
                      
                      {/* Video Error */}
                      {scene.video_error && (
                        <div className={styles.videoError}>
                          <AlertCircle size={16} />
                          <span>{scene.video_error}</span>
                        </div>
                      )}

                      {/* Scene Description */}
                      {scene.description && (
                        <div className={styles.sceneDescription}>
                          <strong>Description:</strong> {scene.description}
                        </div>
                      )}

                      {/* Voiceover */}
                      {scene.voiceover_text && (
                        <div className={styles.sceneVoiceover}>
                          <Volume2 size={14} />
                          <span>{scene.voiceover_text}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
