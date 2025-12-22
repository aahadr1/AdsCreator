'use client';

import { useCallback, useState } from 'react';
import { Lock, Unlock, Eye, EyeOff, Volume2, VolumeX, GripVertical, Trash2, Plus } from 'lucide-react';
import type { Track, TimelineClip, EditorAsset } from '../../../types/editor';
import EditorTimelineClip from './EditorTimelineClip';

type EditorTimelineTrackProps = {
  track: Track;
  clips: TimelineClip[];
  assets: EditorAsset[];
  pixelsPerSecond: number;
  selectedClipIds: string[];
  onUpdateTrack: (updates: Partial<Track>) => void;
  onDeleteTrack: () => void;
  onAddClip: (clip: TimelineClip) => void;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  onRemoveClip: (clipId: string) => void;
  onSelectClip: (clipId: string, multiSelect: boolean) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  dragOverTrack: boolean;
};

export default function EditorTimelineTrack({
  track,
  clips,
  assets,
  pixelsPerSecond,
  selectedClipIds,
  onUpdateTrack,
  onDeleteTrack,
  onAddClip,
  onUpdateClip,
  onRemoveClip,
  onSelectClip,
  onDragOver,
  onDrop,
  dragOverTrack,
}: EditorTimelineTrackProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);

  const handleLockToggle = useCallback(() => {
    onUpdateTrack({ locked: !track.locked });
  }, [track.locked, onUpdateTrack]);

  const handleMuteToggle = useCallback(() => {
    onUpdateTrack({ muted: !track.muted });
  }, [track.muted, onUpdateTrack]);

  const handleVisibilityToggle = useCallback(() => {
    onUpdateTrack({ visible: !track.visible });
  }, [track.visible, onUpdateTrack]);

  const handleHeightResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const startY = e.clientY;
      const startHeight = track.height;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startY;
        const newHeight = Math.max(40, Math.min(200, startHeight + deltaY));
        onUpdateTrack({ height: newHeight });
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [track.height, onUpdateTrack]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu(true);
  }, []);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdateTrack({ name: e.target.value });
    },
    [onUpdateTrack]
  );

  const handleColorChange = useCallback(
    (color: string) => {
      onUpdateTrack({ color });
      setShowContextMenu(false);
    },
    [onUpdateTrack]
  );

  const trackClips = clips.filter((c) => c.trackId === track.id);

  const getTrackIcon = () => {
    switch (track.type) {
      case 'video':
        return '🎬';
      case 'audio':
        return '🎵';
      case 'text':
        return '✍️';
      default:
        return '📽️';
    }
  };

  const getTrackColor = () => {
    if (track.color) return track.color;
    switch (track.type) {
      case 'video':
        return 'var(--accent)';
      case 'audio':
        return 'var(--status-warn)';
      case 'text':
        return 'var(--status-good)';
      default:
        return 'var(--text-secondary)';
    }
  };

  return (
    <div
      className={`assistant-editor-timeline-track-wrapper ${track.locked ? 'locked' : ''} ${
        !track.visible ? 'hidden' : ''
      }`}
      style={{ height: track.height }}
    >
      {/* Track Header */}
      <div
        className="assistant-editor-timeline-track-header"
        style={{ borderLeftColor: getTrackColor() }}
        onContextMenu={handleContextMenu}
      >
        <div className="assistant-editor-timeline-track-info">
          <span className="assistant-editor-timeline-track-icon">{getTrackIcon()}</span>
          <input
            type="text"
            value={track.name}
            onChange={handleNameChange}
            className="assistant-editor-timeline-track-name"
            disabled={track.locked}
            placeholder={`${track.type} ${track.index + 1}`}
          />
        </div>

        <div className="assistant-editor-timeline-track-controls">
          <button
            className="assistant-editor-timeline-track-control-btn"
            onClick={handleLockToggle}
            title={track.locked ? 'Unlock track' : 'Lock track'}
            type="button"
          >
            {track.locked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>

          {track.type === 'audio' && (
            <button
              className="assistant-editor-timeline-track-control-btn"
              onClick={handleMuteToggle}
              title={track.muted ? 'Unmute track' : 'Mute track'}
              type="button"
            >
              {track.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          )}

          <button
            className="assistant-editor-timeline-track-control-btn"
            onClick={handleVisibilityToggle}
            title={track.visible ? 'Hide track' : 'Show track'}
            type="button"
          >
            {track.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>

          <button
            className="assistant-editor-timeline-track-control-btn delete"
            onClick={onDeleteTrack}
            title="Delete track"
            type="button"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Height resize handle */}
        <div
          className="assistant-editor-timeline-track-resize-handle"
          onMouseDown={handleHeightResize}
          data-timeline-interactive="true"
        >
          <GripVertical size={12} />
        </div>
      </div>

      {/* Track Content Area */}
      <div
        className={`assistant-editor-timeline-track-content ${
          dragOverTrack ? 'drag-over' : ''
        } ${track.locked ? 'locked' : ''}`}
        onDragOver={onDragOver}
        onDrop={onDrop}
        data-timeline-interactive="true"
      >
        {trackClips.map((clip) => {
          const asset = assets.find((a) => 'assetId' in clip && a.id === clip.assetId);

          return (
            <EditorTimelineClip
              key={clip.id}
              clip={clip}
              asset={asset || ({} as EditorAsset)}
              pixelsPerSecond={pixelsPerSecond}
              isSelected={selectedClipIds.includes(clip.id)}
              onUpdate={(updates) => onUpdateClip(clip.id, updates)}
              onRemove={() => onRemoveClip(clip.id)}
              onSelect={() => onSelectClip(clip.id, false)}
            />
          );
        })}

        {trackClips.length === 0 && (
          <div className="assistant-editor-timeline-track-empty">
            Drop media here or drag from assets panel
          </div>
        )}
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <>
          <div
            className="assistant-editor-timeline-track-context-menu-overlay"
            onClick={() => setShowContextMenu(false)}
          />
          <div className="assistant-editor-timeline-track-context-menu">
            <div className="assistant-editor-timeline-track-menu-section">
              <span className="assistant-editor-timeline-track-menu-label">Track Color</span>
              <div className="assistant-editor-timeline-track-color-picker">
                {[
                  '#dcdcdc',
                  '#ff6b6b',
                  '#4ecdc4',
                  '#45b7d1',
                  '#ffa07a',
                  '#98d8c8',
                  '#f7dc6f',
                  '#bb8fce',
                ].map((color) => (
                  <button
                    key={color}
                    className="assistant-editor-timeline-track-color-option"
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color)}
                    type="button"
                  />
                ))}
              </div>
            </div>

            <button
              className="assistant-editor-timeline-track-menu-item"
              onClick={() => {
                onUpdateTrack({ locked: !track.locked });
                setShowContextMenu(false);
              }}
              type="button"
            >
              {track.locked ? <Unlock size={14} /> : <Lock size={14} />}
              {track.locked ? 'Unlock Track' : 'Lock Track'}
            </button>

            <button
              className="assistant-editor-timeline-track-menu-item delete"
              onClick={() => {
                onDeleteTrack();
                setShowContextMenu(false);
              }}
              type="button"
            >
              <Trash2 size={14} />
              Delete Track
            </button>
          </div>
        </>
      )}
    </div>
  );
}

