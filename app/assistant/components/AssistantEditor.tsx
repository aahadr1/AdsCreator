'use client';

import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import EditorTimeline from './EditorTimeline';
import EditorControls from './EditorControls';
import EditorAssetPanel from './EditorAssetPanel';
import type { EditorAsset } from '../../../types/editor';

type AssistantEditorProps = {
  isOpen: boolean;
  onClose: () => void;
  initialAssets?: EditorAsset[];
};

type TimelineClip = {
  id: string;
  assetId: string;
  startTime: number; // in seconds
  duration: number; // in seconds
  track: number;
};

export default function AssistantEditor({
  isOpen,
  onClose,
  initialAssets = [],
}: AssistantEditorProps) {
  const [assets, setAssets] = useState<EditorAsset[]>(initialAssets);
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(30); // 30 seconds default

  const handleAddAsset = useCallback((asset: EditorAsset) => {
    setAssets((prev) => [...prev, asset]);
  }, []);

  const handleAddClip = useCallback((asset: EditorAsset, time: number) => {
    const newClip: TimelineClip = {
      id: `clip-${Date.now()}`,
      assetId: asset.id,
      startTime: time,
      duration: asset.duration || 5,
      track: 0,
    };
    setClips((prev) => [...prev, newClip]);
    
    // Update total duration if needed
    const clipEnd = newClip.startTime + newClip.duration;
    if (clipEnd > duration) {
      setDuration(clipEnd);
    }
  }, [duration]);

  const handleRemoveClip = useCallback((clipId: string) => {
    setClips((prev) => prev.filter((c) => c.id !== clipId));
  }, []);

  const handleUpdateClip = useCallback((clipId: string, updates: Partial<TimelineClip>) => {
    setClips((prev) =>
      prev.map((clip) =>
        clip.id === clipId ? { ...clip, ...updates } : clip
      )
    );
  }, []);

  if (!isOpen) return null;

  return (
    <div className="assistant-editor-overlay" onClick={onClose}>
      <div className="assistant-editor-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="assistant-editor-header">
          <h2>Video Editor</h2>
          <button
            className="assistant-editor-close-btn"
            onClick={onClose}
            type="button"
            title="Close Editor"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Editor Area */}
        <div className="assistant-editor-main">
          {/* Asset Panel */}
          <EditorAssetPanel assets={assets} onAddAsset={handleAddAsset} />

          {/* Preview Panel */}
          <div className="assistant-editor-preview">
            {clips.length > 0 ? (
              <div className="assistant-editor-preview-content">
                <video
                  className="assistant-editor-video-preview"
                  controls
                  src={assets.find((a) => a.id === clips[0]?.assetId)?.url}
                />
              </div>
            ) : (
              <div className="assistant-editor-preview-empty">
                <p>No clips on timeline</p>
                <p className="text-sm text-gray-500">Drag media to the timeline to start editing</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <EditorControls
            playhead={playhead}
            duration={duration}
            playing={playing}
            onSetPlayhead={setPlayhead}
            onSetPlaying={setPlaying}
          />

          {/* Timeline */}
          <EditorTimeline
            assets={assets}
            clips={clips}
            playhead={playhead}
            duration={duration}
            onAddClip={handleAddClip}
            onRemoveClip={handleRemoveClip}
            onUpdateClip={handleUpdateClip}
            onSetPlayhead={setPlayhead}
          />
        </div>
      </div>
    </div>
  );
}

