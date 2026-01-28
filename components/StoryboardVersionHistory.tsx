'use client';

import { useState, useEffect } from 'react';
import { History, Loader2, RotateCcw } from 'lucide-react';
import styles from './StoryboardVersionHistory.module.css';

interface HistoryEntry {
  id: string;
  storyboard_id: string;
  user_id: string;
  change_type: 'scene_created' | 'scene_updated' | 'scene_deleted' | 'scene_reordered' | 'metadata_updated' | 'full_update';
  before_state: any;
  after_state: any;
  description: string | null;
  created_at: string;
}

interface StoryboardVersionHistoryProps {
  storyboardId: string;
  authToken: string;
  onRestore?: (state: any) => void;
}

export function StoryboardVersionHistory({ 
  storyboardId, 
  authToken, 
  onRestore 
}: StoryboardVersionHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    
    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/storyboard/history?storyboard_id=${storyboardId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setHistory(data.history || []);
        }
      } catch (error) {
        console.error('Error loading history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [storyboardId, authToken, isOpen]);

  const handleRestore = (entry: HistoryEntry) => {
    if (!onRestore) return;
    
    if (confirm('Restore this version? Current changes will be saved to history.')) {
      onRestore(entry.before_state);
    }
  };

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'scene_created': return '➕ Scene Created';
      case 'scene_updated': return '✏️ Scene Updated';
      case 'scene_deleted': return '🗑️ Scene Deleted';
      case 'scene_reordered': return '🔄 Scenes Reordered';
      case 'metadata_updated': return 'ℹ️ Info Updated';
      case 'full_update': return '💾 Saved';
      default: return type;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={styles.container}>
      <button 
        className={styles.toggleBtn} 
        onClick={() => setIsOpen(!isOpen)}
        title="Version history"
      >
        <History size={18} />
        History
      </button>

      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Version History</h3>
            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
              ✕
            </button>
          </div>

          <div className={styles.panelBody}>
            {isLoading ? (
              <div className={styles.loading}>
                <Loader2 size={24} className={styles.spinner} />
                <span>Loading history...</span>
              </div>
            ) : history.length === 0 ? (
              <div className={styles.empty}>
                <History size={48} />
                <p>No history yet</p>
              </div>
            ) : (
              <div className={styles.timeline}>
                {history.map((entry) => (
                  <div key={entry.id} className={styles.timelineItem}>
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineLabel}>
                        {getChangeTypeLabel(entry.change_type)}
                      </div>
                      {entry.description && (
                        <div className={styles.timelineDescription}>
                          {entry.description}
                        </div>
                      )}
                      <div className={styles.timelineTime}>
                        {formatTimestamp(entry.created_at)}
                      </div>
                    </div>
                    {onRestore && entry.before_state && (
                      <button
                        className={styles.restoreBtn}
                        onClick={() => handleRestore(entry)}
                        title="Restore this version"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
