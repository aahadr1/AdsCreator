'use client';

import type { AssistantMedia } from '../../../types/assistant';
import { Image as ImageIcon, Video, Music, File } from 'lucide-react';
import ClarificationWidget from './widgets/ClarificationWidget';
import ResearchWidget from './widgets/ResearchWidget';
import StrategyWidget from './widgets/StrategyWidget';
import DynamicBlockRenderer from './DynamicBlockRenderer';
import type { AgentResponse } from '@/types/agentResponse';
import type { DynamicResponse } from '@/types/dynamicContent';
import {
  isClarificationNeeded,
  isResearchInProgress,
  isResearchComplete,
  isStrategyComplete,
} from '@/types/agentResponse';
import { isDynamicResponse } from '@/types/dynamicContent';

type MessageBubbleProps = {
  role: 'user' | 'assistant';
  content?: string;
  attachments?: AssistantMedia[];
  children?: React.ReactNode;
  onClarificationSubmit?: (answers: Record<string, string>) => void;
  onStrategyProceed?: () => void;
  onDynamicAction?: (action: string, parameters?: Record<string, any>) => void;
};

export default function MessageBubble({
  role,
  content,
  attachments,
  children,
  onClarificationSubmit,
  onStrategyProceed,
  onDynamicAction,
}: MessageBubbleProps) {
  const isUser = role === 'user';

  // Try to parse content as response (supports both old and new formats)
  let parsedResponse: AgentResponse | DynamicResponse | null = null;
  if (role === 'assistant' && content) {
    try {
      const parsed = JSON.parse(content);
      if (parsed.responseType) {
        parsedResponse = parsed;
      }
    } catch {
      // Not JSON, treat as regular text
    }
  }

  return (
    <div className={`message-bubble message-bubble-${role}`}>
      <div className="message-bubble-content">
        {/* Dynamic Block System (NEW - handles any combination) */}
        {parsedResponse && isDynamicResponse(parsedResponse) && (
          <div className="space-y-4">
            {parsedResponse.blocks.map((block) => (
              <DynamicBlockRenderer
                key={block.id}
                block={block}
                onAction={onDynamicAction}
              />
            ))}
          </div>
        )}

        {/* Legacy Widget Rendering (for backward compatibility) */}
        {parsedResponse && !isDynamicResponse(parsedResponse) && isClarificationNeeded(parsedResponse) && onClarificationSubmit && (
          <ClarificationWidget data={parsedResponse} onSubmit={onClarificationSubmit} />
        )}
        
        {parsedResponse && !isDynamicResponse(parsedResponse) && (isResearchInProgress(parsedResponse) || isResearchComplete(parsedResponse)) && (
          <ResearchWidget data={parsedResponse} />
        )}
        
        {parsedResponse && !isDynamicResponse(parsedResponse) && isStrategyComplete(parsedResponse) && onStrategyProceed && (
          <StrategyWidget data={parsedResponse} onProceed={onStrategyProceed} />
        )}

        {/* Regular Text Content (only if not a special response) */}
        {!parsedResponse && content && (
          <div className="message-bubble-text">
            {content}
          </div>
        )}
        {attachments && attachments.length > 0 && (
          <div className="message-bubble-attachments">
            {attachments.map((att, idx) => (
              <div key={idx} className="message-attachment">
                {att.type === 'image' && (
                  <div className="attachment-preview attachment-preview-image">
                    <img
                      src={att.url.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(att.url)}` : att.url}
                      alt={att.label || 'Attachment'}
                      onError={(e) => {
                        if (e.currentTarget.src !== att.url) {
                          e.currentTarget.src = att.url;
                        }
                      }}
                    />
                    <div className="attachment-label">{att.label || 'Image'}</div>
                  </div>
                )}
                {att.type === 'video' && (
                  <div className="attachment-preview attachment-preview-video">
                    <video
                      src={att.url.startsWith('http') ? `/api/proxy?type=video&url=${encodeURIComponent(att.url)}` : att.url}
                      preload="metadata"
                      muted
                    />
                    <div className="attachment-label">
                      <Video size={14} />
                      {att.label || 'Video'}
                    </div>
                  </div>
                )}
                {att.type === 'audio' && (
                  <div className="attachment-preview attachment-preview-audio">
                    <Music size={24} />
                    <div className="attachment-label">{att.label || 'Audio'}</div>
                  </div>
                )}
                {att.type !== 'image' && att.type !== 'video' && att.type !== 'audio' && (
                  <div className="attachment-preview attachment-preview-file">
                    <File size={24} />
                    <div className="attachment-label">{att.label || 'File'}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {children && (
          <div className="message-bubble-widgets">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

