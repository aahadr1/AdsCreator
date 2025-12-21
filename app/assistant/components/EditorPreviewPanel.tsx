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
        // This is the exact time in the source media that should be playing
        const clipRelativeTime = playhead - activeVideoClip.startTime + activeVideoClip.trimStart;
        // Clamp to the actual clip duration (accounting for trims)
        const clipDuration = (activeVideoClip.endTime - activeVideoClip.startTime) + activeVideoClip.trimStart - activeVideoClip.trimEnd;
        setCurrentTime(Math.max(0, Math.min(clipRelativeTime, clipDuration)));
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
        const clipDuration = (firstAudioClip.endTime - firstAudioClip.startTime) + firstAudioClip.trimStart - firstAudioClip.trimEnd;
        setCurrentTime(Math.max(0, Math.min(clipRelativeTime, clipDuration)));
        return;
      }
    }

    // Fallback: show first asset if available
    // This handles: no clips on timeline, or playhead not at any clip
    if (assets.length > 0) {
      setCurrentMedia(assets[0]);
      setCurrentTime(0);
      setActiveClip(null);
      setActiveAudioClips([]);
    } else {
      setCurrentMedia(null);
      setCurrentTime(0);
      setActiveClip(null);
      setActiveAudioClips([]);
    }
  }, [playhead, clips, assets, selectedAssetId, selectedClipId]);

  // Update currentTime when playhead moves during timeline playback
  // This ensures the player shows the correct frame as playhead advances
  useEffect(() => {
    if (activeClip && playing) {
      // Recalculate clip-relative time when playhead changes during playback
      const clipRelativeTime = playhead - activeClip.startTime + activeClip.trimStart;
      const clipDuration = (activeClip.endTime - activeClip.startTime) + activeClip.trimStart - activeClip.trimEnd;
      const newTime = Math.max(0, Math.min(clipRelativeTime, clipDuration));
      if (Math.abs(newTime - currentTime) > 0.01) {
        setCurrentTime(newTime);
      }
    }
  }, [playhead, activeClip, playing]);

  // Sync player with playhead time - critical for timeline playback
  useEffect(() => {
    if (playerRef.current && currentMedia && activeClip) {
      const player = playerRef.current.getInternalPlayer();
      if (player && typeof player.currentTime !== 'undefined') {
        try {
          const currentPlayerTime = typeof player.currentTime === 'number' ? player.currentTime : 0;
          // Always sync when there's an active clip (timeline composition mode)
          // This ensures the player follows the playhead as it moves through clips
          const targetTime = currentTime;
          // Sync more aggressively during timeline playback (smaller threshold)
          const threshold = playing ? 0.05 : 0.1;
          if (Math.abs(currentPlayerTime - targetTime) > threshold) {
            player.currentTime = targetTime;
          }
        } catch (e) {
          // Ignore errors when setting currentTime
        }
      }
    } else if (playerRef.current && currentMedia && !activeClip && !playing) {
      // When not playing and no active clip, sync for manual seeks
      const player = playerRef.current.getInternalPlayer();
      if (player && typeof player.currentTime !== 'undefined') {
        try {
          const currentPlayerTime = typeof player.currentTime === 'number' ? player.currentTime : 0;
          if (Math.abs(currentPlayerTime - currentTime) > 0.1) {
            player.currentTime = currentTime;
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }, [currentTime, currentMedia, activeClip, playing]);

  // Handle playback state - play/pause based on timeline playing state
  useEffect(() => {
    if (playerRef.current && currentMedia) {
      const player = playerRef.current.getInternalPlayer();
      if (player) {
        // Only play if there's an active clip (timeline composition mode) or selected asset/clip
        const shouldPlay = playing && (activeClip || selectedClipId || selectedAssetId);
        if (shouldPlay) {
          if (typeof player.play === 'function') {
            player.play().catch(() => {
              // Ignore play errors (e.g., autoplay restrictions)
            });
          }
        } else {
          if (typeof player.pause === 'function') {
            player.pause();
          }
        }
      }
    }
  }, [playing, currentMedia, activeClip, selectedClipId, selectedAssetId]);

  const handleProgress = (state: any) => {
    // When playing timeline composition, the playhead is controlled by the timeline loop in AssistantEditor
    // This progress handler should NOT update the playhead during timeline playback to avoid conflicts
    // It's only used for manual playback of selected assets
    if (playing && activeClip && state?.playedSeconds !== undefined) {
      // Only update if we're showing a selected clip/asset (not timeline composition)
      // Timeline composition playhead is managed by the playback loop
      if (selectedClipId || selectedAssetId) {
        const newPlayhead = activeClip.startTime + state.playedSeconds - activeClip.trimStart;
        const clampedPlayhead = Math.max(activeClip.startTime, Math.min(newPlayhead, activeClip.endTime));
        onSetPlayhead(clampedPlayhead);
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
              playing: playing && (activeClip || selectedClipId || selectedAssetId), // Only play if there's context
              playbackRate: playbackSpeed || 1,
              volume: volume || 1,
              progressInterval: activeClip ? 50 : 100, // More frequent updates during timeline playback
              onProgress: handleProgress,
              controls: false,
              width: '100%',
              height: '100%',
              config: {
                file: {
                  attributes: {
                    controlsList: 'nodownload',
                  },
                },
              },
            } as any)}
          />
        )}

        {currentMedia.type === 'audio' && currentMedia.url && (
          <div className="assistant-editor-preview-audio">
            <ReactPlayer
              {...({
                ref: playerRef,
                url: getProxiedUrl(currentMedia.url),
                playing: playing && (activeClip || selectedClipId || selectedAssetId), // Only play if there's context
                playbackRate: playbackSpeed || 1,
                volume: volume || 1,
                progressInterval: activeClip ? 50 : 100, // More frequent updates during timeline playback
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

