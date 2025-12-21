'use client';

import { useState, useRef, useCallback } from 'react';
import { GripVertical, Scissors, Trash2, Copy } from 'lucide-react';
import type { EditorAsset, TimelineClip } from '../../../types/editor';

type EditorTimelineClipProps = {
  clip: TimelineClip;
  asset: EditorAsset;
  pixelsPerSecond: number;
  onUpdate: (updates: Partial<TimelineClip>) => void;
  onRemove: () => void;
};

export default function EditorTimelineClip({
  clip,
  asset,
  pixelsPerSecond,
  onUpdate,
  onRemove,
}: EditorTimelineClipProps) {
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const clipRef = useRef<HTMLDivElement>(null);

  const clipStart = clip.startTime * pixelsPerSecond;
  const clipWidth = (clip.endTime - clip.startTime) * pixelsPerSecond;
  const assetDuration = asset.duration || 5;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, side: 'left' | 'right') => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(side);

      const startX = e.clientX;
      const startTime = side === 'left' ? clip.startTime : clip.endTime;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaTime = deltaX / pixelsPerSecond;

        if (side === 'left') {
          const newStartTime = Math.max(0, startTime + deltaTime);
          const newTrimStart = clip.trimStart - deltaTime;
          onUpdate({
            startTime: newStartTime,
            trimStart: Math.max(0, newTrimStart),
          });
        } else {
          const newEndTime = Math.min(clip.startTime + assetDuration, startTime + deltaTime);
          const newTrimEnd = clip.trimEnd + (startTime + deltaTime - newEndTime);
          onUpdate({
            endTime: newEndTime,
            trimEnd: Math.max(0, newTrimEnd),
          });
        }
      };

      const handleMouseUp = () => {
        setIsResizing(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [clip, pixelsPerSecond, assetDuration, onUpdate]
  );

  const handleClipDrag = useCallback(
    (e: React.MouseEvent) => {
      if (isResizing) return;

      const startX = e.clientX;
      const startTime = clip.startTime;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaTime = deltaX / pixelsPerSecond;
        const newStartTime = Math.max(0, startTime + deltaTime);
        const newEndTime = newStartTime + (clip.endTime - clip.startTime);

        onUpdate({
          startTime: newStartTime,
          endTime: newEndTime,
        });
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [clip, pixelsPerSecond, isResizing, onUpdate]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu(true);
  }, []);

  const handleSplit = useCallback(() => {
    // Split functionality would be implemented here
    // For now, just close the menu
    setShowContextMenu(false);
  }, []);

  const handleDuplicate = useCallback(() => {
    // Duplicate functionality would be implemented here
    setShowContextMenu(false);
  }, []);

  const getClipColor = () => {
    switch (asset.type) {
      case 'video':
        return 'var(--accent)';
      case 'audio':
        return '#9a9a9a'; // Use status-warn color for audio
      case 'image':
        return '#7f7f7f'; // Use status-critical color for image
      default:
        return 'var(--text-secondary)';
    }
  };

  return (
    <>
      <div
        ref={clipRef}
        className="assistant-editor-timeline-clip"
        style={{
          left: clipStart,
          width: clipWidth,
          backgroundColor: getClipColor(),
        }}
        onMouseDown={handleClipDrag}
        onContextMenu={handleContextMenu}
      >
        <div className="assistant-editor-timeline-clip-resize-handle left" onMouseDown={(e) => handleMouseDown(e, 'left')}>
          <GripVertical size={12} />
        </div>
        <div className="assistant-editor-timeline-clip-content">
          <div className="assistant-editor-timeline-clip-name">{asset.name}</div>
          <div className="assistant-editor-timeline-clip-time">
            {clip.startTime.toFixed(1)}s - {clip.endTime.toFixed(1)}s
          </div>
        </div>
        <div className="assistant-editor-timeline-clip-resize-handle right" onMouseDown={(e) => handleMouseDown(e, 'right')}>
          <GripVertical size={12} />
        </div>
      </div>

      {showContextMenu && (
        <>
          <div
            className="assistant-editor-timeline-clip-context-menu-overlay"
            onClick={() => setShowContextMenu(false)}
          />
          <div
            className="assistant-editor-timeline-clip-context-menu"
            style={{
              left: clipRef.current?.getBoundingClientRect().right || 0,
              top: clipRef.current?.getBoundingClientRect().top || 0,
            }}
          >
            <button className="assistant-editor-timeline-clip-menu-item" onClick={handleSplit} type="button">
              <Scissors size={14} />
              Split at Playhead
            </button>
            <button className="assistant-editor-timeline-clip-menu-item" onClick={handleDuplicate} type="button">
              <Copy size={14} />
              Duplicate
            </button>
            <button className="assistant-editor-timeline-clip-menu-item" onClick={onRemove} type="button">
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </>
      )}
    </>
  );
}

