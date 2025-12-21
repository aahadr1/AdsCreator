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
    if (clips.length > 0) {
      const videoClips = clips.filter((c) => c.track === 'video');
      const audioClips = clips.filter((c) => c.track === 'audio');

      // Find active video clip at playhead
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

      // If playhead is before all clips, show first clip at its start
      const allClips = [...videoClips, ...audioClips].sort((a, b) => a.startTime - b.startTime);
      if (allClips.length > 0) {
        if (playhead < allClips[0].startTime) {
          const firstClip = allClips[0];
          const asset = assets.find((a) => a.id === firstClip.assetId);
          if (asset) {
            setCurrentMedia(asset);
            setActiveClip(firstClip);
            setCurrentTime(firstClip.trimStart);
            return;
          }
        }
        
        // If playhead is after all clips, show last clip at its end
        const lastClip = allClips[allClips.length - 1];
        if (playhead >= lastClip.endTime) {
          const asset = assets.find((a) => a.id === lastClip.assetId);
          if (asset) {
            setCurrentMedia(asset);
            setActiveClip(lastClip);
            const clipDuration = (lastClip.endTime - lastClip.startTime) + lastClip.trimStart - lastClip.trimEnd;
            setCurrentTime(clipDuration);
            return;
          }
        }
        
        // If playhead is between clips, show the next upcoming clip
        const nextClip = allClips.find((clip) => playhead < clip.startTime);
        if (nextClip) {
          const asset = assets.find((a) => a.id === nextClip.assetId);
          if (asset) {
            setCurrentMedia(asset);
            setActiveClip(nextClip);
            setCurrentTime(nextClip.trimStart);
            return;
          }
        }
        
        // Fallback: show first clip anyway
        const firstClip = allClips[0];
        const asset = assets.find((a) => a.id === firstClip.assetId);
        if (asset) {
          setCurrentMedia(asset);
          setActiveClip(firstClip);
          const clipRelativeTime = Math.max(0, playhead - firstClip.startTime + firstClip.trimStart);
          setCurrentTime(clipRelativeTime);
          return;
        }
      }
    }

    // Fallback: show first asset if available (no clips on timeline)
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

  // Update currentTime when playhead moves - this is critical for timeline sync
  useEffect(() => {
    if (activeClip) {
      // Recalculate clip-relative time when playhead changes
      const clipRelativeTime = playhead - activeClip.startTime + activeClip.trimStart;
      const clipDuration = (activeClip.endTime - activeClip.startTime) + activeClip.trimStart - activeClip.trimEnd;
      const newTime = Math.max(0, Math.min(clipRelativeTime, clipDuration));
      // Always update if there's a meaningful change
      if (Math.abs(newTime - currentTime) > 0.01) {
        setCurrentTime(newTime);
      }
    }
  }, [playhead, activeClip]);

  // Sync player with playhead time - CRITICAL for timeline playback
  // This effect continuously syncs the player's currentTime with the timeline playhead
  useEffect(() => {
    if (!playerRef.current || !currentMedia) return;

    const player = playerRef.current.getInternalPlayer();
    if (!player || typeof player.currentTime === 'undefined') return;

    try {
      const currentPlayerTime = typeof player.currentTime === 'number' ? player.currentTime : 0;
      const targetTime = currentTime;
      
      // Always sync when there's an active clip (timeline mode)
      // Use smaller threshold during playback for smoother sync
      const threshold = playing && activeClip ? 0.03 : 0.1;
      
      if (Math.abs(currentPlayerTime - targetTime) > threshold) {
        player.currentTime = targetTime;
      }
    } catch (e) {
      // Ignore errors when setting currentTime
    }
  }, [currentTime, currentMedia, activeClip, playing]);

  // Handle playback state - play/pause based on timeline playing state
  useEffect(() => {
    if (!playerRef.current || !currentMedia) return;

    const player = playerRef.current.getInternalPlayer();
    if (!player) return;

    // Play if timeline is playing AND we have an active clip or selected asset/clip
    // Also play if there's a selected asset/clip even when paused (to show preview)
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
    // Don't proxy blob URLs or data URLs - they work directly
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    if (url.startsWith('http')) {
      return `/api/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  const mediaUrl = currentMedia?.url ? getProxiedUrl(currentMedia.url) : '';

  // Debug logging (reduced frequency)
  useEffect(() => {
    if (currentMedia && currentMedia.url) {
      console.log('Preview Panel:', {
        media: currentMedia.name,
        type: currentMedia.type,
        url: mediaUrl.substring(0, 80),
        activeClip: activeClip?.id,
        currentTime: currentTime.toFixed(2),
        playing,
        playhead: playhead.toFixed(2),
      });
    }
  }, [currentMedia?.name, mediaUrl, activeClip?.id, Math.floor(currentTime), playing, Math.floor(playhead)]);

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
        {currentMedia.type === 'video' && currentMedia.url && mediaUrl && (
          <ReactPlayer
            {...({
              ref: playerRef,
              url: mediaUrl,
              playing: playing && !!(activeClip || selectedClipId || selectedAssetId),
              playbackRate: playbackSpeed || 1,
              volume: volume || 1,
              progressInterval: activeClip ? 50 : 100,
              onProgress: handleProgress,
              onReady: () => {
                // When player is ready, sync to currentTime
                if (playerRef.current && activeClip) {
                  const player = playerRef.current.getInternalPlayer();
                  if (player && typeof player.currentTime !== 'undefined') {
                    try {
                      player.currentTime = currentTime;
                    } catch (e) {
                      // Ignore
                    }
                  }
                }
              },
              onError: (error: any) => {
                console.error('ReactPlayer error:', error);
              },
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
                url: mediaUrl,
                playing: playing && !!(activeClip || selectedClipId || selectedAssetId),
                playbackRate: playbackSpeed || 1,
                volume: volume || 1,
                progressInterval: activeClip ? 50 : 100,
                onProgress: handleProgress,
                onReady: () => {
                  if (playerRef.current && activeClip) {
                    const player = playerRef.current.getInternalPlayer();
                    if (player && typeof player.currentTime !== 'undefined') {
                      try {
                        player.currentTime = currentTime;
                      } catch (e) {
                        // Ignore
                      }
                    }
                  }
                },
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
              src={mediaUrl}
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

