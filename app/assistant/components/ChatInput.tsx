'use client';

import { useState, useRef, useEffect } from 'react';
import type { AssistantMedia } from '../../../types/assistant';
import { Send, Upload, X, Loader2 } from 'lucide-react';

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  attachments: AssistantMedia[];
  onAttachmentsChange: (attachments: AssistantMedia[]) => void;
  onSend: () => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
};

export default function ChatInput({
  value,
  onChange,
  attachments,
  onAttachmentsChange,
  onSend,
  disabled = false,
  loading = false,
  placeholder = 'Send a message...',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!disabled && !loading && value.trim()) {
        onSend();
      }
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    const newAttachments: AssistantMedia[] = [];

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      form.append('filename', file.name);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: form });
        if (res.ok) {
          const json = await res.json();
          const kind = file.type.startsWith('image')
            ? 'image'
            : file.type.startsWith('video')
              ? 'video'
              : file.type.startsWith('audio')
                ? 'audio'
                : 'unknown';
          newAttachments.push({
            type: kind as AssistantMedia['type'],
            url: json.url,
            label: file.name,
          });
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }

    onAttachmentsChange([...attachments, ...newAttachments]);
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="chat-input-container">
      {attachments.length > 0 && (
        <div className="chat-input-attachments">
          {attachments.map((att, idx) => (
            <div key={idx} className="chat-input-attachment">
              {att.type === 'image' && (
                <img
                  src={att.url.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(att.url)}` : att.url}
                  alt={att.label || 'Attachment'}
                  className="chat-input-attachment-thumb"
                />
              )}
              {att.type === 'video' && (
                <div className="chat-input-attachment-thumb chat-input-attachment-video">
                  <span>🎥</span>
                </div>
              )}
              {att.type === 'audio' && (
                <div className="chat-input-attachment-thumb chat-input-attachment-audio">
                  <span>🎵</span>
                </div>
              )}
              <span className="chat-input-attachment-label">{att.label || 'File'}</span>
              <button
                className="chat-input-attachment-remove"
                onClick={() => removeAttachment(idx)}
                type="button"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          className="chat-input-textarea"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          rows={1}
          style={{
            resize: 'none',
            overflow: 'auto',
            maxHeight: '200px',
          }}
        />
        <div className="chat-input-actions">
          <label className="chat-input-upload-button" title="Upload file">
            {uploading ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Upload size={16} />
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => handleFileSelect(e.target.files)}
              accept="image/*,video/*,audio/*"
            />
          </label>
          <button
            className="chat-input-send-button"
            onClick={onSend}
            disabled={disabled || loading || !value.trim()}
            title="Send message (⌘+Enter)"
          >
            {loading ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

