'use client';

import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

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
  return (
    <div className="assistant-editor-controls">
      <button
        className="assistant-editor-control-btn"
        onClick={() => onSetPlayhead(0)}
        type="button"
        title="Go to start"
      >
        <SkipBack size={18} />
      </button>

      <button
        className="assistant-editor-control-btn primary"
        onClick={() => onSetPlaying(!playing)}
        type="button"
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={20} /> : <Play size={20} />}
      </button>

      <button
        className="assistant-editor-control-btn"
        onClick={() => onSetPlayhead(duration)}
        type="button"
        title="Go to end"
      >
        <SkipForward size={18} />
      </button>

      <div className="assistant-editor-timecode">
        <span>{formatTime(playhead)}</span>
        <span className="text-gray-500">/</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}

