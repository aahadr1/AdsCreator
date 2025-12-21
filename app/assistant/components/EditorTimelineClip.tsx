'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { GripVertical, Scissors, Trash2, Copy } from 'lucide-react';
import type { EditorAsset, TimelineClip } from '../../../types/editor';

type EditorTimelineClipProps = {
  clip: TimelineClip;
  asset: EditorAsset;
  pixelsPerSecond: number;
  isSelected?: boolean;
  onUpdate: (updates: Partial<TimelineClip>) => void;
  onRemove: () => void;
  onSelect?: () => void;
};

export default function EditorTimelineClip({
  clip,
  asset,
  pixelsPerSecond,
  isSelected = false,
  onUpdate,
  onRemove,
  onSelect,
}: EditorTimelineClipProps) {
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Generate thumbnail for video/image assets
  useEffect(() => {
    if (thumbnail) return; // Already have thumbnail
    
    if (asset.type === 'video' && asset.url) {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const proxiedUrl = asset.url.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(asset.url)}` : asset.url;
      video.src = proxiedUrl;
      
      const handleLoadedMetadata = () => {
        if (video.duration && video.duration > 0) {
          video.currentTime = Math.min(1, video.duration * 0.1);
        } else {
          video.currentTime = 0.1;
        }
      };
      
      const handleSeeked = () => {
        try {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(video.videoWidth, 320);
            canvas.height = Math.min(video.videoHeight, 180);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              setThumbnail(canvas.toDataURL('image/jpeg', 0.8));
            }
          }
        } catch (e) {
          console.error('Failed to generate video thumbnail:', e);
        }
      };
      
      const handleError = () => {
        // If proxy fails, try direct URL
        if (video.src.includes('/api/proxy') && video.src !== asset.url) {
          video.src = asset.url;
        }
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('seeked', handleSeeked);
      video.addEventListener('error', handleError);
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('error', handleError);
      };
    } else if (asset.type === 'image' && asset.url) {
      setThumbnail(asset.url);
    }
  }, [asset.type, asset.url, thumbnail]);

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
        className={`assistant-editor-timeline-clip ${isSelected ? 'selected' : ''}`}
        style={{
          left: clipStart,
          width: clipWidth,
          backgroundColor: getClipColor(),
        }}
        onMouseDown={(e) => {
          if (onSelect && e.button === 0) {
            onSelect();
          }
          handleClipDrag(e);
        }}
        onContextMenu={handleContextMenu}
      >
        <div className="assistant-editor-timeline-clip-resize-handle left" onMouseDown={(e) => handleMouseDown(e, 'left')}>
          <GripVertical size={12} />
        </div>
        <div className="assistant-editor-timeline-clip-content">
          {thumbnail && (asset.type === 'video' || asset.type === 'image') ? (
            <div className="assistant-editor-timeline-clip-thumbnail">
              <img
                src={thumbnail.startsWith('data:') ? thumbnail : (thumbnail.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(thumbnail)}` : thumbnail)}
                alt={asset.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src.includes('/api/proxy') && target.src !== thumbnail) {
                    target.src = thumbnail;
                  } else if (target.src !== thumbnail) {
                    target.src = thumbnail;
                  }
                }}
              />
            </div>
          ) : (
            <>
              <div className="assistant-editor-timeline-clip-name">{asset.name}</div>
              <div className="assistant-editor-timeline-clip-time">
                {clip.startTime.toFixed(1)}s - {clip.endTime.toFixed(1)}s
              </div>
            </>
          )}
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

