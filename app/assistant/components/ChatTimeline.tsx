'use client';

import { useRef, useEffect } from 'react';
import {
  Sparkles,
  User,
  AlertCircle,
  RefreshCw,
  Send,
  Image as ImageIcon,
  Paperclip,
  X,
} from 'lucide-react';
import type { ChatMessage, WidgetBlock } from '@/types/ugc';

// Import widgets (will be created next)
import { WidgetRenderer } from './widgets/WidgetRenderer';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ChatTimelineProps = {
  messages: ChatMessage[];
  loading: boolean;
  input: string;
  attachments: { type: string; url: string; label?: string }[];
  onInputChange: (value: string) => void;
  onSend: () => void;
  onAttach: () => void;
  onRemoveAttachment: (index: number) => void;
  onWidgetAction: (widgetId: string, action: string, data?: any) => void;
  disabled?: boolean;
  placeholder?: string;
};

// -----------------------------------------------------------------------------
// Message Bubble
// -----------------------------------------------------------------------------

function MessageBubble({
  message,
  onWidgetAction,
}: {
  message: ChatMessage;
  onWidgetAction: (widgetId: string, action: string, data?: any) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`message ${isUser ? 'message-user' : 'message-assistant'}`}>
      {!isUser && (
        <div className="message-avatar">
          <Sparkles size={16} />
        </div>
      )}
      <div className="message-content">
        {/* Text content */}
        {message.content && (
          <div className="message-text">
            <MessageText text={message.content} />
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((att, i) => (
              <div key={i} className="attachment-preview">
                {att.type === 'image' ? (
                  <img src={att.url} alt={att.label || 'Attachment'} />
                ) : att.type === 'video' ? (
                  <video src={att.url} controls />
                ) : (
                  <a href={att.url} target="_blank" rel="noopener noreferrer">
                    {att.label || 'File'}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Widgets */}
        {message.blocks && message.blocks.length > 0 && (
          <div className="message-widgets">
            {message.blocks.map((block) => (
              <WidgetRenderer
                key={block.id}
                block={block}
                onAction={(action, data) => onWidgetAction(block.id, action, data)}
              />
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="message-avatar user">
          <User size={16} />
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Message Text (simple markdown)
// -----------------------------------------------------------------------------

function MessageText({ text }: { text: string }) {
  // Simple markdown: **bold**, *italic*, `code`
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\n)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i}>{part.slice(1, -1)}</code>;
        }
        if (part === '\n') {
          return <br key={i} />;
        }
        return part;
      })}
    </>
  );
}

// -----------------------------------------------------------------------------
// Loading Indicator
// -----------------------------------------------------------------------------

function LoadingIndicator() {
  return (
    <div className="message message-assistant">
      <div className="message-avatar">
        <Sparkles size={16} />
      </div>
      <div className="message-content">
        <div className="loading-indicator">
          <RefreshCw size={16} className="spin" />
          <span>Thinking...</span>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Input Area
// -----------------------------------------------------------------------------

function InputArea({
  input,
  attachments,
  loading,
  disabled,
  placeholder,
  onInputChange,
  onSend,
  onAttach,
  onRemoveAttachment,
}: {
  input: string;
  attachments: { type: string; url: string; label?: string }[];
  loading: boolean;
  disabled?: boolean;
  placeholder?: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onAttach: () => void;
  onRemoveAttachment: (index: number) => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="input-area">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="input-attachments">
          {attachments.map((att, i) => (
            <div key={i} className="input-attachment">
              {att.type === 'image' ? (
                <img src={att.url} alt="" />
              ) : (
                <Paperclip size={16} />
              )}
              <button
                className="remove-attachment"
                onClick={() => onRemoveAttachment(i)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="input-row">
        <button
          className="input-btn attach-btn"
          onClick={onAttach}
          disabled={disabled || loading}
          title="Attach file"
        >
          <ImageIcon size={20} />
        </button>

        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Type a message...'}
          disabled={disabled || loading}
          rows={1}
          className="input-field"
        />

        <button
          className="input-btn send-btn"
          onClick={onSend}
          disabled={disabled || loading || (!input.trim() && attachments.length === 0)}
          title="Send"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function ChatTimeline({
  messages,
  loading,
  input,
  attachments,
  onInputChange,
  onSend,
  onAttach,
  onRemoveAttachment,
  onWidgetAction,
  disabled,
  placeholder,
}: ChatTimelineProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="chat-timeline">
      <div className="messages-container">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onWidgetAction={onWidgetAction}
          />
        ))}
        {loading && <LoadingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <InputArea
        input={input}
        attachments={attachments}
        loading={loading}
        disabled={disabled}
        placeholder={placeholder}
        onInputChange={onInputChange}
        onSend={onSend}
        onAttach={onAttach}
        onRemoveAttachment={onRemoveAttachment}
      />
    </div>
  );
}

export default ChatTimeline;
