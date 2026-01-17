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
  Menu,
  X,
  ChevronDown,
  Settings,
  User,
  Search,
  Zap,
  Star,
} from 'lucide-react';
import type { Message, Conversation, Storyboard, StoryboardScene } from '../../types/assistant';

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

// Generate AI title from conversation
const generateAITitle = async (messages: Message[]): Promise<string> => {
  try {
    const firstMessages = messages.slice(0, 3); // Get first few messages
    const context = firstMessages
      .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n');
    
    const response = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: crypto.randomUUID(),
        message: `Based on this conversation start, generate a concise 3-5 word title that captures the main topic:\n\n${context}\n\nTitle:`
      })
    });
    
    if (!response.ok) throw new Error('Failed to generate title');
    
    // This would need to be implemented to extract just the title from the response
    // For now, let's use a simpler fallback
    return 'New Chat'; // TODO: Implement proper title extraction
  } catch (error) {
    console.error('Failed to generate AI title:', error);
    return 'New Chat';
  }
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
  const [expandedReflexions, setExpandedReflexions] = useState<Set<string>>(new Set());
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv => 
    conv.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.messages?.some(msg => 
      msg.content.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Modern Image Prediction Card Component
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

    const getStatusColor = () => {
      switch (status.toLowerCase()) {
        case 'succeeded': return 'text-green-400 bg-green-500/10 border-green-500/20';
        case 'failed': case 'canceled': return 'text-red-400 bg-red-500/10 border-red-500/20';
        default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      }
    };

    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ImageIcon size={20} className="text-blue-400" />
              <span className="font-medium">Image Generation</span>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
              {status === 'starting' && <Loader2 size={12} className="inline mr-1 animate-spin" />}
              {status}
            </div>
          </div>
        </div>
        
        <div className="p-4">
          {outputUrl ? (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-slate-700/30">
                <img
                  src={outputUrl}
                  alt="Generated image"
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(outputUrl)}
                  className="px-3 py-2 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 rounded-lg text-sm font-medium transition-colors"
                >
                  Copy URL
                </button>
                <a
                  href={outputUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-sm font-medium transition-colors"
                >
                  Open Full Size
                </a>
              </div>
            </div>
          ) : pollError ? (
            <div className="text-red-400 text-sm">{pollError}</div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 size={16} className="animate-spin" />
              <span>Generating your image...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Modern Script Card Component
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
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-green-400" />
              <span className="font-medium">Script</span>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 border border-green-500/20 text-green-400">
              ready
            </div>
          </div>
        </div>
        
        <div className="p-4">
          <div className="prose prose-invert prose-sm max-w-none mb-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 rounded-lg text-sm font-medium transition-colors"
          >
            {copied ? (
              <>
                <Check size={16} className="text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <FileText size={16} />
                <span>Copy Script</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Modern Storyboard Card Component
  function StoryboardCard({ storyboard, messageId }: { storyboard: Storyboard; messageId: string }) {
    const totalDuration = storyboard.total_duration_seconds || 
      storyboard.scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    
    const generatingCount = storyboard.scenes.filter(s => 
      s.first_frame_status === 'generating' || s.last_frame_status === 'generating'
    ).length;

    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg flex items-center justify-center">
                <Film size={20} className="text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{storyboard.title}</h3>
                <p className="text-slate-400 text-sm">
                  {storyboard.scenes.length} scenes • {totalDuration}s total
                  {generatingCount > 0 && (
                    <span className="ml-2 text-blue-400">
                      • {generatingCount} generating
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 border border-purple-500/20 text-purple-400">
              {storyboard.status === 'ready' ? 'Complete' : 'In Progress'}
            </div>
          </div>
        </div>

        {/* Scenes Grid */}
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {storyboard.scenes.map((scene, index) => (
              <SceneCard 
                key={`${messageId}-scene-${scene.scene_number}`}
                scene={scene}
                aspectRatio={storyboard.aspect_ratio}
                messageId={messageId}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Modern Scene Card Component  
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
        default: return '🎬 Scene';
      }
    };

    const getFrameStatus = (status: string) => {
      switch (status) {
        case 'succeeded': return 'bg-green-500/10 border-green-500/20 text-green-400';
        case 'failed': return 'bg-red-500/10 border-red-500/20 text-red-400';
        case 'generating': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
        default: return 'bg-slate-600/10 border-slate-600/20 text-slate-400';
      }
    };

    return (
      <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">Scene {scene.scene_number}</span>
              {scene.scene_type && (
                <span className="text-xs text-slate-400">{sceneTypeLabel(scene.scene_type)}</span>
              )}
            </div>
            <h4 className="font-medium mb-1">{scene.scene_name}</h4>
            <p className="text-xs text-slate-400 mb-2">{scene.description}</p>
            {scene.duration_seconds && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock size={12} />
                <span>{scene.duration_seconds}s</span>
              </div>
            )}
          </div>
        </div>

        {/* Frames */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-400">First Frame</div>
            {scene.first_frame_url ? (
              <img 
                src={scene.first_frame_url} 
                alt="First frame"
                className="w-full aspect-[9/16] object-cover rounded border border-slate-600/50"
              />
            ) : (
              <div className="w-full aspect-[9/16] bg-slate-600/20 rounded border border-slate-600/50 flex items-center justify-center">
                <div className={`px-2 py-1 rounded text-xs border ${getFrameStatus(scene.first_frame_status || 'pending')}`}>
                  {scene.first_frame_status === 'generating' && <Loader2 size={12} className="inline mr-1 animate-spin" />}
                  {scene.first_frame_status || 'pending'}
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            <div className="text-xs text-slate-400">Last Frame</div>
            {scene.last_frame_url ? (
              <img 
                src={scene.last_frame_url} 
                alt="Last frame"
                className="w-full aspect-[9/16] object-cover rounded border border-slate-600/50"
              />
            ) : (
              <div className="w-full aspect-[9/16] bg-slate-600/20 rounded border border-slate-600/50 flex items-center justify-center">
                <div className={`px-2 py-1 rounded text-xs border ${getFrameStatus(scene.last_frame_status || 'pending')}`}>
                  {scene.last_frame_status === 'generating' && <Loader2 size={12} className="inline mr-1 animate-spin" />}
                  {scene.last_frame_status || 'pending'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Voiceover */}
        {scene.voiceover_text && (
          <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 size={14} className="text-blue-400" />
              <span className="text-xs font-medium text-blue-400">Voiceover</span>
            </div>
            <p className="text-xs text-slate-300 italic">&quot;{scene.voiceover_text}&quot;</p>
          </div>
        )}

        {/* Video Status */}
        {scene.video_url ? (
          <div className="mt-3">
            <video 
              controls 
              className="w-full rounded border border-slate-600/50"
              poster={scene.first_frame_url}
            >
              <source src={scene.video_url} type="video/mp4" />
            </video>
          </div>
        ) : scene.video_status && scene.video_status !== 'pending' && (
          <div className="mt-3">
            <div className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${getFrameStatus(scene.video_status)}`}>
              {scene.video_status === 'generating' && <Loader2 size={14} className="animate-spin" />}
              <span>Video: {scene.video_status}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render message with better styling
  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    const isReflexion = message.role === 'reflexion';
    const isToolCall = message.role === 'tool_call';
    const isToolResult = message.role === 'tool_result';

    if (isReflexion) {
      const isExpanded = expandedReflexions.has(message.id);
      return (
        <div key={message.id} className="flex items-start gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
            <Brain size={16} className="text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <button
              onClick={() => {
                const newExpanded = new Set(expandedReflexions);
                if (isExpanded) {
                  newExpanded.delete(message.id);
                } else {
                  newExpanded.add(message.id);
                }
                setExpandedReflexions(newExpanded);
              }}
              className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors mb-2"
            >
              <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              <span>Reflexion</span>
            </button>
            {isExpanded && (
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 text-sm text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                {message.content}
              </div>
            )}
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
        <div key={message.id} className="flex items-start gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
            <Sparkles size={16} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="text-blue-400">
                  {getToolIcon()}
                </div>
                <span className="text-sm font-medium text-slate-200">{getToolLabel()}</span>
                <Loader2 size={16} className="text-blue-400 animate-spin" />
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
        <div key={message.id} className="flex items-start gap-3 mb-6">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${
            success 
              ? 'bg-green-500/10 border border-green-500/20' 
              : 'bg-red-500/10 border border-red-500/20'
          }`}>
            {success ? (
              <Check size={16} className="text-green-400" />
            ) : (
              <AlertCircle size={16} className="text-red-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
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
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={message.id} className={`flex items-start gap-3 mb-6 ${isUser ? 'flex-row-reverse' : ''}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${
          isUser 
            ? 'bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/30' 
            : 'bg-purple-500/10 border border-purple-500/20'
        }`}>
          {isUser ? (
            <span className="text-sm font-semibold text-emerald-400">
              {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
            </span>
          ) : (
            <Sparkles size={16} className="text-purple-400" />
          )}
        </div>
        <div className={`flex-1 min-w-0 ${isUser ? 'flex justify-end' : ''}`}>
            <div className={`max-w-[85%] ${isUser ? 'text-right' : ''}`}>
            <div className="flex items-center gap-2 mb-1 text-xs text-slate-400">
              <span className="font-medium">{isUser ? 'You' : 'Assistant'}</span>
              <span>•</span>
              <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className={`rounded-2xl px-4 py-3 ${
              isUser 
                ? 'bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 text-slate-200' 
                : 'bg-slate-800/50 border border-slate-700/50 text-slate-200'
            }`}>
              <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!authToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <MessageSquare size={24} className="text-purple-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">AI Assistant</h1>
          <p className="text-slate-400 mb-6 text-sm leading-relaxed">
            Sign in to start chatting with your creative AI assistant for ads, scripts, and storyboards.
          </p>
          <a 
            href="/auth" 
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105"
          >
            <User size={18} />
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-80 bg-slate-800/50 backdrop-blur-xl border-r border-slate-700/50 transform transition-transform duration-300 z-50 lg:relative lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-purple-400" />
              </div>
              <div>
                <h1 className="font-bold text-lg">AI Assistant</h1>
                <p className="text-xs text-slate-400">Creative Partner</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-8 h-8 rounded-lg hover:bg-slate-700/50 flex items-center justify-center lg:hidden"
            >
              <X size={18} />
            </button>
          </div>
          
          <button
            onClick={startNewConversation}
            className="w-full flex items-center gap-3 bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 border border-purple-500/30 rounded-xl px-4 py-3 transition-all duration-200 group"
          >
            <Plus size={18} className="text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="font-medium">New Chat</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-700/30 border border-slate-600/50 rounded-lg pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">
              {searchTerm ? 'No conversations found' : 'No conversations yet'}
            </div>
          ) : (
            <div className="p-2">
              {filteredConversations.map((conv) => {
                const isActive = activeConversationId === conv.id;
                const lastMsg = (conv.messages || []).slice(-1)[0];
                const preview = lastMsg?.content ? String(lastMsg.content).slice(0, 80) : 'New conversation';
                const title = conv.title || extractQuickTitle(conv.messages || []);

                return (
                  <div
                    key={conv.id}
                    onClick={() => loadConversation(conv)}
                    className={`group relative p-3 m-1 rounded-xl cursor-pointer transition-all duration-200 ${
                      isActive 
                        ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30' 
                        : 'hover:bg-slate-700/30 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm mb-1 truncate">{title}</div>
                        <div className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{preview}</div>
                        <div className="text-xs text-slate-500 mt-2">
                          {new Date(conv.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                        className="w-7 h-7 rounded-lg hover:bg-red-500/20 border border-transparent hover:border-red-500/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col lg:ml-0">
        {/* Top Bar */}
        <header className="h-16 bg-slate-800/30 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 rounded-lg hover:bg-slate-700/50 flex items-center justify-center lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 rounded-lg flex items-center justify-center">
                <MessageSquare size={16} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="font-semibold">
                  {activeConversationId && conversations.find(c => c.id === activeConversationId)?.title || 'New Chat'}
                </h2>
                <p className="text-xs text-slate-400">
                  {isLoading ? 'AI is thinking...' : 'Ready to help'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                <span className="hidden sm:inline">Processing...</span>
              </div>
            )}
          </div>
        </header>

        {/* Chat Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-auto scroll-smooth"
          style={{ scrollBehavior: 'smooth' }}
        >
          <div className="max-w-4xl mx-auto p-6">
            {messages.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-2xl flex items-center justify-center mb-6">
                  <Sparkles size={32} className="text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold mb-3">What are we creating today?</h2>
                <p className="text-slate-400 mb-8 max-w-md leading-relaxed">
                  I can help you create ad scripts, complete video storyboards, generate images, or brainstorm creative strategies.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                  {[
                    { icon: Film, text: 'Complete UGC Storyboard', prompt: 'Create a complete UGC video ad storyboard for a vitamin C serum targeting women 25-35, 30 seconds for TikTok.' },
                    { icon: FileText, text: 'UGC Script (TikTok)', prompt: 'Create a UGC TikTok script for a mascara brand with a strong hook and CTA.' },
                    { icon: ImageIcon, text: 'First-frame Image', prompt: 'Generate a first-frame image for a UGC product ad in a clean bathroom setting, vertical 9:16.' },
                    { icon: Star, text: '5 Creative Angles', prompt: 'Help me brainstorm 5 ad angles for a new skincare product.' }
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(suggestion.prompt)}
                      className="flex items-center gap-3 p-4 bg-slate-800/30 hover:bg-slate-700/30 border border-slate-700/50 hover:border-slate-600/50 rounded-xl text-left transition-all duration-200 group"
                    >
                      <suggestion.icon size={20} className="text-purple-400 group-hover:scale-110 transition-transform" />
                      <span className="font-medium text-sm">{suggestion.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map(renderMessage)}

                {/* Streaming Reflexion */}
                {currentReflexion && (
                  <div className="flex items-start gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <Brain size={16} className="text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 text-sm text-purple-400">
                        <span>Thinking</span>
                        {isThinking && <Loader2 size={14} className="animate-spin" />}
                      </div>
                      <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 text-sm text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                        {currentReflexion.replace(/<\/?reflexion>/g, '').trim()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Streaming Response */}
                {currentResponse && (
                  <div className="flex items-start gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <Sparkles size={16} className="text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 text-xs text-slate-400">
                        <span className="font-medium">Assistant</span>
                        <span>•</span>
                        <span>now</span>
                      </div>
                      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl px-4 py-3 text-slate-200">
                        <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {currentResponse
                              .replace(/<reflexion>[\s\S]*?<\/reflexion>/g, '')
                              .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
                              .trim()}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <div className="flex items-start gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <AlertCircle size={16} className="text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                        <div className="text-sm font-medium text-red-400 mb-1">Error</div>
                        <div className="text-sm text-slate-300">{error}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-700/50 bg-slate-800/30 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto p-4">
            <div className="relative">
              <div className="flex items-end gap-3 bg-slate-700/30 border border-slate-600/50 rounded-2xl p-3 focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/50 transition-all duration-200">
                <button className="w-10 h-10 rounded-xl hover:bg-slate-600/50 flex items-center justify-center text-slate-400 hover:text-slate-300 transition-colors">
                  <Paperclip size={20} />
                </button>
                
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Message the assistant..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 bg-transparent resize-none outline-none text-white placeholder:text-slate-400 leading-relaxed py-2"
                  style={{ minHeight: '24px', maxHeight: '120px' }}
                />
                
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all duration-200 transform hover:scale-105 disabled:scale-100"
                >
                  {isLoading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Send size={20} />
                  )}
                </button>
              </div>
              
              <div className="flex items-center justify-between mt-2 px-1">
                <div className="text-xs text-slate-500">
                  {isThinking ? 'AI is thinking...' : isLoading ? 'Processing your request...' : 'Press Enter to send • Shift+Enter for new line'}
                </div>
                <div className="text-xs text-slate-500">
                  {input.length}/2000
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}