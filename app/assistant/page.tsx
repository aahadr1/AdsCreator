'use client';

import '../globals.css';
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';
import {
  Send,
  Paperclip,
  Brain,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
  Sparkles,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Message, Conversation } from '../../types/assistant';

type StreamEvent = {
  type: string;
  data?: unknown;
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
    const isExpanded = expandedReflexions.has(message.id);

    if (isReflexion) {
      return (
        <div key={message.id} className="assistant-reflexion-container">
          <button
            className="assistant-reflexion-toggle"
            onClick={() => toggleReflexion(message.id)}
          >
            <Brain size={14} />
            <span>See AI thinking</span>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {isExpanded && (
            <div className="assistant-reflexion-content">
              <pre>{message.content}</pre>
            </div>
          )}
        </div>
      );
    }

    if (isToolCall) {
      return (
        <div key={message.id} className="assistant-tool-card">
          <div className="assistant-tool-header">
            {message.tool_name === 'script_creation' ? (
              <FileText size={16} />
            ) : (
              <ImageIcon size={16} />
            )}
            <span>
              {message.tool_name === 'script_creation' ? 'Generating Script' : 'Generating Image'}
            </span>
            <Loader2 size={14} className="assistant-spinner" />
          </div>
        </div>
      );
    }

    if (isToolResult) {
      const success = message.tool_output && (message.tool_output as any).success !== false;
      return (
        <div key={message.id} className={`assistant-tool-result ${success ? 'success' : 'error'}`}>
          <div className="assistant-tool-result-header">
            {success ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>
              {message.tool_name === 'script_creation' ? 'Script Generated' : 'Image Generation Started'}
            </span>
          </div>
          <div className="assistant-tool-result-content">
            <pre>{message.content}</pre>
          </div>
        </div>
      );
    }

    return (
      <div
        key={message.id}
        className={`assistant-message ${isUser ? 'user' : 'assistant'}`}
      >
        <div className="assistant-message-avatar">
          {isUser ? (
            <span>{userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}</span>
          ) : (
            <Sparkles size={18} />
          )}
        </div>
        <div className="assistant-message-content">
          <div className="assistant-message-header">
            <span className="assistant-message-role">
              {isUser ? 'You' : 'Assistant'}
            </span>
            <span className="assistant-message-time">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="assistant-message-text">
            {message.content}
          </div>
        </div>
      </div>
    );
  };

  if (!authToken) {
    return (
      <div className="assistant-auth-gate">
        <div className="assistant-auth-card">
          <MessageSquare size={48} />
          <h1>AI Assistant</h1>
          <p>Sign in to start chatting with your creative AI assistant.</p>
          <a href="/auth" className="btn">Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div className="assistant-container">
      {/* Sidebar with conversations */}
      <aside className="assistant-sidebar">
        <div className="assistant-sidebar-header">
          <h2>Conversations</h2>
          <button
            className="assistant-new-chat-btn"
            onClick={startNewConversation}
            title="New conversation"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="assistant-conversations-list">
          {conversations.length === 0 ? (
            <div className="assistant-no-conversations">
              <MessageSquare size={24} />
              <span>No conversations yet</span>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className={`assistant-conversation-item ${activeConversationId === conv.id ? 'active' : ''}`}
              >
                <button
                  className="assistant-conversation-btn"
                  onClick={() => loadConversation(conv)}
                >
                  <MessageSquare size={16} />
                  <span className="assistant-conversation-title">
                    {conv.title || 'Untitled conversation'}
                  </span>
                </button>
                <button
                  className="assistant-conversation-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  title="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <main className="assistant-main">
        <div className="assistant-chat-header">
          <div className="assistant-chat-title">
            <Sparkles size={24} />
            <h1>AI Assistant</h1>
          </div>
          <span className="assistant-chat-subtitle">
            Your creative partner for ads, scripts, and visuals
          </span>
        </div>

        <div className="assistant-messages">
          {messages.length === 0 && !isLoading ? (
            <div className="assistant-welcome">
              <div className="assistant-welcome-icon">
                <Sparkles size={48} />
              </div>
              <h2>How can I help you today?</h2>
              <p>I can help you create ad scripts, generate images, and more.</p>
              <div className="assistant-suggestions">
                <button onClick={() => setInput('Create a TikTok script for a cooling blanket targeting hot sleepers')}>
                  Create a TikTok ad script
                </button>
                <button onClick={() => setInput('Generate an image for a product ad')}>
                  Generate a product image
                </button>
                <button onClick={() => setInput('Help me with a UGC-style video concept')}>
                  UGC video concept
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map(renderMessage)}
              
              {/* Current reflexion being streamed */}
              {isThinking && currentReflexion && (
                <div className="assistant-reflexion-container streaming">
                  <div className="assistant-reflexion-toggle active">
                    <Brain size={14} />
                    <span>AI is thinking...</span>
                    <Loader2 size={14} className="assistant-spinner" />
                  </div>
                  <div className="assistant-reflexion-content">
                    <pre>{currentReflexion}</pre>
                  </div>
                </div>
              )}
              
              {/* Current response being streamed */}
              {!isThinking && currentResponse && (
                <div className="assistant-message assistant streaming">
                  <div className="assistant-message-avatar">
                    <Sparkles size={18} />
                  </div>
                  <div className="assistant-message-content">
                    <div className="assistant-message-header">
                      <span className="assistant-message-role">Assistant</span>
                    </div>
                    <div className="assistant-message-text">
                      {currentResponse.replace(/<reflexion>[\s\S]*?<\/reflexion>/g, '').replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Loading indicator */}
              {isLoading && !currentReflexion && !currentResponse && (
                <div className="assistant-loading">
                  <Loader2 size={24} className="assistant-spinner" />
                  <span>Thinking...</span>
                </div>
              )}
            </>
          )}
          
          {error && (
            <div className="assistant-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="assistant-input-area">
          <div className="assistant-input-container">
            <button className="assistant-attach-btn" title="Attach file">
              <Paperclip size={20} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about creating ads..."
              rows={1}
              disabled={isLoading}
            />
            <button
              className="assistant-send-btn"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              title="Send message"
            >
              {isLoading ? <Loader2 size={20} className="assistant-spinner" /> : <Send size={20} />}
            </button>
          </div>
          <div className="assistant-input-hint">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </main>

      <style jsx>{`
        .assistant-container {
          display: flex;
          height: calc(100vh - 60px);
          background: var(--bg);
        }

        .assistant-sidebar {
          width: 280px;
          background: var(--panel);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }

        .assistant-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4);
          border-bottom: 1px solid var(--border);
        }

        .assistant-sidebar-header h2 {
          font-size: var(--font-base);
          font-weight: 600;
          color: var(--text);
          margin: 0;
        }

        .assistant-new-chat-btn {
          background: var(--accent);
          color: var(--bg);
          border: none;
          border-radius: var(--radius-md);
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: opacity 0.15s;
        }

        .assistant-new-chat-btn:hover {
          opacity: 0.9;
        }

        .assistant-conversations-list {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-2);
        }

        .assistant-no-conversations {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-6);
          color: var(--text-muted);
          text-align: center;
        }

        .assistant-conversation-item {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          margin-bottom: var(--space-1);
        }

        .assistant-conversation-btn {
          flex: 1;
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          transition: background 0.15s;
          text-align: left;
        }

        .assistant-conversation-btn:hover {
          background: var(--panel-hover);
        }

        .assistant-conversation-item.active .assistant-conversation-btn {
          background: var(--accent-muted);
          color: var(--text);
        }

        .assistant-conversation-title {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: var(--font-sm);
        }

        .assistant-conversation-delete {
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: var(--space-1);
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s, color 0.15s;
        }

        .assistant-conversation-item:hover .assistant-conversation-delete {
          opacity: 1;
        }

        .assistant-conversation-delete:hover {
          color: #ef4444;
        }

        .assistant-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .assistant-chat-header {
          padding: var(--space-4) var(--space-6);
          border-bottom: 1px solid var(--border);
          background: var(--panel);
        }

        .assistant-chat-title {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--text);
        }

        .assistant-chat-title h1 {
          font-size: var(--font-lg);
          font-weight: 600;
          margin: 0;
        }

        .assistant-chat-subtitle {
          font-size: var(--font-sm);
          color: var(--text-muted);
          margin-top: var(--space-1);
          display: block;
        }

        .assistant-messages {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4) var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .assistant-welcome {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: var(--space-8);
        }

        .assistant-welcome-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, var(--accent-muted), transparent);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: var(--space-4);
          color: var(--accent);
        }

        .assistant-welcome h2 {
          font-size: var(--font-xl);
          color: var(--text);
          margin: 0 0 var(--space-2);
        }

        .assistant-welcome p {
          color: var(--text-muted);
          margin: 0 0 var(--space-6);
        }

        .assistant-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          justify-content: center;
        }

        .assistant-suggestions button {
          background: var(--panel-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-2) var(--space-4);
          color: var(--text-secondary);
          font-size: var(--font-sm);
          cursor: pointer;
          transition: all 0.15s;
        }

        .assistant-suggestions button:hover {
          background: var(--panel-hover);
          border-color: var(--accent);
          color: var(--text);
        }

        .assistant-message {
          display: flex;
          gap: var(--space-3);
          max-width: 85%;
        }

        .assistant-message.user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .assistant-message.assistant {
          align-self: flex-start;
        }

        .assistant-message-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: var(--font-sm);
          font-weight: 600;
        }

        .assistant-message.user .assistant-message-avatar {
          background: var(--accent);
          color: var(--bg);
        }

        .assistant-message.assistant .assistant-message-avatar {
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          color: white;
        }

        .assistant-message-content {
          background: var(--panel-elevated);
          border-radius: var(--radius-lg);
          padding: var(--space-3) var(--space-4);
          border: 1px solid var(--border);
        }

        .assistant-message.user .assistant-message-content {
          background: var(--accent);
          border-color: var(--accent);
        }

        .assistant-message.user .assistant-message-content,
        .assistant-message.user .assistant-message-header,
        .assistant-message.user .assistant-message-text {
          color: var(--bg);
        }

        .assistant-message-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-1);
        }

        .assistant-message-role {
          font-size: var(--font-sm);
          font-weight: 600;
          color: var(--text);
        }

        .assistant-message-time {
          font-size: var(--font-xs);
          color: var(--text-muted);
        }

        .assistant-message.user .assistant-message-time {
          color: rgba(0, 0, 0, 0.5);
        }

        .assistant-message-text {
          color: var(--text-secondary);
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .assistant-reflexion-container {
          align-self: flex-start;
          max-width: 85%;
        }

        .assistant-reflexion-toggle {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: transparent;
          border: 1px dashed var(--border);
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-3);
          color: var(--text-muted);
          font-size: var(--font-sm);
          cursor: pointer;
          transition: all 0.15s;
        }

        .assistant-reflexion-toggle:hover,
        .assistant-reflexion-toggle.active {
          background: var(--panel-elevated);
          border-style: solid;
          color: var(--text-secondary);
        }

        .assistant-reflexion-content {
          margin-top: var(--space-2);
          padding: var(--space-3);
          background: var(--panel-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }

        .assistant-reflexion-content pre {
          margin: 0;
          font-size: var(--font-sm);
          color: var(--text-muted);
          white-space: pre-wrap;
          word-break: break-word;
          font-family: var(--font-mono);
          line-height: 1.5;
        }

        .assistant-tool-card {
          align-self: flex-start;
          background: var(--panel-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-4);
        }

        .assistant-tool-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--text-secondary);
          font-size: var(--font-sm);
        }

        .assistant-tool-result {
          align-self: flex-start;
          max-width: 85%;
          background: var(--panel-elevated);
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          overflow: hidden;
        }

        .assistant-tool-result.success {
          border-color: #10b981;
        }

        .assistant-tool-result.error {
          border-color: #ef4444;
        }

        .assistant-tool-result-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          font-size: var(--font-sm);
          font-weight: 500;
        }

        .assistant-tool-result.success .assistant-tool-result-header {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .assistant-tool-result.error .assistant-tool-result-header {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .assistant-tool-result-content {
          padding: var(--space-3);
          max-height: 300px;
          overflow-y: auto;
        }

        .assistant-tool-result-content pre {
          margin: 0;
          font-size: var(--font-sm);
          color: var(--text-secondary);
          white-space: pre-wrap;
          word-break: break-word;
          line-height: 1.5;
        }

        .assistant-loading {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-4);
          color: var(--text-muted);
        }

        .assistant-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .assistant-error {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: var(--radius-md);
          color: #ef4444;
          font-size: var(--font-sm);
        }

        .assistant-input-area {
          padding: var(--space-4) var(--space-6);
          border-top: 1px solid var(--border);
          background: var(--panel);
        }

        .assistant-input-container {
          display: flex;
          align-items: flex-end;
          gap: var(--space-2);
          background: var(--panel-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-2);
          transition: border-color 0.15s;
        }

        .assistant-input-container:focus-within {
          border-color: var(--accent);
        }

        .assistant-attach-btn,
        .assistant-send-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border-radius: var(--radius-md);
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .assistant-attach-btn:hover {
          background: var(--panel-hover);
          color: var(--text);
        }

        .assistant-send-btn {
          background: var(--accent);
          color: var(--bg);
        }

        .assistant-send-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .assistant-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .assistant-input-container textarea {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text);
          font-size: var(--font-base);
          resize: none;
          padding: var(--space-2);
          line-height: 1.5;
          min-height: 24px;
          max-height: 200px;
        }

        .assistant-input-container textarea:focus {
          outline: none;
        }

        .assistant-input-container textarea::placeholder {
          color: var(--text-muted);
        }

        .assistant-input-hint {
          font-size: var(--font-xs);
          color: var(--text-muted);
          text-align: center;
          margin-top: var(--space-2);
        }

        .assistant-auth-gate {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-8);
        }

        .assistant-auth-card {
          text-align: center;
          padding: var(--space-8);
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          max-width: 400px;
        }

        .assistant-auth-card h1 {
          font-size: var(--font-xl);
          color: var(--text);
          margin: var(--space-4) 0 var(--space-2);
        }

        .assistant-auth-card p {
          color: var(--text-muted);
          margin: 0 0 var(--space-6);
        }

        @media (max-width: 768px) {
          .assistant-sidebar {
            display: none;
          }

          .assistant-messages {
            padding: var(--space-3);
          }

          .assistant-message {
            max-width: 95%;
          }

          .assistant-input-area {
            padding: var(--space-3);
          }
        }
      `}</style>
    </div>
  );
}
