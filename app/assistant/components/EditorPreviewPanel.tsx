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
  selectedAssetId?: string | null;
  selectedClipId?: string | null;
  volume: number;
  playbackSpeed: number;
  onSetPlayhead: (time: number) => void;
  onSetPlaying: (playing: boolean) => void;
};

export default function EditorPreviewPanel({
  assets,
  clips,
  playhead,
  playing,
  selectedAssetId,
  selectedClipId,
  volume,
  playbackSpeed,
  onSetPlayhead,
  onSetPlaying,
}: EditorPreviewPanelProps) {
  const playerRef = useRef<any>(null);
  const [currentMedia, setCurrentMedia] = useState<EditorAsset | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeClip, setActiveClip] = useState<TimelineClip | null>(null);
  const [activeAudioClips, setActiveAudioClips] = useState<TimelineClip[]>([]);

  // Priority: selectedClipId > selectedAssetId > timeline composition (clip at playhead) > first asset
  useEffect(() => {
    // First check if there's a selected clip (highest priority)
    if (selectedClipId) {
      const selectedClip = clips.find((c) => c.id === selectedClipId);
      if (selectedClip) {
        const asset = assets.find((a) => a.id === selectedClip.assetId);
        if (asset) {
          setCurrentMedia(asset);
          setActiveClip(selectedClip);
          const clipRelativeTime = playhead >= selectedClip.startTime && playhead < selectedClip.endTime
            ? playhead - selectedClip.startTime + selectedClip.trimStart
            : selectedClip.trimStart;
          setCurrentTime(Math.max(0, clipRelativeTime));
          setActiveAudioClips([]);
          return;
        }
      }
    }

    // Then check if there's a selected asset (asset preview mode)
    if (selectedAssetId) {
      const selectedAsset = assets.find((a) => a.id === selectedAssetId);
      if (selectedAsset) {
        setCurrentMedia(selectedAsset);
        setCurrentTime(0);
        setActiveClip(null);
        setActiveAudioClips([]);
        return;
      }
    }

    // Timeline composition mode: find active clips at playhead
    const videoClips = clips.filter((c) => c.track === 'video');
    const audioClips = clips.filter((c) => c.track === 'audio');

    // Find active video clip (topmost/closest to playhead)
    const activeVideoClip = videoClips.find(
      (clip) => playhead >= clip.startTime && playhead < clip.endTime
    );

    // Find all active audio clips
    const activeAudios = audioClips.filter(
      (clip) => playhead >= clip.startTime && playhead < clip.endTime
    );

    setActiveAudioClips(activeAudios);

    if (activeVideoClip) {
      const asset = assets.find((a) => a.id === activeVideoClip.assetId);
      if (asset) {
        setCurrentMedia(asset);
        setActiveClip(activeVideoClip);
        // Calculate the time within the clip: playhead position - clip start + trim offset
        const clipRelativeTime = playhead - activeVideoClip.startTime + activeVideoClip.trimStart;
        setCurrentTime(Math.max(0, clipRelativeTime));
        return;
      }
    }

    // If no video clip but audio clips exist, show first audio
    if (activeAudios.length > 0 && !activeVideoClip) {
      const firstAudioClip = activeAudios[0];
      const asset = assets.find((a) => a.id === firstAudioClip.assetId);
      if (asset) {
        setCurrentMedia(asset);
        setActiveClip(firstAudioClip);
        const clipRelativeTime = playhead - firstAudioClip.startTime + firstAudioClip.trimStart;
        setCurrentTime(Math.max(0, clipRelativeTime));
        return;
      }
    }

    // Fallback to first asset if available (only if no clips on timeline)
    if (assets.length > 0 && clips.length === 0) {
      setCurrentMedia(assets[0]);
      setCurrentTime(0);
      setActiveClip(null);
      setActiveAudioClips([]);
    } else if (assets.length === 0) {
      setCurrentMedia(null);
      setCurrentTime(0);
      setActiveClip(null);
      setActiveAudioClips([]);
    } else {
      // No active clip at playhead
      setCurrentMedia(null);
      setCurrentTime(0);
      setActiveClip(null);
      setActiveAudioClips([]);
    }
  }, [playhead, clips, assets, selectedAssetId, selectedClipId]);

  // Sync player with playhead time
  useEffect(() => {
    if (playerRef.current && currentMedia && activeClip) {
      const player = playerRef.current.getInternalPlayer();
      if (player && typeof player.currentTime !== 'undefined') {
        try {
          const currentPlayerTime = typeof player.currentTime === 'number' ? player.currentTime : 0;
          // Only sync if difference is significant (avoid constant updates)
          if (Math.abs(currentPlayerTime - currentTime) > 0.1) {
            player.currentTime = currentTime;
          }
        } catch (e) {
          // Ignore errors when setting currentTime
        }
      }
    }
  }, [currentTime, currentMedia, activeClip]);

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
    // When playing timeline composition, the playhead is controlled by the timeline loop
    // This progress handler is mainly for when user manually seeks or when showing selected asset
    if (playing && activeClip && state?.playedSeconds !== undefined) {
      // Calculate new playhead based on clip progress
      const newPlayhead = activeClip.startTime + state.playedSeconds - activeClip.trimStart;
      // Clamp to clip boundaries
      const clampedPlayhead = Math.max(activeClip.startTime, Math.min(newPlayhead, activeClip.endTime));
      onSetPlayhead(clampedPlayhead);
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
          <p>No media selected</p>
          <p className="assistant-editor-preview-hint">
            Click on an asset from the left panel to preview, or drag assets onto the timeline
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
              playbackRate: playbackSpeed || 1,
              volume: volume || 1,
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
                playbackRate: playbackSpeed,
                volume: volume,
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
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src.includes('/api/proxy') && target.src !== currentMedia.url) {
                  // If proxy fails, try direct URL
                  target.src = currentMedia.url || '';
                } else if (target.src !== currentMedia.url) {
                  target.src = currentMedia.url || '';
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

