'use client';

import { useState, useCallback, useEffect, useReducer } from 'react';
import { X, Settings } from 'lucide-react';
import type {
  EditorAsset,
  TimelineClip,
  EditorState,
  EditorSequence,
  Track,
  EditorTool,
  TextClip,
} from '../../../types/editor';
import {
  DEFAULT_FPS,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_TRACK_HEIGHT,
  DEFAULT_TRANSFORM,
} from '../../../types/editor';
import EditorAssetPanel from './EditorAssetPanel';
import EditorPreviewPanel from './EditorPreviewPanel';
import EditorTimeline from './EditorTimeline';
import EditorControls from './EditorControls';
import EditorToolbar from './EditorToolbar';
import EditorInspectorPanel from './EditorInspectorPanel';
import EditorKeyframePanel from './EditorKeyframePanel';
import EditorTextPanel from './EditorTextPanel';
import EditorSequenceManager from './EditorSequenceManager';
import EditorShortcutsPanel from './EditorShortcutsPanel';
import EditorTransformControls from './EditorTransformControls';
import { editorHistory } from '../../../lib/editorHistory';
import { exportVideo, downloadBlob } from '../../../lib/clientRenderer';

type AssistantEditorProps = {
  isOpen: boolean;
  onClose: () => void;
  initialAssets?: EditorAsset[];
};

// Initialize default sequence
function createDefaultSequence(): EditorSequence {
  return {
    id: 'sequence-main',
    name: 'Main Sequence',
    tracks: [
      {
        id: 'track-video-1',
        type: 'video',
        name: 'Video 1',
        index: 2,
        height: DEFAULT_TRACK_HEIGHT,
        locked: false,
        muted: false,
        visible: true,
      },
      {
        id: 'track-audio-1',
        type: 'audio',
        name: 'Audio 1',
        index: 1,
        height: DEFAULT_TRACK_HEIGHT,
        locked: false,
        muted: false,
        visible: true,
      },
      {
        id: 'track-text-1',
        type: 'text',
        name: 'Text 1',
        index: 0,
        height: DEFAULT_TRACK_HEIGHT,
        locked: false,
        muted: false,
        visible: true,
      },
    ],
    clips: [],
    markers: [],
    regions: [],
    duration: 60,
    fps: DEFAULT_FPS,
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
  };
}

export default function AssistantEditor({
  isOpen,
  onClose,
  initialAssets = [],
}: AssistantEditorProps) {
  const [editorState, setEditorState] = useState<EditorState>({
    currentSequenceId: 'sequence-main',
    sequences: {
      'sequence-main': createDefaultSequence(),
    },
    assets: initialAssets,
    playhead: 0,
    playing: false,
    loop: false,
    volume: 1,
    playbackSpeed: 1,
    zoom: 1,
    verticalZoom: 1,
    selectedClipIds: [],
    selectedTrackId: null,
    activeTool: 'select',
    snapEnabled: true,
    snapTolerance: 100,
    magneticTimeline: true,
    showWaveforms: false,
    showThumbnails: true,
    history: [],
    historyIndex: -1,
    panels: {
      assets: true,
      inspector: true,
      keyframes: false,
      effects: false,
      text: false,
    },
    exportSettings: {
      format: 'mp4',
      resolution: '1080p',
      quality: 'high',
      fps: 30,
      codec: 'h264',
    },
  });

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTextPanel, setShowTextPanel] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const currentSequence = editorState.sequences[editorState.currentSequenceId];

  // Update assets when initialAssets change
  useEffect(() => {
    if (initialAssets.length > 0) {
      setEditorState((prev) => ({
        ...prev,
        assets: initialAssets,
      }));
    }
  }, [initialAssets]);

  // Handlers for assets
  const handleAddAsset = useCallback((asset: EditorAsset) => {
    setEditorState((prev) => ({
      ...prev,
      assets: [...prev.assets, asset],
    }));
  }, []);

  const handleRemoveAsset = useCallback((assetId: string) => {
    setEditorState((prev) => {
      const updatedSequences = { ...prev.sequences };
      Object.keys(updatedSequences).forEach((seqId) => {
        updatedSequences[seqId] = {
          ...updatedSequences[seqId],
          clips: updatedSequences[seqId].clips.filter(
            (c) => !('assetId' in c) || c.assetId !== assetId
          ),
        };
      });

      return {
        ...prev,
        assets: prev.assets.filter((a) => a.id !== assetId),
        sequences: updatedSequences,
      };
    });
  }, []);

  // Handlers for clips
  const handleAddClip = useCallback((clip: TimelineClip) => {
    setEditorState((prev) => {
      const sequence = prev.sequences[prev.currentSequenceId];
      const newClips = [...sequence.clips, clip];
      const maxEnd = Math.max(...newClips.map((c) => c.endTime), sequence.duration);

      return {
        ...prev,
        sequences: {
          ...prev.sequences,
          [prev.currentSequenceId]: {
            ...sequence,
            clips: newClips,
            duration: maxEnd,
          },
        },
      };
    });
  }, []);

  const handleUpdateClip = useCallback((clipId: string, updates: Partial<TimelineClip>) => {
    setEditorState((prev) => {
      const sequence = prev.sequences[prev.currentSequenceId];
      const newClips = sequence.clips.map((c) =>
        c.id === clipId ? ({ ...c, ...updates } as TimelineClip) : c
      );
      const maxEnd = Math.max(...newClips.map((c) => c.endTime), 0);

      return {
        ...prev,
        sequences: {
          ...prev.sequences,
          [prev.currentSequenceId]: {
            ...sequence,
            clips: newClips,
            duration: Math.max(sequence.duration, maxEnd),
          },
        },
      };
    });
  }, []);

  const handleRemoveClip = useCallback((clipId: string) => {
    setEditorState((prev) => {
      const sequence = prev.sequences[prev.currentSequenceId];
      const newClips = sequence.clips.filter((c) => c.id !== clipId);

      return {
        ...prev,
        sequences: {
          ...prev.sequences,
          [prev.currentSequenceId]: {
            ...sequence,
            clips: newClips,
          },
        },
        selectedClipIds: prev.selectedClipIds.filter((id) => id !== clipId),
      };
    });
  }, []);

  const handleSelectClip = useCallback((clipId: string, multiSelect: boolean) => {
    setEditorState((prev) => {
      if (multiSelect) {
        const isSelected = prev.selectedClipIds.includes(clipId);
        return {
          ...prev,
          selectedClipIds: isSelected
            ? prev.selectedClipIds.filter((id) => id !== clipId)
            : [...prev.selectedClipIds, clipId],
        };
      }
      return {
        ...prev,
        selectedClipIds: [clipId],
      };
    });
  }, []);

  // Handlers for tracks
  const handleAddTrack = useCallback((type: Track['type']) => {
    setEditorState((prev) => {
      const sequence = prev.sequences[prev.currentSequenceId];
      const maxIndex = Math.max(...sequence.tracks.map((t) => t.index), -1);

      const newTrack: Track = {
        id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        name: `${type} ${sequence.tracks.filter((t) => t.type === type).length + 1}`,
        index: maxIndex + 1,
        height: DEFAULT_TRACK_HEIGHT,
        locked: false,
        muted: false,
        visible: true,
      };

      return {
        ...prev,
        sequences: {
          ...prev.sequences,
          [prev.currentSequenceId]: {
            ...sequence,
            tracks: [...sequence.tracks, newTrack],
          },
        },
      };
    });
  }, []);

  const handleUpdateTrack = useCallback((trackId: string, updates: Partial<Track>) => {
    setEditorState((prev) => {
      const sequence = prev.sequences[prev.currentSequenceId];
      const newTracks = sequence.tracks.map((t) =>
        t.id === trackId ? { ...t, ...updates } : t
      );

      return {
        ...prev,
        sequences: {
          ...prev.sequences,
          [prev.currentSequenceId]: {
            ...sequence,
            tracks: newTracks,
          },
        },
      };
    });
  }, []);

  const handleDeleteTrack = useCallback((trackId: string) => {
    setEditorState((prev) => {
      const sequence = prev.sequences[prev.currentSequenceId];

      return {
        ...prev,
        sequences: {
          ...prev.sequences,
          [prev.currentSequenceId]: {
            ...sequence,
            tracks: sequence.tracks.filter((t) => t.id !== trackId),
            clips: sequence.clips.filter((c) => c.trackId !== trackId),
          },
        },
      };
    });
  }, []);

  // Handlers for text clips
  const handleAddTextClip = useCallback((textClip: Omit<TextClip, 'id'>) => {
    const clip: TextClip = {
      ...textClip,
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    handleAddClip(clip);
  }, [handleAddClip]);

  // Playback handlers
  const handleSetPlayhead = useCallback((time: number) => {
    setEditorState((prev) => {
      const sequence = prev.sequences[prev.currentSequenceId];
      return {
        ...prev,
        playhead: Math.max(0, Math.min(time, sequence.duration)),
      };
    });
  }, []);

  const handleSetPlaying = useCallback((playing: boolean) => {
    setEditorState((prev) => ({
      ...prev,
      playing,
    }));
  }, []);

  // History handlers
  const handleUndo = useCallback(() => {
    if (editorHistory.canUndo(editorState)) {
      const newState = editorHistory.undo(editorState);
      setEditorState(newState);
    }
  }, [editorState]);

  const handleRedo = useCallback(() => {
    if (editorHistory.canRedo(editorState)) {
      const newState = editorHistory.redo(editorState);
      setEditorState(newState);
    }
  }, [editorState]);

  // Export handler
  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportProgress(0);

    try {
      await exportVideo(
        currentSequence,
        editorState.assets,
        {
          format: 'webm',
          quality: editorState.exportSettings.quality,
          fps: editorState.exportSettings.fps,
          width: currentSequence.width,
          height: currentSequence.height,
        },
        {
          onProgress: (progress) => {
            setExportProgress(progress.progress);
          },
          onComplete: (blob) => {
            downloadBlob(blob, `${currentSequence.name}-${Date.now()}.webm`);
            setExporting(false);
            setExportProgress(0);
          },
          onError: (error) => {
            console.error('Export error:', error);
            alert(`Export failed: ${error.message}`);
            setExporting(false);
            setExportProgress(0);
          },
        }
      );
    } catch (error) {
      console.error('Export error:', error);
      setExporting(false);
      setExportProgress(0);
    }
  }, [currentSequence, editorState.assets, editorState.exportSettings]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Playback
      if (e.key === ' ') {
        e.preventDefault();
        handleSetPlaying(!editorState.playing);
      }

      // Undo/Redo
      if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (cmdOrCtrl && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleRedo();
      }

      // Tools
      if (e.key === 'v') setEditorState((prev) => ({ ...prev, activeTool: 'select' }));
      if (e.key === 'c') setEditorState((prev) => ({ ...prev, activeTool: 'razor' }));
      if (e.key === 'y') setEditorState((prev) => ({ ...prev, activeTool: 'slip' }));
      if (e.key === 't') setShowTextPanel(true);

      // Delete
      if ((e.key === 'Delete' || e.key === 'Backspace') && editorState.selectedClipIds.length > 0) {
        e.preventDefault();
        editorState.selectedClipIds.forEach(handleRemoveClip);
      }

      // Show shortcuts
      if (e.key === '?') {
        setShowShortcuts(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editorState.playing, editorState.selectedClipIds, handleSetPlaying, handleUndo, handleRedo, handleRemoveClip]);

  if (!isOpen) return null;

  const selectedClips = currentSequence.clips.filter((c) =>
    editorState.selectedClipIds.includes(c.id)
  );

  return (
    <div className="assistant-editor-popup-overlay" onClick={onClose}>
      <div className="assistant-editor-popup" onClick={(e) => e.stopPropagation()}>
        <div className="assistant-editor-header">
          <div className="assistant-editor-header-left">
            <h2>Video Editor</h2>
            <span className="assistant-editor-header-sequence">{currentSequence.name}</span>
          </div>
          <div className="assistant-editor-header-right">
            {exporting && (
              <div className="assistant-editor-export-progress">
                Exporting: {exportProgress.toFixed(0)}%
              </div>
            )}
            <button
              className="assistant-editor-close"
              onClick={onClose}
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <EditorToolbar
          activeTool={editorState.activeTool}
          onSelectTool={(tool) => setEditorState((prev) => ({ ...prev, activeTool: tool }))}
          canUndo={editorHistory.canUndo(editorState)}
          canRedo={editorHistory.canRedo(editorState)}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />

        <div className="assistant-editor-content">
          {editorState.panels.assets && (
            <div className="assistant-editor-asset-panel">
              <EditorAssetPanel
                assets={editorState.assets}
                selectedAssetId={null}
                onAddAsset={handleAddAsset}
                onRemoveAsset={handleRemoveAsset}
                onSelectAsset={() => {}}
              />
            </div>
          )}

          <div className="assistant-editor-main">
            <div className="assistant-editor-preview-container">
              <EditorPreviewPanel
                assets={editorState.assets}
                clips={currentSequence.clips}
                tracks={currentSequence.tracks}
                playhead={editorState.playhead}
                playing={editorState.playing}
                volume={editorState.volume}
                playbackSpeed={editorState.playbackSpeed}
                canvasWidth={currentSequence.width}
                canvasHeight={currentSequence.height}
                onSetPlayhead={handleSetPlayhead}
                onSetPlaying={handleSetPlaying}
                onUpdateClip={handleUpdateClip}
              />
              
              {/* Transform Controls */}
              {editorState.selectedClipIds.length === 1 && (() => {
                const selectedClip = currentSequence.clips.find(c => c.id === editorState.selectedClipIds[0]);
                return selectedClip ? (
                  <EditorTransformControls
                    clip={selectedClip}
                    onUpdate={(updates) => handleUpdateClip(selectedClip.id, updates)}
                  />
                ) : null;
              })()}
            </div>

            <div className="assistant-editor-controls">
              <EditorControls
                playhead={editorState.playhead}
                duration={currentSequence.duration}
                playing={editorState.playing}
                volume={editorState.volume}
                playbackSpeed={editorState.playbackSpeed}
                onSetPlayhead={handleSetPlayhead}
                onSetPlaying={handleSetPlaying}
                onSetVolume={(volume) => setEditorState((prev) => ({ ...prev, volume }))}
                onSetPlaybackSpeed={(speed) =>
                  setEditorState((prev) => ({ ...prev, playbackSpeed: speed }))
                }
                onExport={handleExport}
              />
            </div>

            <div className="assistant-editor-timeline">
              <EditorTimeline
                assets={editorState.assets}
                clips={currentSequence.clips}
                playhead={editorState.playhead}
                zoom={editorState.zoom}
                duration={currentSequence.duration}
                selectedClipId={editorState.selectedClipIds[0] || null}
                playing={editorState.playing}
                onAddClip={handleAddClip}
                onUpdateClip={handleUpdateClip}
                onRemoveClip={handleRemoveClip}
                onSetPlayhead={handleSetPlayhead}
                onSetZoom={(zoom) => setEditorState((prev) => ({ ...prev, zoom }))}
                onSelectClip={(clipId) => handleSelectClip(clipId || '', false)}
              />
            </div>
          </div>

          {editorState.panels.inspector && (
            <div className="assistant-editor-inspector-panel">
              <EditorInspectorPanel
                selectedClips={selectedClips}
                assets={editorState.assets}
                onUpdateClip={handleUpdateClip}
              />
            </div>
          )}

          {editorState.panels.keyframes && (
            <div className="assistant-editor-keyframe-panel">
              <EditorKeyframePanel
                selectedClips={selectedClips}
                onUpdateClip={handleUpdateClip}
              />
            </div>
          )}
        </div>

        {showTextPanel && (
          <div className="assistant-editor-text-panel-overlay" onClick={() => setShowTextPanel(false)}>
            <div onClick={(e) => e.stopPropagation()}>
              <EditorTextPanel
                tracks={currentSequence.tracks}
                playhead={editorState.playhead}
                onAddTextClip={handleAddTextClip}
                onClose={() => setShowTextPanel(false)}
              />
            </div>
          </div>
        )}

        {showShortcuts && <EditorShortcutsPanel onClose={() => setShowShortcuts(false)} />}
      </div>
    </div>
  );
}
