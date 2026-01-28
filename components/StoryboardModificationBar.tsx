'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, X, Loader2, Sparkles } from 'lucide-react';
import type { StoryboardSelection } from '@/types/storyboardSelection';
import { describeSelection } from '@/types/storyboardSelection';
import styles from './StoryboardModificationBar.module.css';

interface StoryboardModificationBarProps {
  selection: StoryboardSelection | null;
  storyboardId: string;
  authToken: string;
  onClearSelection: () => void;
  onModificationApplied: (changedFields?: string[]) => void;
}

export function StoryboardModificationBar({
  selection,
  storyboardId,
  authToken,
  onClearSelection,
  onModificationApplied,
}: StoryboardModificationBarProps) {
  const [modificationText, setModificationText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when selection changes
  useEffect(() => {
    if (selection && selection.items.length > 0) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [selection]);

  if (!selection || selection.items.length === 0) {
    return null;
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!modificationText.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Use AI-powered modification endpoint that actually regenerates content
      const res = await fetch('/api/storyboard/ai-modify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          storyboard_id: storyboardId,
          selection,
          modification_text: modificationText,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to apply modifications');
      }
      
      // Success!
      const successMsg = data.summary || data.details || data.message || 'Modifications applied successfully';
      const reflexionMsg = data.reflexion ? `\n💡 ${data.reflexion}` : '';
      setSuccessMessage(successMsg + reflexionMsg);
      setModificationText('');
      
      // Show success message for 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      
      // Reload storyboard immediately with changed fields for visual feedback
      onModificationApplied(data.changed_fields);
      
      // Clear selection after short delay (so user sees what was modified)
      setTimeout(() => {
        onClearSelection();
      }, 1500);
      
    } catch (err: any) {
      console.error('Modification error:', err);
      setError(err.message || 'Failed to apply modifications');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClearSelection();
    }
  };

  const selectionDescription = describeSelection(selection);

  return (
    <div className={styles.container}>
      <div className={styles.bar}>
        <div className={styles.selectionInfo}>
          <Sparkles size={16} className={styles.icon} />
          <span className={styles.selectionText}>
            Modifying: <strong>{selectionDescription}</strong>
          </span>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder={`What would you like to change about ${selectionDescription}?`}
            value={modificationText}
            onChange={(e) => setModificationText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
          />
          
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!modificationText.trim() || isSubmitting}
            title="Apply modification (Enter)"
          >
            {isSubmitting ? (
              <Loader2 size={18} className={styles.spinner} />
            ) : (
              <Send size={18} />
            )}
          </button>
          
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClearSelection}
            title="Clear selection (Esc)"
          >
            <X size={18} />
          </button>
        </form>
      </div>
      
      {error && (
        <div className={styles.errorBanner}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className={styles.errorClose}>×</button>
        </div>
      )}
      
      {successMessage && (
        <div className={styles.successBanner}>
          <span>✅ {successMessage}</span>
        </div>
      )}
      
      <div className={styles.hints}>
        <span>💡 Examples:</span>
        <button className={styles.hintBtn} onClick={() => setModificationText('Make it more energetic and upbeat')}>
          Make it more energetic
        </button>
        <button className={styles.hintBtn} onClick={() => setModificationText('Shorten to 3 seconds')}>
          Shorten duration
        </button>
        <button className={styles.hintBtn} onClick={() => setModificationText('Change the setting to outdoors')}>
          Change setting
        </button>
        <button className={styles.hintBtn} onClick={() => setModificationText('Add more emphasis on the product benefits')}>
          Emphasize benefits
        </button>
      </div>
    </div>
  );
}
