'use client';

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
  Clock,
  Volume2,
  Menu,
  X,
  User,
  Zap,
  Star,
} from 'lucide-react';
import type { Message, Conversation, Storyboard, StoryboardScene } from '../../types/assistant';
import styles from './chat.module.css';

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

// Extract topic from first user message for quick title
const extractQuickTitle = (messages: Message[]): string => {
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (!firstUserMessage) return 'New Chat';
  
  const content = firstUserMessage.content.toLowerCase();
  
  // Common patterns for quick title extraction
  if (content.includes('storyboard')) return 'Video Storyboard';
  if (content.includes('script')) return 'Ad Script';
  if (content.includes('image') || content.includes('photo')) return 'Image Generation';
  if (content.includes('ugc')) return 'UGC Content';
  if (content.includes('tiktok')) return 'TikTok Ad';
  if (content.includes('instagram')) return 'Instagram Ad';
  if (content.includes('facebook')) return 'Facebook Ad';
  if (content.includes('skincare')) return 'Skincare Campaign';
  if (content.includes('product')) return 'Product Ad';
  if (content.includes('brand')) return 'Brand Strategy';
  
  // Extract first few meaningful words
  const words = firstUserMessage.content.split(' ')
    .filter(w => w.length > 3)
    .slice(0, 3);
  
  return words.length > 0 ? words.join(' ') : 'New Chat';
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
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Stable scroll to bottom - prevents jumping
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current && chatContainerRef.current) {
      const container = chatContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      
      if (isNearBottom || messages.length === 0) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }, [messages.length]);

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

  // Load conversations with better error handling
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

  // Stable scroll effect
  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponse, scrollToBottom]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setInput(textarea.value);
    
    // Auto-resize
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120); // Max 120px
    textarea.style.height = newHeight + 'px';
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        sendMessage();
      }
    }
  };

  // Start new conversation with better state management
  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setCurrentReflexion('');
    setCurrentResponse('');
    setError(null);
    setInput('');
    setSidebarOpen(false); // Auto-close sidebar on mobile
  }, []);

  // Load conversation with smooth transition
  const loadConversation = async (conv: Conversation) => {
    try {
      setActiveConversationId(conv.id);
      setMessages(conv.messages || []);
      setCurrentReflexion('');
      setCurrentResponse('');
      setError(null);
      setSidebarOpen(false); // Auto-close sidebar on mobile
    } catch (e) {
      console.error('Failed to load conversation:', e);
      setError('Failed to load conversation');
    }
  };

  // Delete conversation with confirmation
  const deleteConversation = async (id: string) => {
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    
    try {
      const res = await fetch('/api/assistant/conversations', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ conversation_id: id })
      });
      
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConversationId === id) {
          startNewConversation();
        }
      }
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    }
  };

  // Tool result components
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

      const poll = async () => {
        if (!mounted || !predictionId || isTerminal(status)) return;

        try {
          const res = await fetch(`/api/replicate/status?prediction_id=${predictionId}`);
          if (!res.ok || !mounted) return;

          const data = await res.json() as ReplicateStatusResponse;
          if (!mounted) return;

          setStatus(data.status);
          if (data.outputUrl) setOutputUrl(data.outputUrl);
          if (data.error) setPollError(data.error);

          if (!isTerminal(data.status)) {
            timeout = setTimeout(poll, 2000);
          }
        } catch (e: any) {
          if (mounted) {
            console.error('Poll error:', e);
            setPollError(e.message || 'Polling failed');
          }
        }
      };

      if (!isTerminal(status)) {
        timeout = setTimeout(poll, 1000);
      }

      return () => {
        mounted = false;
        if (timeout) clearTimeout(timeout);
      };
    }, [predictionId, status]);

    return (
      <div className={styles.toolCard}>
        <div className={styles.toolHeader}>
          <ImageIcon className={styles.toolIcon} />
          <span className={styles.toolTitle}>Image Generation</span>
          <span className={styles.toolStatus}>{status}</span>
        </div>
        
        <div className={styles.toolBody}>
          {outputUrl ? (
            <>
              <img
                src={outputUrl}
                alt="Generated image"
                className={styles.toolImage}
              />
              <div className={styles.toolActions}>
                <button
                  onClick={() => navigator.clipboard.writeText(outputUrl)}
                  className={styles.toolButton}
                >
                  Copy URL
                </button>
                <a
                  href={outputUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.toolButton} ${styles.toolButtonPrimary}`}
                >
                  Open Full Size
                </a>
              </div>
            </>
          ) : pollError ? (
            <div style={{ color: '#ff6b6b' }}>{pollError}</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8e8ea0' }}>
              <Loader2 size={16} className={styles.spinner} />
              <span>Generating your image...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  function ScriptCard({ content }: { content: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    };

    return (
      <div className={styles.toolCard}>
        <div className={styles.toolHeader}>
          <FileText className={styles.toolIcon} />
          <span className={styles.toolTitle}>Script</span>
          <span className={styles.toolStatus}>ready</span>
        </div>
        
        <div className={styles.toolBody}>
          <div style={{ marginBottom: '12px' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
          <div className={styles.toolActions}>
            <button
              onClick={handleCopy}
              className={`${styles.toolButton} ${styles.toolButtonPrimary}`}
            >
              {copied ? <><Check size={16} /> Copied!</> : <><FileText size={16} /> Copy Script</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function StoryboardCard({ storyboard, messageId }: { storyboard: Storyboard; messageId: string }) {
    const totalDuration = storyboard.total_duration_seconds || 
      storyboard.scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    
    const generatingCount = storyboard.scenes.filter(s => 
      s.first_frame_status === 'generating' || s.last_frame_status === 'generating'
    ).length;

    return (
      <div className={styles.toolCard}>
        <div className={styles.toolHeader}>
          <Film className={styles.toolIcon} />
          <span className={styles.toolTitle}>{storyboard.title}</span>
          <span className={styles.toolStatus}>
            {storyboard.status === 'ready' ? 'Complete' : 'In Progress'}
          </span>
        </div>

        <div className={styles.toolBody}>
          <div style={{ fontSize: '14px', color: '#8e8ea0', marginBottom: '16px' }}>
            {storyboard.scenes.length} scenes • {totalDuration}s total
            {generatingCount > 0 && (
              <span style={{ color: '#10a37f' }}>
                {' '}• {generatingCount} generating
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {storyboard.scenes.map((scene, index) => (
              <div 
                key={`${messageId}-scene-${scene.scene_number}`}
                style={{
                  background: '#353535',
                  border: '1px solid #404040',
                  borderRadius: '8px',
                  padding: '12px'
                }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px' }}>Scene {scene.scene_number}</span>
                    {scene.scene_type && (
                      <span style={{ fontSize: '12px', color: '#8e8ea0' }}>
                        {scene.scene_type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <h4 style={{ margin: '0 0 4px 0', fontWeight: '500' }}>{scene.scene_name}</h4>
                  <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#8e8ea0' }}>{scene.description}</p>
                  {scene.duration_seconds && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#8e8ea0' }}>
                      <Clock size={12} />
                      <span>{scene.duration_seconds}s</span>
                    </div>
                  )}
                </div>

                {/* Frames */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#8e8ea0', marginBottom: '4px' }}>First Frame</div>
                    {scene.first_frame_url ? (
                      <img 
                        src={scene.first_frame_url} 
                        alt="First frame"
                        style={{
                          width: '100%',
                          aspectRatio: '9/16',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          border: '1px solid #404040'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        aspectRatio: '9/16',
                        background: '#404040',
                        borderRadius: '4px',
                        border: '1px solid #525252',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <span style={{ fontSize: '11px', color: '#8e8ea0' }}>
                          {scene.first_frame_status === 'generating' && <Loader2 size={12} className={styles.spinner} />}
                          {scene.first_frame_status || 'pending'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <div style={{ fontSize: '11px', color: '#8e8ea0', marginBottom: '4px' }}>Last Frame</div>
                    {scene.last_frame_url ? (
                      <img 
                        src={scene.last_frame_url} 
                        alt="Last frame"
                        style={{
                          width: '100%',
                          aspectRatio: '9/16',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          border: '1px solid #404040'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        aspectRatio: '9/16',
                        background: '#404040',
                        borderRadius: '4px',
                        border: '1px solid #525252',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <span style={{ fontSize: '11px', color: '#8e8ea0' }}>
                          {scene.last_frame_status === 'generating' && <Loader2 size={12} className={styles.spinner} />}
                          {scene.last_frame_status || 'pending'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Voiceover */}
                {scene.voiceover_text && (
                  <div style={{
                    background: '#404040',
                    borderRadius: '6px',
                    padding: '8px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <Volume2 size={12} style={{ color: '#10a37f' }} />
                      <span style={{ fontSize: '11px', fontWeight: '500', color: '#10a37f' }}>Voiceover</span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#ffffff', margin: 0, fontStyle: 'italic' }}>
                      &quot;{scene.voiceover_text}&quot;
                    </p>
                  </div>
                )}

                {/* Video Status */}
                {scene.video_url ? (
                  <div>
                    <video 
                      controls 
                      style={{ width: '100%', borderRadius: '4px', border: '1px solid #404040' }}
                      poster={scene.first_frame_url}
                    >
                      <source src={scene.video_url} type="video/mp4" />
                    </video>
                  </div>
                ) : scene.video_status && scene.video_status !== 'pending' && (
                  <div style={{
                    background: '#404040',
                    borderRadius: '6px',
                    padding: '8px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {scene.video_status === 'generating' && <Loader2 size={12} className={styles.spinner} />}
                    <span>Video: {scene.video_status}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Send message with improved error handling
  const sendMessage = async () => {
    if (!input.trim() || isLoading || !authToken) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    // Optimistic update
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setError(null);
    setIsLoading(true);
    setIsThinking(false);
    setCurrentReflexion('');
    setCurrentResponse('');

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      abortControllerRef.current = new AbortController();
      
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          conversation_id: activeConversationId,
          message: userMessage.content
        }),
        signal: abortControllerRef.current.signal
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream available');

      let conversationId: string | null = null;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += new TextDecoder().decode(value);
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(6)) as StreamEvent;
            
            switch (data.type) {
              case 'conversation_id':
                conversationId = data.data as string;
                if (!activeConversationId) {
                  setActiveConversationId(conversationId);
                }
                break;
              
              case 'reflexion_start':
                setIsThinking(true);
                setCurrentReflexion('');
                break;
              
              case 'reflexion_chunk':
                setCurrentReflexion(prev => prev + (data.data as string));
                break;
              
              case 'reflexion_end':
                setIsThinking(false);
                break;
              
              case 'response_start':
                setCurrentResponse('');
                break;
              
              case 'response_chunk':
                setCurrentResponse(prev => prev + (data.data as string));
                break;
              
              case 'tool_result':
                // Handle tool results
                break;
              
              case 'done':
                setIsLoading(false);
                
                // Generate title for new conversations
                if (!activeConversationId && conversationId && newMessages.length <= 2) {
                  const title = extractQuickTitle(newMessages);
                  // Update conversation title in the background
                  // This could be enhanced to use AI generation later
                }
                break;
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE data:', parseError);
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted');
      } else {
        console.error('Chat error:', error);
        setError(error.message || 'Failed to send message');
      }
    } finally {
      setIsLoading(false);
      setIsThinking(false);
      abortControllerRef.current = null;
    }
  };

  // Render message
  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    const isReflexion = message.role === 'reflexion';
    const isToolCall = message.role === 'tool_call';
    const isToolResult = message.role === 'tool_result';

    if (isReflexion) {
      return (
        <div key={message.id} className={styles.message}>
          <div className={`${styles.messageAvatar} ${styles.avatarAssistant}`}>
            <Brain size={16} />
          </div>
          <div className={styles.messageContent}>
            <div className={styles.messageBubble}>
              <strong>Thinking:</strong> {message.content}
            </div>
          </div>
        </div>
      );
    }

    if (isToolCall) {
      const getToolIcon = () => {
        switch (message.tool_name) {
          case 'image_generation': return <ImageIcon size={16} />;
          case 'script_creation': return <FileText size={16} />;
          case 'storyboard_creation': return <Film size={16} />;
          case 'video_generation': return <Play size={16} />;
          default: return <Zap size={16} />;
        }
      };

      const getToolLabel = () => {
        switch (message.tool_name) {
          case 'image_generation': return 'Generating image…';
          case 'script_creation': return 'Creating script…';
          case 'storyboard_creation': return 'Building storyboard…';
          case 'video_generation': return 'Generating videos…';
          default: return 'Processing…';
        }
      };

      return (
        <div key={message.id} className={styles.message}>
          <div className={`${styles.messageAvatar} ${styles.avatarAssistant}`}>
            <Sparkles size={16} />
          </div>
          <div className={styles.messageContent}>
            <div className={styles.toolCard}>
              <div className={styles.toolHeader}>
                {getToolIcon()}
                <span className={styles.toolTitle}>{getToolLabel()}</span>
                <Loader2 size={16} className={styles.spinner} />
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isToolResult) {
      const success = message.tool_output && (message.tool_output as any).success !== false;
      
      // Extract data for different tool types
      const predictionId = message.tool_name === 'image_generation'
        ? (message.tool_output as any)?.output?.id ||
          (message.tool_output as any)?.id ||
          (message.tool_output as any)?.prediction_id ||
          (message.tool_output as any)?.predictionId ||
          null
        : null;

      const persistedUrl = message.tool_name === 'image_generation'
        ? (message.tool_output as any)?.outputUrl ||
          (message.tool_output as any)?.output_url ||
          (message.tool_output as any)?.output?.outputUrl ||
          (typeof message.content === 'string' && message.content.startsWith('http') ? message.content : null)
        : null;

      const initialStatus = message.tool_name === 'image_generation'
        ? (message.tool_output as any)?.output?.status || (message.tool_output as any)?.status
        : undefined;

      const storyboardData = (message.tool_name === 'storyboard_creation' || message.tool_name === 'video_generation')
        ? (message.tool_output as any)?.output?.storyboard ||
          (message.tool_output as any)?.storyboard ||
          null
        : null;

      return (
        <div key={message.id} className={styles.message}>
          <div className={`${styles.messageAvatar} ${styles.avatarAssistant}`}>
            {success ? <Check size={16} /> : <AlertCircle size={16} />}
          </div>
          <div className={styles.messageContent}>
            {message.tool_name === 'image_generation' && predictionId ? (
              <ImagePredictionCard
                messageId={message.id}
                predictionId={String(predictionId)}
                initialStatus={initialStatus}
                initialUrl={persistedUrl}
              />
            ) : message.tool_name === 'script_creation' ? (
              <ScriptCard content={message.content} />
            ) : (message.tool_name === 'storyboard_creation' || message.tool_name === 'video_generation') && storyboardData ? (
              <StoryboardCard storyboard={storyboardData as Storyboard} messageId={message.id} />
            ) : (
              <div className={styles.messageBubble}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        key={message.id}
        className={`${styles.message} ${isUser ? styles.messageUser : ''}`}
      >
        <div className={`${styles.messageAvatar} ${isUser ? styles.avatarUser : styles.avatarAssistant}`}>
          {isUser ? (
            <span>{userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}</span>
          ) : (
            <Sparkles size={16} />
          )}
        </div>
        <div className={`${styles.messageContent} ${isUser ? styles.messageContentUser : ''}`}>
          <div className={`${styles.messageBubble} ${isUser ? styles.messageBubbleUser : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
          <div className={`${styles.messageTime} ${isUser ? styles.messageTimeUser : ''}`}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  };

  if (!authToken) {
    return (
      <div className={styles.chatContainer}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{ fontSize: '24px', fontWeight: '600', color: '#ffffff' }}>AI Assistant</div>
          <div style={{ fontSize: '16px', color: '#8e8ea0', textAlign: 'center', maxWidth: '400px' }}>
            Sign in to start chatting with your creative AI assistant for ads, scripts, and storyboards.
          </div>
          <a 
            href="/auth" 
            style={{
              background: '#10a37f',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '500'
            }}
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatContainer}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className={styles.overlay}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
        {/* Sidebar Header */}
        <div className={styles.sidebarHeader}>
          <button
            onClick={startNewConversation}
            className={styles.newChatButton}
          >
            <Plus size={18} />
            New Chat
          </button>
        </div>

        {/* Conversations */}
        <div className={styles.conversationList}>
          {conversations.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#8e8ea0', fontSize: '14px' }}>
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = activeConversationId === conv.id;
              const lastMsg = (conv.messages || []).slice(-1)[0];
              const preview = lastMsg?.content ? String(lastMsg.content).slice(0, 60) : 'New conversation';
              const title = conv.title || extractQuickTitle(conv.messages || []);

              return (
                <div
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  className={`${styles.conversationItem} ${isActive ? styles.active : ''}`}
                >
                  <div>
                    <div className={styles.conversationTitle}>{title}</div>
                    <div className={styles.conversationPreview}>{preview}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className={styles.deleteButton}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={styles.mainArea}>
        {/* Top Bar */}
        <header className={styles.chatHeader}>
          <div>
            <button
              onClick={() => setSidebarOpen(true)}
              className={styles.mobileMenuButton}
              style={{ display: 'none' }}
            >
              <Menu size={20} />
            </button>
            <div className={styles.headerTitle}>
              {activeConversationId && conversations.find(c => c.id === activeConversationId)?.title || 'New Chat'}
            </div>
            <div className={styles.headerSubtitle}>
              {isLoading ? 'AI is thinking...' : 'Ready to help with your creative projects'}
            </div>
          </div>
        </header>

        {/* Chat Messages */}
        <div 
          ref={chatContainerRef}
          className={styles.messagesContainer}
        >
          <div className={styles.messagesContent}>
            {messages.length === 0 && !isLoading ? (
              <div className={styles.welcomeScreen}>
                <h1 className={styles.welcomeTitle}>What can I help you create today?</h1>
                <p className={styles.welcomeSubtitle}>
                  I can help you create ad scripts, complete video storyboards, generate images, or brainstorm creative strategies for your campaigns.
                </p>
                
                <div className={styles.suggestionsGrid}>
                  {[
                    { icon: Film, title: 'Complete UGC Storyboard', prompt: 'Create a complete UGC video ad storyboard for a vitamin C serum targeting women 25-35, 30 seconds for TikTok.' },
                    { icon: FileText, title: 'UGC Script (TikTok)', prompt: 'Create a UGC TikTok script for a mascara brand with a strong hook and CTA.' },
                    { icon: ImageIcon, title: 'First-frame Image', prompt: 'Generate a first-frame image for a UGC product ad in a clean bathroom setting, vertical 9:16.' },
                    { icon: Star, title: '5 Creative Angles', prompt: 'Help me brainstorm 5 ad angles for a new skincare product.' }
                  ].map((suggestion, i) => (
                    <div
                      key={i}
                      onClick={() => setInput(suggestion.prompt)}
                      className={styles.suggestionCard}
                    >
                      <div className={styles.suggestionTitle}>
                        <suggestion.icon size={18} />
                        {suggestion.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map(renderMessage)}

                {/* Streaming Reflexion */}
                {currentReflexion && (
                  <div className={styles.message}>
                    <div className={`${styles.messageAvatar} ${styles.avatarAssistant}`}>
                      <Brain size={16} />
                    </div>
                    <div className={styles.messageContent}>
                      <div className={styles.messageBubble}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span>Thinking</span>
                          {isThinking && (
                            <div className={styles.loadingDots}>
                              <div className={styles.loadingDot}></div>
                              <div className={styles.loadingDot}></div>
                              <div className={styles.loadingDot}></div>
                            </div>
                          )}
                        </div>
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                          {currentReflexion.replace(/<\/?reflexion>/g, '').trim()}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* Streaming Response */}
                {currentResponse && (
                  <div className={styles.message}>
                    <div className={`${styles.messageAvatar} ${styles.avatarAssistant}`}>
                      <Sparkles size={16} />
                    </div>
                    <div className={styles.messageContent}>
                      <div className={styles.messageBubble}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentResponse
                            .replace(/<reflexion>[\s\S]*?<\/reflexion>/g, '')
                            .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
                            .trim()}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <div className={styles.message}>
                    <div className={`${styles.messageAvatar}`} style={{ background: '#ff6b6b' }}>
                      <AlertCircle size={16} />
                    </div>
                    <div className={styles.messageContent}>
                      <div className={styles.messageBubble} style={{ background: '#ff6b6b', color: '#ffffff' }}>
                        <strong>Error:</strong> {error}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className={styles.inputArea}>
          <div className={styles.inputContainer}>
            <div className={styles.inputBox}>
              <button className={styles.attachButton}>
                <Paperclip size={18} />
              </button>
              
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Message ChatGPT..."
                disabled={isLoading}
                className={styles.textarea}
                rows={1}
              />
              
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className={styles.sendButton}
              >
                {isLoading ? (
                  <Loader2 size={18} className={styles.spinner} />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
            
            <div className={styles.inputHint}>
              {isThinking ? 'AI is thinking...' : isLoading ? 'Processing your request...' : 'Press Enter to send, Shift+Enter for new line'}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}