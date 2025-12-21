'use client';

import { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import type { EditorAsset, TimelineClip, EditorState } from '../../../types/editor';
import EditorAssetPanel from './EditorAssetPanel';
import EditorPreviewPanel from './EditorPreviewPanel';
import EditorTimeline from './EditorTimeline';
import EditorControls from './EditorControls';

type AssistantEditorProps = {
  isOpen: boolean;
  onClose: () => void;
  initialAssets?: EditorAsset[];
};

export default function AssistantEditor({ isOpen, onClose, initialAssets = [] }: AssistantEditorProps) {
  const [editorState, setEditorState] = useState<EditorState>({
    assets: initialAssets,
    clips: [],
    playhead: 0,
    zoom: 1,
    duration: 0,
    playing: false,
  });

  // Update assets when initialAssets change
  useEffect(() => {
    if (initialAssets.length > 0) {
      setEditorState((prev) => ({
        ...prev,
        assets: initialAssets,
      }));
    }
  }, [initialAssets]);

  const handleAddAsset = useCallback((asset: EditorAsset) => {
    setEditorState((prev) => ({
      ...prev,
      assets: [...prev.assets, asset],
    }));
  }, []);

  const handleRemoveAsset = useCallback((assetId: string) => {
    setEditorState((prev) => ({
      ...prev,
      assets: prev.assets.filter((a) => a.id !== assetId),
      clips: prev.clips.filter((c) => c.assetId !== assetId),
    }));
  }, []);

  const handleAddClip = useCallback((clip: TimelineClip) => {
    setEditorState((prev) => {
      const newClips = [...prev.clips, clip].sort((a, b) => a.startTime - b.startTime);
      const maxEnd = Math.max(...newClips.map((c) => c.endTime), 0);
      return {
        ...prev,
        clips: newClips,
        duration: Math.max(prev.duration, maxEnd),
      };
    });
  }, []);

  const handleUpdateClip = useCallback((clipId: string, updates: Partial<TimelineClip>) => {
    setEditorState((prev) => {
      const newClips = prev.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c));
      const maxEnd = Math.max(...newClips.map((c) => c.endTime), 0);
      return {
        ...prev,
        clips: newClips,
        duration: Math.max(prev.duration, maxEnd),
      };
    });
  }, []);

  const handleRemoveClip = useCallback((clipId: string) => {
    setEditorState((prev) => {
      const newClips = prev.clips.filter((c) => c.id !== clipId);
      const maxEnd = newClips.length > 0 ? Math.max(...newClips.map((c) => c.endTime), 0) : 0;
      return {
        ...prev,
        clips: newClips,
        duration: maxEnd,
      };
    });
  }, []);

  const handleSetPlayhead = useCallback((time: number) => {
    setEditorState((prev) => ({
      ...prev,
      playhead: Math.max(0, Math.min(time, prev.duration)),
    }));
  }, []);

  const handleSetZoom = useCallback((zoom: number) => {
    setEditorState((prev) => ({
      ...prev,
      zoom: Math.max(0.1, Math.min(zoom, 10)),
    }));
  }, []);

  const handleSetPlaying = useCallback((playing: boolean) => {
    setEditorState((prev) => ({
      ...prev,
      playing,
    }));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="assistant-editor-popup-overlay" onClick={onClose}>
      <div className="assistant-editor-popup" onClick={(e) => e.stopPropagation()}>
        <div className="assistant-editor-header">
          <h2>Assistant Editor</h2>
          <button className="assistant-editor-close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="assistant-editor-content">
          <div className="assistant-editor-asset-panel">
            <EditorAssetPanel
              assets={editorState.assets}
              onAddAsset={handleAddAsset}
              onRemoveAsset={handleRemoveAsset}
            />
          </div>

          <div className="assistant-editor-main">
            <div className="assistant-editor-preview-panel">
              <EditorPreviewPanel
                assets={editorState.assets}
                clips={editorState.clips}
                playhead={editorState.playhead}
                playing={editorState.playing}
                onSetPlayhead={handleSetPlayhead}
                onSetPlaying={handleSetPlaying}
              />
            </div>

            <div className="assistant-editor-controls">
              <EditorControls
                playhead={editorState.playhead}
                duration={editorState.duration}
                playing={editorState.playing}
                onSetPlayhead={handleSetPlayhead}
                onSetPlaying={handleSetPlaying}
              />
            </div>

            <div className="assistant-editor-timeline">
              <EditorTimeline
                assets={editorState.assets}
                clips={editorState.clips}
                playhead={editorState.playhead}
                zoom={editorState.zoom}
                duration={editorState.duration}
                onAddClip={handleAddClip}
                onUpdateClip={handleUpdateClip}
                onRemoveClip={handleRemoveClip}
                onSetPlayhead={handleSetPlayhead}
                onSetZoom={handleSetZoom}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

