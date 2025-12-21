'use client';

import { useRef, useCallback, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { EditorAsset, TimelineClip } from '../../../types/editor';
import EditorTimelineClip from './EditorTimelineClip';

type EditorTimelineProps = {
  assets: EditorAsset[];
  clips: TimelineClip[];
  playhead: number;
  zoom: number;
  duration: number;
  selectedClipId?: string | null;
  onAddClip: (clip: TimelineClip) => void;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  onRemoveClip: (clipId: string) => void;
  onSetPlayhead: (time: number) => void;
  onSetZoom: (zoom: number) => void;
  onSelectClip?: (clipId: string | null) => void;
};

const PIXELS_PER_SECOND = 50; // Base pixels per second at zoom 1

export default function EditorTimeline({
  assets,
  clips,
  playhead,
  zoom,
  duration,
  selectedClipId,
  onAddClip,
  onUpdateClip,
  onRemoveClip,
  onSetPlayhead,
  onSetZoom,
  onSelectClip,
}: EditorTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragOverTrack, setDragOverTrack] = useState<'video' | 'audio' | null>(null);
  const draggedAssetIdRef = useRef<string | null>(null);

  const pixelsPerSecond = PIXELS_PER_SECOND * zoom;
  const timelineWidth = Math.max(duration * pixelsPerSecond, 1000);

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = x / pixelsPerSecond;
      onSetPlayhead(Math.max(0, Math.min(time, duration)));
    },
    [pixelsPerSecond, duration, onSetPlayhead]
  );


  const handleTimelineDragOver = useCallback(
    (e: React.DragEvent, track: 'video' | 'audio') => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverTrack(track);
      
      // Get dragged asset ID from data transfer
      let assetId = e.dataTransfer.getData('text/plain');
      if (!assetId) {
        try {
          const jsonData = e.dataTransfer.getData('application/json');
          if (jsonData) {
            const data = JSON.parse(jsonData);
            assetId = data.assetId;
          }
        } catch {
          // Ignore parse errors
        }
      }
      if (assetId) {
        draggedAssetIdRef.current = assetId;
      }
    },
    []
  );

  const handleTimelineDrop = useCallback(
    (e: React.DragEvent, track: 'video' | 'audio') => {
      e.preventDefault();
      e.stopPropagation();
      
      let assetId = e.dataTransfer.getData('text/plain') || draggedAssetIdRef.current;
      if (!assetId) {
        try {
          const jsonData = e.dataTransfer.getData('application/json');
          if (jsonData) {
            const data = JSON.parse(jsonData);
            assetId = data.assetId;
          }
        } catch {
          // Ignore parse errors
        }
      }
      
      if (!assetId || !timelineRef.current) {
        setDragOverTrack(null);
        draggedAssetIdRef.current = null;
        return;
      }

      const draggedAsset = assets.find((a) => a.id === assetId);
      if (!draggedAsset) {
        setDragOverTrack(null);
        draggedAssetIdRef.current = null;
        return;
      }

      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = Math.max(0, x / pixelsPerSecond);

      const assetDuration = draggedAsset.duration || 5; // Default 5 seconds if unknown
      const clipId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      onAddClip({
        id: clipId,
        assetId: draggedAsset.id,
        track,
        startTime: time,
        endTime: time + assetDuration,
        trimStart: 0,
        trimEnd: 0,
      });

      setDragOverTrack(null);
      draggedAssetIdRef.current = null;
    },
    [assets, pixelsPerSecond, onAddClip]
  );

  const handleZoomIn = useCallback(() => {
    onSetZoom(zoom * 1.5);
  }, [zoom, onSetZoom]);

  const handleZoomOut = useCallback(() => {
    onSetZoom(zoom / 1.5);
  }, [zoom, onSetZoom]);

  const videoClips = clips.filter((c) => c.track === 'video');
  const audioClips = clips.filter((c) => c.track === 'audio');

  const playheadPosition = playhead * pixelsPerSecond;

  return (
    <div className="assistant-editor-timeline-container">
      <div className="assistant-editor-timeline-controls">
        <button className="assistant-editor-timeline-zoom" onClick={handleZoomOut} type="button">
          <ZoomOut size={16} />
        </button>
        <span className="assistant-editor-timeline-zoom-level">{zoom.toFixed(1)}x</span>
        <button className="assistant-editor-timeline-zoom" onClick={handleZoomIn} type="button">
          <ZoomIn size={16} />
        </button>
      </div>

      <div
        ref={timelineRef}
        className="assistant-editor-timeline"
        onClick={handleTimelineClick}
        onDragOver={(e) => {
          e.preventDefault();
        }}
      >
        <div className="assistant-editor-timeline-ruler">
          {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
            <div
              key={i}
              className="assistant-editor-timeline-ruler-mark"
              style={{ left: i * pixelsPerSecond }}
            >
              <div className="assistant-editor-timeline-ruler-line" />
              <div className="assistant-editor-timeline-ruler-label">{i}s</div>
            </div>
          ))}
        </div>

        <div
          className="assistant-editor-timeline-playhead"
          style={{ left: playheadPosition }}
        />

        <div
          className={`assistant-editor-timeline-track assistant-editor-timeline-track-video ${
            dragOverTrack === 'video' ? 'drag-over' : ''
          }`}
          onDragOver={(e) => handleTimelineDragOver(e, 'video')}
          onDrop={(e) => handleTimelineDrop(e, 'video')}
        >
          <div className="assistant-editor-timeline-track-label">Video</div>
          <div className="assistant-editor-timeline-track-content" style={{ width: timelineWidth }}>
            {videoClips.map((clip) => {
              const asset = assets.find((a) => a.id === clip.assetId);
              if (!asset) return null;

              return (
                <EditorTimelineClip
                  key={clip.id}
                  clip={clip}
                  asset={asset}
                  pixelsPerSecond={pixelsPerSecond}
                  isSelected={selectedClipId === clip.id}
                  onUpdate={(updates) => onUpdateClip(clip.id, updates)}
                  onRemove={() => onRemoveClip(clip.id)}
                  onSelect={() => onSelectClip?.(clip.id)}
                />
              );
            })}
          </div>
        </div>

        <div
          className={`assistant-editor-timeline-track assistant-editor-timeline-track-audio ${
            dragOverTrack === 'audio' ? 'drag-over' : ''
          }`}
          onDragOver={(e) => handleTimelineDragOver(e, 'audio')}
          onDrop={(e) => handleTimelineDrop(e, 'audio')}
        >
          <div className="assistant-editor-timeline-track-label">Audio</div>
          <div className="assistant-editor-timeline-track-content" style={{ width: timelineWidth }}>
            {audioClips.map((clip) => {
              const asset = assets.find((a) => a.id === clip.assetId);
              if (!asset) return null;

              return (
                <EditorTimelineClip
                  key={clip.id}
                  clip={clip}
                  asset={asset}
                  pixelsPerSecond={pixelsPerSecond}
                  isSelected={selectedClipId === clip.id}
                  onUpdate={(updates) => onUpdateClip(clip.id, updates)}
                  onRemove={() => onRemoveClip(clip.id)}
                  onSelect={() => onSelectClip?.(clip.id)}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="assistant-editor-timeline-asset-drag-helper"
        style={{ display: 'none' }}
        data-dragged-asset={draggedAssetIdRef.current || ''}
      />
    </div>
  );
}

