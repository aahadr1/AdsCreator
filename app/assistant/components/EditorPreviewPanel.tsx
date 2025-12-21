'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { EditorAsset, TimelineClip } from '../../../types/editor';

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

type EditorPreviewPanelProps = {
  assets: EditorAsset[];
  clips: TimelineClip[];
  playhead: number;
  playing: boolean;
  onSetPlayhead: (time: number) => void;
  onSetPlaying: (playing: boolean) => void;
};

export default function EditorPreviewPanel({
  assets,
  clips,
  playhead,
  playing,
  onSetPlayhead,
  onSetPlaying,
}: EditorPreviewPanelProps) {
  const playerRef = useRef<any>(null);
  const [currentMedia, setCurrentMedia] = useState<EditorAsset | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Find the clip at the current playhead position
  useEffect(() => {
    const activeClip = clips.find(
      (clip) => playhead >= clip.startTime && playhead <= clip.endTime
    );

    if (activeClip) {
      const asset = assets.find((a) => a.id === activeClip.assetId);
      if (asset) {
        setCurrentMedia(asset);
        // Calculate the time within the clip
        const clipRelativeTime = playhead - activeClip.startTime + activeClip.trimStart;
        setCurrentTime(clipRelativeTime);
      }
    } else {
      setCurrentMedia(null);
      setCurrentTime(0);
    }
  }, [playhead, clips, assets]);

  // Sync player with playhead (only when not playing to avoid conflicts)
  useEffect(() => {
    if (playerRef.current && currentMedia && !playing) {
      const player = playerRef.current.getInternalPlayer();
      if (player && typeof player.currentTime !== 'undefined') {
        try {
          const currentPlayerTime = typeof player.currentTime === 'number' ? player.currentTime : 0;
          if (Math.abs(currentPlayerTime - currentTime) > 0.1) {
            player.currentTime = currentTime;
          }
        } catch (e) {
          // Ignore errors when setting currentTime
        }
      }
    }
  }, [currentTime, currentMedia, playing]);

  // Handle playback
  useEffect(() => {
    if (playerRef.current && currentMedia) {
      const player = playerRef.current.getInternalPlayer();
      if (player) {
        if (playing) {
          if (typeof player.play === 'function') {
            player.play().catch(() => {
              // Ignore play errors
            });
          }
        } else {
          if (typeof player.pause === 'function') {
            player.pause();
          }
        }
      }
    }
  }, [playing, currentMedia]);

  const handleProgress = (state: any) => {
    // Update playhead based on player progress
    // This handles the case where video is playing
    if (playing && currentMedia && state?.playedSeconds !== undefined) {
      const activeClip = clips.find(
        (clip) => clip.assetId === currentMedia.id && playhead >= clip.startTime && playhead < clip.endTime
      );
      if (activeClip) {
        const newPlayhead = activeClip.startTime + state.playedSeconds - activeClip.trimStart;
        onSetPlayhead(Math.max(activeClip.startTime, Math.min(newPlayhead, activeClip.endTime)));
      }
    }
  };

  const getProxiedUrl = (url: string) => {
    if (url.startsWith('http')) {
      return `/api/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  if (!currentMedia) {
    return (
      <div className="assistant-editor-preview-panel">
        <div className="assistant-editor-preview-empty">
          <p>No media at current playhead position</p>
          <p className="assistant-editor-preview-hint">
            Drag assets from the left panel onto the timeline to preview
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="assistant-editor-preview-panel">
      <div className="assistant-editor-preview-content">
        {currentMedia.type === 'video' && currentMedia.url && (
          <ReactPlayer
            {...({
              ref: playerRef,
              url: getProxiedUrl(currentMedia.url),
              playing,
              progressInterval: 100,
              onProgress: handleProgress,
              controls: false,
              width: '100%',
              height: '100%',
            } as any)}
          />
        )}

        {currentMedia.type === 'audio' && currentMedia.url && (
          <div className="assistant-editor-preview-audio">
            <ReactPlayer
              {...({
                ref: playerRef,
                url: getProxiedUrl(currentMedia.url),
                playing,
                progressInterval: 100,
                onProgress: handleProgress,
                controls: false,
                width: '100%',
                height: '50px',
              } as any)}
            />
            <div className="assistant-editor-preview-audio-info">
              <p>{currentMedia.name}</p>
              <p>{currentTime.toFixed(1)}s</p>
            </div>
          </div>
        )}

        {currentMedia.type === 'image' && currentMedia.url && (
          <div className="assistant-editor-preview-image">
            <img
              src={getProxiedUrl(currentMedia.url)}
              alt={currentMedia.name}
              onError={(e) => {
                if (e.currentTarget.src !== currentMedia.url) {
                  e.currentTarget.src = currentMedia.url || '';
                }
              }}
            />
          </div>
        )}

        {currentMedia.type === 'text' && currentMedia.url && (
          <div className="assistant-editor-preview-text">
            {currentMedia.url.startsWith('data:text') ? (
              <pre>{atob(currentMedia.url.split(',')[1] || '')}</pre>
            ) : (
              <p>Text content</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

