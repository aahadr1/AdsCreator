'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { EditorAsset, TimelineClip } from '../../../types/editor';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const seekingRef = useRef(false);
  const seekTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  type ClipDisplayContext = { type: 'clip'; asset: EditorAsset; clip: TimelineClip; relativeTime: number };
  type DisplayContext =
    | { type: 'none' }
    | { type: 'asset'; asset: EditorAsset; relativeTime: number }
    | ClipDisplayContext;

  const buildClipContext = useCallback(
    (clip: TimelineClip | undefined): ClipDisplayContext | null => {
      if (!clip) return null;
      const asset = assets.find((a) => a.id === clip.assetId);
      if (!asset) return null;
      const timelineLength = Math.max(clip.endTime - clip.startTime, 0);
      const trimmedDuration = Math.max(timelineLength - (clip.trimStart + clip.trimEnd), 0);
      const relTime = Math.max(
        0,
        Math.min(playhead - clip.startTime + clip.trimStart, clip.trimStart + trimmedDuration),
      );
      return {
        type: 'clip',
        asset,
        clip,
        relativeTime: relTime,
      };
    },
    [assets, playhead],
  );

  const displayContext: DisplayContext = useMemo(() => {
    // Selected clip has priority
    if (selectedClipId) {
      const clip = clips.find((c) => c.id === selectedClipId);
      const ctx = buildClipContext(clip);
      if (ctx) return ctx;
    }

    // Selected asset (preview outside of timeline)
    if (selectedAssetId) {
      const asset = assets.find((a) => a.id === selectedAssetId);
      if (asset) return { type: 'asset', asset, relativeTime: 0 };
    }

    if (clips.length > 0) {
      const videoClip = clips
        .filter((c) => c.track === 'video')
        .find((clip) => playhead >= clip.startTime && playhead < clip.endTime);
      const videoCtx = buildClipContext(videoClip);
      if (videoCtx) return videoCtx;

      const audioClip = clips
        .filter((c) => c.track === 'audio')
        .find((clip) => playhead >= clip.startTime && playhead < clip.endTime);
      const audioCtx = buildClipContext(audioClip);
      if (audioCtx) return audioCtx;

      const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
      if (playhead < sorted[0].startTime) {
        const ctx = buildClipContext(sorted[0]);
        if (ctx) return ctx;
      }
      const last = sorted[sorted.length - 1];
      if (playhead >= last.endTime) {
        const ctx = buildClipContext(last);
        if (ctx) {
          return {
            type: 'clip',
            asset: ctx.asset,
            clip: ctx.clip,
            relativeTime: Math.max(0, ctx.relativeTime),
          };
        }
      }

      const fallbackClip = buildClipContext(sorted[0]);
      if (fallbackClip) return fallbackClip;
    }

    if (assets.length > 0) {
      return { type: 'asset', asset: assets[0], relativeTime: 0 };
    }
    return { type: 'none' };
  }, [assets, clips, selectedAssetId, selectedClipId, playhead, buildClipContext]);

  const mediaAsset = displayContext.type === 'none' ? null : displayContext.asset;
  const activeClip = displayContext.type === 'clip' ? displayContext.clip : null;
  const displayTime = displayContext.type === 'none' ? 0 : displayContext.relativeTime;
  const shouldDriveTimeline = Boolean(selectedClipId || selectedAssetId);

  // CRITICAL: Sync video element with timeline playhead
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaAsset || mediaAsset.type !== 'video') return;

    const currentPlayerTime = video.currentTime || 0;
    const threshold = playing && activeClip ? 0.05 : 0.1;

    if (!seekingRef.current && Math.abs(currentPlayerTime - displayTime) > threshold) {
      seekingRef.current = true;
      video.currentTime = displayTime;
      if (seekTimeout.current) clearTimeout(seekTimeout.current);
      seekTimeout.current = setTimeout(() => {
        seekingRef.current = false;
      }, 60);
    }
  }, [displayTime, mediaAsset, playing, activeClip]);

  // Sync audio element with timeline playhead
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !mediaAsset || mediaAsset.type !== 'audio') return;

    const currentPlayerTime = audio.currentTime || 0;
    const threshold = playing && activeClip ? 0.05 : 0.1;

    if (!seekingRef.current && Math.abs(currentPlayerTime - displayTime) > threshold) {
      seekingRef.current = true;
      audio.currentTime = displayTime;
      if (seekTimeout.current) clearTimeout(seekTimeout.current);
      seekTimeout.current = setTimeout(() => {
        seekingRef.current = false;
      }, 60);
    }
  }, [displayTime, mediaAsset, playing, activeClip]);

  // Handle playback state (play/pause)
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    const player = mediaAsset?.type === 'video' ? video : audio;
    
    if (!player || !mediaAsset) return;

    const shouldPlay = playing && (activeClip || selectedClipId || selectedAssetId);
    
    if (shouldPlay) {
      player.play().catch((e) => {
        console.error('Play error:', e);
      });
    } else {
      player.pause();
    }
  }, [playing, mediaAsset, activeClip, selectedClipId, selectedAssetId]);

  // Update volume and playback speed
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    
    if (video) {
      video.volume = volume;
      video.playbackRate = playbackSpeed;
    }
    if (audio) {
      audio.volume = volume;
      audio.playbackRate = playbackSpeed;
    }
  }, [volume, playbackSpeed]);

  // Handle video time update (for progress tracking when playing selected clips)
  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !activeClip || !playing || !shouldDriveTimeline || seekingRef.current) return;
    const newPlayhead = activeClip.startTime + video.currentTime - activeClip.trimStart;
    const clamped = Math.max(activeClip.startTime, Math.min(newPlayhead, activeClip.endTime));
    onSetPlayhead(clamped);
  };

  // Handle audio time update
  const handleAudioTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !activeClip || !playing || !shouldDriveTimeline || seekingRef.current) return;
    const newPlayhead = activeClip.startTime + audio.currentTime - activeClip.trimStart;
    const clamped = Math.max(activeClip.startTime, Math.min(newPlayhead, activeClip.endTime));
    onSetPlayhead(clamped);
  };

  const getProxiedUrl = (url: string) => {
    // Don't proxy blob URLs or data URLs - they work directly
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    if (url.startsWith('http')) {
      return `/api/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  const mediaUrl = mediaAsset?.url ? getProxiedUrl(mediaAsset.url) : '';

  if (!mediaAsset) {
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
        {mediaAsset.type === 'video' && mediaAsset.url && mediaUrl && (
          <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video
              ref={videoRef}
              key={mediaUrl}
              src={mediaUrl}
              preload="auto"
              playsInline
              muted={false}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onLoadedData={() => {
                if (videoRef.current) {
                  try {
                    videoRef.current.currentTime = displayTime;
                    videoRef.current.volume = volume;
                    videoRef.current.playbackRate = playbackSpeed;
                    if (!playing) {
                      videoRef.current.pause();
                    }
                  } catch (e) {
                    console.error('Error setting video properties on load:', e);
                  }
                }
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  try {
                    videoRef.current.currentTime = displayTime;
                    videoRef.current.volume = volume;
                    videoRef.current.playbackRate = playbackSpeed;
                  } catch (e) {
                    console.error('Error setting video properties on metadata:', e);
                  }
                }
              }}
              onTimeUpdate={handleVideoTimeUpdate}
              onSeeked={() => {
                seekingRef.current = false;
                if (seekTimeout.current) {
                  clearTimeout(seekTimeout.current);
                  seekTimeout.current = null;
                }
              }}
              onError={(e) => {
                console.error('Video error:', e, 'URL:', mediaUrl.substring(0, 80));
              }}
            />
          </div>
        )}

        {mediaAsset.type === 'audio' && mediaUrl && (
          <div className="assistant-editor-preview-audio">
            <audio
              ref={audioRef}
              key={mediaUrl}
              src={mediaUrl}
              preload="auto"
              onLoadedData={() => {
                if (audioRef.current) {
                  try {
                    audioRef.current.currentTime = displayTime;
                    audioRef.current.volume = volume;
                    audioRef.current.playbackRate = playbackSpeed;
                  } catch (e) {
                    console.error('Error setting audio properties:', e);
                  }
                }
              }}
              onTimeUpdate={handleAudioTimeUpdate}
              onSeeked={() => {
                seekingRef.current = false;
                if (seekTimeout.current) {
                  clearTimeout(seekTimeout.current);
                  seekTimeout.current = null;
                }
              }}
              onError={(e) => {
                console.error('Audio error:', e);
              }}
            />
            <div className="assistant-editor-preview-audio-info">
              <p>{mediaAsset.name}</p>
              <p>{displayTime.toFixed(1)}s</p>
            </div>
          </div>
        )}

        {mediaAsset.type === 'image' && mediaAsset.url && (
          <div className="assistant-editor-preview-image">
            <img
              src={mediaUrl}
              alt={mediaAsset.name}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src.includes('/api/proxy') && target.src !== mediaAsset.url) {
                  target.src = mediaAsset.url || '';
                } else if (target.src !== mediaAsset.url) {
                  target.src = mediaAsset.url || '';
                }
              }}
            />
          </div>
        )}

        {mediaAsset.type === 'text' && mediaAsset.url && (
          <div className="assistant-editor-preview-text">
            {mediaAsset.url.startsWith('data:text') ? (
              <pre>{atob(mediaAsset.url.split(',')[1] || '')}</pre>
            ) : (
              <p>Text content</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
