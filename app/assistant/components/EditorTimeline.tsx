'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
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
  playing: boolean;
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
  playing,
  onAddClip,
  onUpdateClip,
  onRemoveClip,
  onSetPlayhead,
  onSetZoom,
  onSelectClip,
}: EditorTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [dragOverTrack, setDragOverTrack] = useState<'video' | 'audio' | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const draggedAssetIdRef = useRef<string | null>(null);

  const pixelsPerSecond = PIXELS_PER_SECOND * zoom;
  const MIN_VIRTUAL_DURATION = 60;
  const DURATION_BUFFER = 30;
  const [virtualDuration, setVirtualDuration] = useState(
    Math.max(duration + DURATION_BUFFER, MIN_VIRTUAL_DURATION),
  );

  const ensureVirtualDuration = useCallback((time: number) => {
    setVirtualDuration((prev) => {
      const target = Math.max(time + DURATION_BUFFER, MIN_VIRTUAL_DURATION);
      return target > prev ? target : prev;
    });
  }, []);

  useEffect(() => {
    setVirtualDuration((prev) => {
      const target = Math.max(duration + DURATION_BUFFER, playhead + DURATION_BUFFER, MIN_VIRTUAL_DURATION);
      return target > prev ? target : prev;
    });
  }, [duration, playhead]);

  const timelineWidth = Math.max(virtualDuration * pixelsPerSecond, 1000);

  const getEventTime = useCallback(
    (clientX: number) => {
      if (!contentRef.current || !scrollRef.current) return 0;
      const rect = contentRef.current.getBoundingClientRect();
      const scrollLeft = scrollRef.current.scrollLeft;
      const x = clientX - rect.left + scrollLeft;
      return Math.max(0, x / pixelsPerSecond);
    },
    [pixelsPerSecond],
  );

  const isInteractiveTarget = useCallback((eventTarget: EventTarget | null): boolean => {
    if (!(eventTarget instanceof HTMLElement)) return false;
    return Boolean(eventTarget.closest('[data-timeline-interactive="true"]'));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (isInteractiveTarget(e.target)) return;
      const time = getEventTime(e.clientX);
      ensureVirtualDuration(time);
      onSetPlayhead(time);
      setIsScrubbing(true);
      e.preventDefault();
    },
    [ensureVirtualDuration, getEventTime, isInteractiveTarget, onSetPlayhead],
  );

  useEffect(() => {
    if (!isScrubbing) return;
    const handleMove = (e: MouseEvent) => {
      const time = getEventTime(e.clientX);
      ensureVirtualDuration(time);
      onSetPlayhead(time);
    };
    const handleUp = () => setIsScrubbing(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isScrubbing, ensureVirtualDuration, getEventTime, onSetPlayhead]);

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
    [],
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
      
      if (!assetId || !contentRef.current || !scrollRef.current) {
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

      const rect = contentRef.current.getBoundingClientRect();
      const scrollLeft = scrollRef.current.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft;
      const time = Math.max(0, x / pixelsPerSecond);
      ensureVirtualDuration(time + (draggedAsset.duration || 0));

      const assetDuration = draggedAsset.duration || 5; // Default 5 seconds if unknown
      const clipId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Note: This needs refactoring to use trackId instead of track
      // For now, create a basic media clip
      const trackId = track === 'video' ? 'track-video-1' : 'track-audio-1';
      onAddClip({
        id: clipId,
        type: draggedAsset.type as 'video' | 'audio' | 'image',
        trackId,
        assetId: draggedAsset.id,
        startTime: time,
        endTime: time + assetDuration,
        locked: false,
        trimStart: 0,
        trimEnd: 0,
        transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, anchorX: 0.5, anchorY: 0.5 },
        keyframes: [],
        filters: [],
        blendMode: 'normal' as const,
      } as any);

      setDragOverTrack(null);
      draggedAssetIdRef.current = null;
    },
    [assets, pixelsPerSecond, onAddClip, ensureVirtualDuration],
  );

  const handleZoomIn = useCallback(() => {
    onSetZoom(zoom * 1.5);
  }, [zoom, onSetZoom]);

  const handleZoomOut = useCallback(() => {
    onSetZoom(zoom / 1.5);
  }, [zoom, onSetZoom]);

  // Filter clips by checking their asset type
  const videoClips = clips.filter((c) => {
    if (!('assetId' in c)) return false;
    const asset = assets.find((a) => a.id === c.assetId);
    return asset && (asset.type === 'video' || asset.type === 'image');
  });
  const audioClips = clips.filter((c) => {
    if (!('assetId' in c)) return false;
    const asset = assets.find((a) => a.id === c.assetId);
    return asset && asset.type === 'audio';
  });

  const playheadPosition = playhead * pixelsPerSecond;

  useEffect(() => {
    if (!scrollRef.current || !playing) return;
    const viewportWidth = scrollRef.current.clientWidth;
    const scrollLeft = scrollRef.current.scrollLeft;
    const padding = viewportWidth * 0.15;
    if (playheadPosition < scrollLeft + padding) {
      scrollRef.current.scrollLeft = Math.max(playheadPosition - padding, 0);
    } else if (playheadPosition > scrollLeft + viewportWidth - padding) {
      scrollRef.current.scrollLeft = playheadPosition - viewportWidth + padding;
    }
  }, [playheadPosition, playing]);

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
        className="assistant-editor-timeline-body"
      >
        <div className="assistant-editor-timeline-label-column">
          <div className="assistant-editor-timeline-label-spacer" />
          <div className="assistant-editor-timeline-track-label">Video</div>
          <div className="assistant-editor-timeline-track-label">Audio</div>
        </div>

        <div className="assistant-editor-timeline-scroll" ref={scrollRef}>
          <div
            className="assistant-editor-timeline-content"
            ref={contentRef}
            style={{ width: timelineWidth }}
            onMouseDown={handlePointerDown}
          >
            <div className="assistant-editor-timeline-ruler">
              {Array.from({ length: Math.ceil(virtualDuration) + 1 }).map((_, i) => (
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
              style={{ transform: `translateX(${playheadPosition}px)` }}
            />

            <div
              className={`assistant-editor-timeline-track assistant-editor-timeline-track-video ${
                dragOverTrack === 'video' ? 'drag-over' : ''
              }`}
              onDragOver={(e) => handleTimelineDragOver(e, 'video')}
              onDrop={(e) => handleTimelineDrop(e, 'video')}
            >
              <div className="assistant-editor-timeline-track-content">
                {videoClips.map((clip) => {
                  if (!('assetId' in clip)) return null;
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
              <div className="assistant-editor-timeline-track-content">
                {audioClips.map((clip) => {
                  if (!('assetId' in clip)) return null;
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
