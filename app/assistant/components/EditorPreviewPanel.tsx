'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [currentMedia, setCurrentMedia] = useState<EditorAsset | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeClip, setActiveClip] = useState<TimelineClip | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);

  // Determine which media to display based on priority:
  // 1. Selected clip (highest priority)
  // 2. Selected asset
  // 3. Active clip at playhead (timeline composition)
  useEffect(() => {
    // Priority 1: Selected clip
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
          return;
        }
      }
    }

    // Priority 2: Selected asset
    if (selectedAssetId) {
      const selectedAsset = assets.find((a) => a.id === selectedAssetId);
      if (selectedAsset) {
        setCurrentMedia(selectedAsset);
        setCurrentTime(0);
        setActiveClip(null);
        return;
      }
    }

    // Priority 3: Timeline composition - find active clip at playhead
    if (clips.length > 0) {
      const videoClips = clips.filter((c) => c.track === 'video');
      const audioClips = clips.filter((c) => c.track === 'audio');

      // Find active video clip at playhead
      const activeVideoClip = videoClips.find(
        (clip) => playhead >= clip.startTime && playhead < clip.endTime
      );

      // Find active audio clips
      const activeAudios = audioClips.filter(
        (clip) => playhead >= clip.startTime && playhead < clip.endTime
      );

      if (activeVideoClip) {
        const asset = assets.find((a) => a.id === activeVideoClip.assetId);
        if (asset) {
          setCurrentMedia(asset);
          setActiveClip(activeVideoClip);
          const clipRelativeTime = playhead - activeVideoClip.startTime + activeVideoClip.trimStart;
          const clipDuration = (activeVideoClip.endTime - activeVideoClip.startTime) + activeVideoClip.trimStart - activeVideoClip.trimEnd;
          setCurrentTime(Math.max(0, Math.min(clipRelativeTime, clipDuration)));
          return;
        }
      }

      // If no video but audio exists, show first audio
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

      // If playhead is before all clips, show first clip
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
        
        // If playhead is after all clips, show last clip
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
        
        // Fallback: show first clip
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

    // Fallback: show first asset if available
    if (assets.length > 0) {
      setCurrentMedia(assets[0]);
      setCurrentTime(0);
      setActiveClip(null);
    } else {
      setCurrentMedia(null);
      setCurrentTime(0);
      setActiveClip(null);
    }
  }, [playhead, clips, assets, selectedAssetId, selectedClipId]);

  // Update currentTime when playhead moves (for timeline sync)
  useEffect(() => {
    if (activeClip) {
      const clipRelativeTime = playhead - activeClip.startTime + activeClip.trimStart;
      const clipDuration = (activeClip.endTime - activeClip.startTime) + activeClip.trimStart - activeClip.trimEnd;
      const newTime = Math.max(0, Math.min(clipRelativeTime, clipDuration));
      if (Math.abs(newTime - currentTime) > 0.01) {
        setCurrentTime(newTime);
      }
    }
  }, [playhead, activeClip]);

  // CRITICAL: Sync video element with timeline playhead
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentMedia || currentMedia.type !== 'video' || isSeeking) return;

    try {
      const targetTime = currentTime;
      const currentPlayerTime = video.currentTime || 0;
      
      // Only sync if difference is significant (avoid constant micro-updates)
      const threshold = playing && activeClip ? 0.05 : 0.1;
      
      if (Math.abs(currentPlayerTime - targetTime) > threshold) {
        setIsSeeking(true);
        video.currentTime = targetTime;
        // Reset seeking flag after a short delay
        setTimeout(() => setIsSeeking(false), 50);
      }
    } catch (e) {
      setIsSeeking(false);
      // Ignore errors
    }
  }, [currentTime, currentMedia, activeClip, playing, isSeeking]);

  // Sync audio element with timeline playhead
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentMedia || currentMedia.type !== 'audio' || isSeeking) return;

    try {
      const targetTime = currentTime;
      const currentPlayerTime = audio.currentTime || 0;
      const threshold = playing && activeClip ? 0.05 : 0.1;
      
      if (Math.abs(currentPlayerTime - targetTime) > threshold) {
        setIsSeeking(true);
        audio.currentTime = targetTime;
        setTimeout(() => setIsSeeking(false), 50);
      }
    } catch (e) {
      setIsSeeking(false);
    }
  }, [currentTime, currentMedia, activeClip, playing, isSeeking]);

  // Handle playback state (play/pause)
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    const player = currentMedia?.type === 'video' ? video : audio;
    
    if (!player || !currentMedia) return;

    const shouldPlay = playing && (activeClip || selectedClipId || selectedAssetId);
    
    if (shouldPlay) {
      player.play().catch((e) => {
        console.error('Play error:', e);
      });
    } else {
      player.pause();
    }
  }, [playing, currentMedia, activeClip, selectedClipId, selectedAssetId]);

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
    if (!video || !activeClip || !playing) return;
    
    // Only update playhead if showing selected clip/asset (not timeline composition)
    // Timeline composition playhead is managed by AssistantEditor's playback loop
    if (selectedClipId || selectedAssetId) {
      const newPlayhead = activeClip.startTime + video.currentTime - activeClip.trimStart;
      const clampedPlayhead = Math.max(activeClip.startTime, Math.min(newPlayhead, activeClip.endTime));
      onSetPlayhead(clampedPlayhead);
    }
  };

  // Handle audio time update
  const handleAudioTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !activeClip || !playing) return;
    
    if (selectedClipId || selectedAssetId) {
      const newPlayhead = activeClip.startTime + audio.currentTime - activeClip.trimStart;
      const clampedPlayhead = Math.max(activeClip.startTime, Math.min(newPlayhead, activeClip.endTime));
      onSetPlayhead(clampedPlayhead);
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
                    videoRef.current.currentTime = currentTime;
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
                    videoRef.current.currentTime = currentTime;
                    videoRef.current.volume = volume;
                    videoRef.current.playbackRate = playbackSpeed;
                  } catch (e) {
                    console.error('Error setting video properties on metadata:', e);
                  }
                }
              }}
              onTimeUpdate={handleVideoTimeUpdate}
              onSeeked={() => {
                setIsSeeking(false);
              }}
              onError={(e) => {
                console.error('Video error:', e, 'URL:', mediaUrl.substring(0, 80));
              }}
            />
          </div>
        )}

        {currentMedia.type === 'audio' && currentMedia.url && mediaUrl && (
          <div className="assistant-editor-preview-audio">
            <audio
              ref={audioRef}
              key={mediaUrl}
              src={mediaUrl}
              preload="auto"
              onLoadedData={() => {
                if (audioRef.current) {
                  try {
                    audioRef.current.currentTime = currentTime;
                    audioRef.current.volume = volume;
                    audioRef.current.playbackRate = playbackSpeed;
                  } catch (e) {
                    console.error('Error setting audio properties:', e);
                  }
                }
              }}
              onTimeUpdate={handleAudioTimeUpdate}
              onSeeked={() => {
                setIsSeeking(false);
              }}
              onError={(e) => {
                console.error('Audio error:', e);
              }}
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
