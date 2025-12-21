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
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
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
    // Clear selected asset when playing to show timeline composition
    if (playing) {
      setSelectedAssetId(null);
    }
  }, []);

  // Timeline playback loop - advances playhead when playing
  useEffect(() => {
    if (!editorState.playing) return;

    const interval = setInterval(() => {
      setEditorState((prev) => {
        const speed = prev.playbackSpeed || 1;
        const newPlayhead = prev.playhead + (speed / 60); // Account for playback speed
        if (newPlayhead >= prev.duration) {
          // Reached end of timeline, stop playback
          return {
            ...prev,
            playhead: prev.duration,
            playing: false,
          };
        }
        return {
          ...prev,
          playhead: newPlayhead,
        };
      });
    }, 1000 / 60); // 60fps

    return () => clearInterval(interval);
  }, [editorState.playing, editorState.duration, editorState.playbackSpeed]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ': // Space - play/pause
          e.preventDefault();
          handleSetPlaying(!editorState.playing);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSetPlayhead(Math.max(0, editorState.playhead - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSetPlayhead(Math.min(editorState.duration, editorState.playhead + 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleSetPlayhead(Math.min(editorState.duration, editorState.playhead + 10));
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleSetPlayhead(Math.max(0, editorState.playhead - 10));
          break;
        case 'Delete':
        case 'Backspace':
          if (editorState.selectedClipId) {
            e.preventDefault();
            handleRemoveClip(editorState.selectedClipId);
            setEditorState((prev) => ({ ...prev, selectedClipId: null }));
          }
          break;
        case 's':
        case 'S':
          if (editorState.selectedClipId && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            // Split clip at playhead
            const clip = editorState.clips.find((c) => c.id === editorState.selectedClipId);
            if (clip && editorState.playhead > clip.startTime && editorState.playhead < clip.endTime) {
              const splitTime = editorState.playhead;
              const firstClip: TimelineClip = {
                ...clip,
                endTime: splitTime,
                trimEnd: clip.trimEnd + (clip.endTime - splitTime),
              };
              const secondClip: TimelineClip = {
                ...clip,
                id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                startTime: splitTime,
                trimStart: clip.trimStart + (splitTime - clip.startTime),
              };
              handleUpdateClip(clip.id, { endTime: firstClip.endTime, trimEnd: firstClip.trimEnd });
              handleAddClip(secondClip);
            }
          }
          break;
        case 'd':
        case 'D':
          if (editorState.selectedClipId && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            // Duplicate clip
            const clip = editorState.clips.find((c) => c.id === editorState.selectedClipId);
            if (clip) {
              const newClip: TimelineClip = {
                ...clip,
                id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                startTime: clip.endTime + 0.1,
                endTime: clip.endTime + 0.1 + (clip.endTime - clip.startTime),
              };
              handleAddClip(newClip);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editorState.playing, editorState.playhead, editorState.duration, editorState.selectedClipId, editorState.clips, handleSetPlaying, handleSetPlayhead, handleRemoveClip, handleAddClip]);

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
              selectedAssetId={selectedAssetId}
              onAddAsset={handleAddAsset}
              onRemoveAsset={handleRemoveAsset}
              onSelectAsset={setSelectedAssetId}
            />
          </div>

          <div className="assistant-editor-main">
            <div className="assistant-editor-preview-panel">
              <EditorPreviewPanel
                assets={editorState.assets}
                clips={editorState.clips}
                playhead={editorState.playhead}
                playing={editorState.playing}
                selectedAssetId={selectedAssetId}
                selectedClipId={editorState.selectedClipId}
                volume={editorState.volume || 1}
                playbackSpeed={editorState.playbackSpeed || 1}
                onSetPlayhead={handleSetPlayhead}
                onSetPlaying={handleSetPlaying}
              />
            </div>

            <div className="assistant-editor-controls">
              <EditorControls
                playhead={editorState.playhead}
                duration={editorState.duration}
                playing={editorState.playing}
                volume={editorState.volume || 1}
                playbackSpeed={editorState.playbackSpeed || 1}
                onSetPlayhead={handleSetPlayhead}
                onSetPlaying={handleSetPlaying}
                onSetVolume={(volume) => setEditorState((prev) => ({ ...prev, volume }))}
                onSetPlaybackSpeed={(speed) => setEditorState((prev) => ({ ...prev, playbackSpeed: speed }))}
                onExport={() => {
                  // Export functionality will be implemented
                  console.log('Export clicked');
                }}
              />
            </div>

            <div className="assistant-editor-timeline">
              <EditorTimeline
                assets={editorState.assets}
                clips={editorState.clips}
                playhead={editorState.playhead}
                zoom={editorState.zoom}
                duration={editorState.duration}
                selectedClipId={editorState.selectedClipId}
                onAddClip={handleAddClip}
                onUpdateClip={handleUpdateClip}
                onRemoveClip={handleRemoveClip}
                onSetPlayhead={handleSetPlayhead}
                onSetZoom={handleSetZoom}
                onSelectClip={(clipId) => {
                  setEditorState((prev) => ({ ...prev, selectedClipId: clipId }));
                  setSelectedAssetId(null); // Clear asset selection when clip is selected
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

