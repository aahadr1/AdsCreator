'use client';

import { Play, Pause, SkipBack, SkipForward, Volume2, Download } from 'lucide-react';

type EditorControlsProps = {
  playhead: number;
  duration: number;
  playing: boolean;
  onSetPlayhead: (time: number) => void;
  onSetPlaying: (playing: boolean) => void;
};

export default function EditorControls({
  playhead,
  duration,
  playing,
  onSetPlayhead,
  onSetPlaying,
}: EditorControlsProps) {
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    onSetPlayhead(time);
  };

  const handleSkipBack = () => {
    onSetPlayhead(Math.max(0, playhead - 1));
  };

  const handleSkipForward = () => {
    onSetPlayhead(Math.min(duration, playhead + 1));
  };

  const handleFrameBack = () => {
    onSetPlayhead(Math.max(0, playhead - 1 / 30)); // Assuming 30fps
  };

  const handleFrameForward = () => {
    onSetPlayhead(Math.min(duration, playhead + 1 / 30));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="assistant-editor-controls">
      <div className="assistant-editor-controls-main">
        <button
          className="assistant-editor-control-button"
          onClick={handleSkipBack}
          type="button"
          title="Skip back 1 second"
        >
          <SkipBack size={18} />
        </button>

        <button
          className="assistant-editor-control-button assistant-editor-control-play"
          onClick={() => onSetPlaying(!playing)}
          type="button"
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <button
          className="assistant-editor-control-button"
          onClick={handleSkipForward}
          type="button"
          title="Skip forward 1 second"
        >
          <SkipForward size={18} />
        </button>

        <div className="assistant-editor-control-time">
          <span>{formatTime(playhead)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="assistant-editor-controls-seek">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={playhead}
          onChange={handleSeek}
          className="assistant-editor-control-seek-slider"
        />
      </div>

      <div className="assistant-editor-controls-secondary">
        <button
          className="assistant-editor-control-button"
          onClick={handleFrameBack}
          type="button"
          title="Frame back"
        >
          <SkipBack size={14} />
          <span>Frame</span>
        </button>

        <button
          className="assistant-editor-control-button"
          onClick={handleFrameForward}
          type="button"
          title="Frame forward"
        >
          <SkipForward size={14} />
          <span>Frame</span>
        </button>

        <button
          className="assistant-editor-control-button"
          type="button"
          title="Volume"
          disabled
        >
          <Volume2 size={18} />
        </button>

        <button
          className="assistant-editor-control-button assistant-editor-control-export"
          type="button"
          title="Export (coming soon)"
          disabled
        >
          <Download size={18} />
          <span>Export</span>
        </button>
      </div>
    </div>
  );
}

