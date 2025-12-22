'use client';

import { useCallback, useRef, useState } from 'react';
import type { EditorAsset } from '../../../types/editor';

type TimelineClip = {
  id: string;
  assetId: string;
  startTime: number;
  duration: number;
  track: number;
};

type EditorTimelineProps = {
  assets: EditorAsset[];
  clips: TimelineClip[];
  playhead: number;
  duration: number;
  onAddClip: (asset: EditorAsset, time: number) => void;
  onRemoveClip: (clipId: string) => void;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  onSetPlayhead: (time: number) => void;
};

export default function EditorTimeline({
  assets,
  clips,
  playhead,
  duration,
  onAddClip,
  onRemoveClip,
  onUpdateClip,
  onSetPlayhead,
}: EditorTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [draggingClip, setDraggingClip] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const pixelsPerSecond = 50; // 50px per second

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = x / pixelsPerSecond;
    onSetPlayhead(Math.max(0, Math.min(time, duration)));
  }, [duration, onSetPlayhead, pixelsPerSecond]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = x / pixelsPerSecond;

      const assetId = e.dataTransfer.getData('assetId');
      const asset = assets.find((a) => a.id === assetId);
      
      if (asset) {
        onAddClip(asset, Math.max(0, time));
      }
    },
    [assets, onAddClip, pixelsPerSecond]
  );

  const handleClipMouseDown = useCallback((clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingClip(clipId);
    setSelectedClip(clipId);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingClip || !timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newTime = Math.max(0, x / pixelsPerSecond);

      onUpdateClip(draggingClip, { startTime: newTime });
    },
    [draggingClip, onUpdateClip, pixelsPerSecond]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingClip(null);
  }, []);

  // Add/remove mouse event listeners for dragging
  if (draggingClip) {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  } else {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }

  return (
    <div className="assistant-editor-timeline-container">
      <div className="assistant-editor-timeline-header">
        <span>Timeline</span>
        <span className="text-sm text-gray-500">{duration.toFixed(1)}s</span>
      </div>

      <div
        ref={timelineRef}
        className="assistant-editor-timeline"
        onClick={handleTimelineClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          width: `${duration * pixelsPerSecond}px`,
          minWidth: '100%',
        }}
      >
        {/* Playhead */}
        <div
          className="assistant-editor-playhead"
          style={{
            left: `${playhead * pixelsPerSecond}px`,
          }}
        />

        {/* Clips */}
        {clips.map((clip) => {
          const asset = assets.find((a) => a.id === clip.assetId);
          return (
            <div
              key={clip.id}
              className={`assistant-editor-clip ${selectedClip === clip.id ? 'selected' : ''}`}
              style={{
                left: `${clip.startTime * pixelsPerSecond}px`,
                width: `${clip.duration * pixelsPerSecond}px`,
                top: `${clip.track * 60 + 40}px`,
              }}
              onMouseDown={(e) => handleClipMouseDown(clip.id, e)}
            >
              <div className="assistant-editor-clip-content">
                <span className="assistant-editor-clip-name">{asset?.name || 'Unknown'}</span>
                <button
                  className="assistant-editor-clip-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveClip(clip.id);
                  }}
                  type="button"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

