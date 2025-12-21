'use client';

import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { supabaseClient as supabase } from '../../../lib/supabaseClient';
import type { EditorAsset } from '../../../types/editor';

type EditorTaskSelectorProps = {
  onClose: () => void;
  onSelect: (assets: EditorAsset[]) => void;
};

type TaskItem = {
  id: string;
  output_url?: string | null;
  output_text?: string | null;
  video_url?: string | null;
  audio_url?: string | null;
  image_url?: string | null;
  type?: string | null;
  created_at: string;
};

export default function EditorTaskSelector({ onClose, onSelect }: EditorTaskSelectorProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch tasks from Supabase
        const { data, error } = await supabase
          .from('tasks')
          .select('id, output_url, output_text, video_url, audio_url, image_url, type, created_at')
          .eq('user_id', user.id)
          .not('output_url', 'is', null)
          .or('video_url.not.is.null,audio_url.not.is.null,image_url.not.is.null')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        setTasks(data || []);
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedTasks = tasks.filter((task) => selectedTaskIds.has(task.id));
    const assets: EditorAsset[] = [];

    selectedTasks.forEach((task) => {
      const urls = [
        task.output_url,
        task.video_url,
        task.audio_url,
        task.image_url,
      ].filter(Boolean) as string[];

      urls.forEach((url, idx) => {
        let type: EditorAsset['type'] = 'text';
        if (url.includes('video') || /\.(mp4|webm|mov|avi)/i.test(url)) {
          type = 'video';
        } else if (url.includes('audio') || /\.(mp3|wav|ogg|m4a)/i.test(url)) {
          type = 'audio';
        } else if (url.includes('image') || /\.(png|jpg|jpeg|gif|webp)/i.test(url)) {
          type = 'image';
        } else if (task.output_text) {
          type = 'text';
        }

        assets.push({
          id: `task-${task.id}-${idx}`,
          type,
          url,
          name: `Task ${task.id}${idx > 0 ? ` (${idx + 1})` : ''}`,
          source: 'task',
          sourceId: task.id,
        });
      });

      if (task.output_text && !urls.length) {
        assets.push({
          id: `task-${task.id}-text`,
          type: 'text',
          url: `data:text/plain;base64,${btoa(task.output_text)}`,
          name: `Task ${task.id} (text)`,
          source: 'task',
          sourceId: task.id,
        });
      }
    });

    onSelect(assets);
  };

  const getTaskMediaUrl = (task: TaskItem) => {
    return task.output_url || task.video_url || task.audio_url || task.image_url || null;
  };

  const getTaskMediaType = (task: TaskItem): EditorAsset['type'] => {
    const url = getTaskMediaUrl(task);
    if (!url) return 'text';
    if (url.includes('video') || /\.(mp4|webm|mov|avi)/i.test(url)) return 'video';
    if (url.includes('audio') || /\.(mp3|wav|ogg|m4a)/i.test(url)) return 'audio';
    if (url.includes('image') || /\.(png|jpg|jpeg|gif|webp)/i.test(url)) return 'image';
    return 'text';
  };

  return (
    <div className="assistant-editor-task-selector-overlay" onClick={onClose}>
      <div className="assistant-editor-task-selector" onClick={(e) => e.stopPropagation()}>
        <div className="assistant-editor-task-selector-header">
          <h3>Select from Tasks</h3>
          <button className="assistant-editor-task-selector-close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="assistant-editor-task-selector-content">
          {loading ? (
            <div className="assistant-editor-task-selector-loading">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="assistant-editor-task-selector-empty">No tasks found</div>
          ) : (
            <div className="assistant-editor-task-list">
              {tasks.map((task) => {
                const isSelected = selectedTaskIds.has(task.id);
                const mediaUrl = getTaskMediaUrl(task);
                const mediaType = getTaskMediaType(task);
                const proxiedUrl = mediaUrl
                  ? `/api/proxy?url=${encodeURIComponent(mediaUrl)}`
                  : null;

                return (
                  <div
                    key={task.id}
                    className={`assistant-editor-task-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleTaskSelection(task.id)}
                  >
                    <div className="assistant-editor-task-thumbnail">
                      {proxiedUrl && mediaType === 'image' ? (
                        <img src={proxiedUrl} alt="Task output" />
                      ) : (
                        <div className="assistant-editor-task-icon">
                          {mediaType === 'video' ? '🎥' : mediaType === 'audio' ? '🎵' : '📄'}
                        </div>
                      )}
                    </div>
                    <div className="assistant-editor-task-info">
                      <div className="assistant-editor-task-id">Task {task.id.slice(0, 8)}</div>
                      <div className="assistant-editor-task-type">{mediaType}</div>
                    </div>
                    {isSelected && (
                      <div className="assistant-editor-task-check">
                        <Check size={16} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="assistant-editor-task-selector-footer">
          <button
            className="assistant-editor-task-selector-cancel"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="assistant-editor-task-selector-confirm"
            onClick={handleConfirm}
            disabled={selectedTaskIds.size === 0}
            type="button"
          >
            Add {selectedTaskIds.size > 0 ? `${selectedTaskIds.size} ` : ''}Selected
          </button>
        </div>
      </div>
    </div>
  );
}

