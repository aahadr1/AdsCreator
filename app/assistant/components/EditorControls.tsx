'use client';

import { Play, Pause, SkipBack, SkipForward, Volume2, Download } from 'lucide-react';

type EditorControlsProps = {
  playhead: number;
  duration: number;
  playing: boolean;
  volume: number;
  playbackSpeed: number;
  onSetPlayhead: (time: number) => void;
  onSetPlaying: (playing: boolean) => void;
  onSetVolume: (volume: number) => void;
  onSetPlaybackSpeed: (speed: number) => void;
  onExport?: () => void;
};

export default function EditorControls({
  playhead,
  duration,
  playing,
  volume,
  playbackSpeed,
  onSetPlayhead,
  onSetPlaying,
  onSetVolume,
  onSetPlaybackSpeed,
  onExport,
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

        <div className="assistant-editor-control-volume">
          <Volume2 size={18} />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volume * 100}
            onChange={(e) => onSetVolume(parseFloat(e.target.value) / 100)}
            className="assistant-editor-control-volume-slider"
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        </div>

        <select
          className="assistant-editor-control-speed"
          value={playbackSpeed}
          onChange={(e) => onSetPlaybackSpeed(parseFloat(e.target.value))}
          title="Playback Speed"
        >
          <option value={0.25}>0.25x</option>
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>

        <button
          className="assistant-editor-control-button assistant-editor-control-export"
          type="button"
          title="Export"
          onClick={onExport}
          disabled={!onExport}
        >
          <Download size={18} />
          <span>Export</span>
        </button>
      </div>
    </div>
  );
}

