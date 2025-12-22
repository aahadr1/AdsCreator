'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, Grid3x3 } from 'lucide-react';
import type { EditorAsset, TimelineClip, Track } from '../../../types/editor';
import { isMediaClip } from '../../../types/editor';

type EditorPreviewPanelProps = {
  assets: EditorAsset[];
  clips: TimelineClip[];
  tracks: Track[];
  playhead: number;
  playing: boolean;
  volume: number;
  playbackSpeed: number;
  canvasWidth: number;
  canvasHeight: number;
  onSetPlayhead: (time: number) => void;
  onSetPlaying: (playing: boolean) => void;
  onUpdateClip?: (clipId: string, updates: Partial<TimelineClip>) => void;
};

type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | 'free';

export default function EditorPreviewPanel({
  assets,
  clips,
  tracks,
  playhead,
  playing,
  volume,
  playbackSpeed,
  canvasWidth,
  canvasHeight,
  onSetPlayhead,
  onSetPlaying,
  onUpdateClip,
}: EditorPreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaElementsRef = useRef<Map<string, HTMLVideoElement | HTMLImageElement | HTMLAudioElement>>(new Map());
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);

  // Get active clips at current playhead
  const activeClips = useMemo(() => {
    return clips
      .filter(clip => playhead >= clip.startTime && playhead < clip.endTime)
      .filter(clip => {
        const track = tracks.find(t => t.id === clip.trackId);
        return track && track.visible && !track.muted;
      })
      .sort((a, b) => {
        const trackA = tracks.find(t => t.id === a.trackId);
        const trackB = tracks.find(t => t.id === b.trackId);
        return (trackA?.index || 0) - (trackB?.index || 0);
      });
  }, [clips, tracks, playhead]);

  // Load media elements
  useEffect(() => {
    const loadMedia = async () => {
      for (const clip of clips) {
        if (!isMediaClip(clip)) continue;
        
        const asset = assets.find(a => a.id === clip.assetId);
        if (!asset || mediaElementsRef.current.has(clip.assetId)) continue;

        try {
          if (asset.type === 'video') {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.preload = 'auto';
            video.muted = false;
            const url = asset.url.startsWith('http') 
              ? `/api/proxy?url=${encodeURIComponent(asset.url)}` 
              : asset.url;
            video.src = url;
            await new Promise((resolve, reject) => {
              video.addEventListener('loadeddata', resolve, { once: true });
              video.addEventListener('error', reject, { once: true });
            });
            mediaElementsRef.current.set(clip.assetId, video);
          } else if (asset.type === 'image') {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const url = asset.url.startsWith('http') 
              ? `/api/proxy?url=${encodeURIComponent(asset.url)}` 
              : asset.url;
            img.src = url;
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
            });
            mediaElementsRef.current.set(clip.assetId, img);
          } else if (asset.type === 'audio') {
            const audio = new Audio();
            audio.crossOrigin = 'anonymous';
            audio.preload = 'auto';
            const url = asset.url.startsWith('http') 
              ? `/api/proxy?url=${encodeURIComponent(asset.url)}` 
              : asset.url;
            audio.src = url;
            await new Promise((resolve, reject) => {
              audio.addEventListener('loadeddata', resolve, { once: true });
              audio.addEventListener('error', reject, { once: true });
            });
            mediaElementsRef.current.set(clip.assetId, audio);
          }
        } catch (error) {
          console.error('Failed to load media:', asset.url, error);
        }
      }
    };

    loadMedia();
  }, [clips, assets]);

  // Render frame to canvas
  const renderFrame = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Clear canvas with black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get active clips at this time
    const activeClipsAtTime = clips
      .filter(clip => time >= clip.startTime && time < clip.endTime)
      .filter(clip => {
        const track = tracks.find(t => t.id === clip.trackId);
        return track && track.visible;
      })
      .sort((a, b) => {
        const trackA = tracks.find(t => t.id === a.trackId);
        const trackB = tracks.find(t => t.id === b.trackId);
        return (trackA?.index || 0) - (trackB?.index || 0);
      });

    // Render each clip
    for (const clip of activeClipsAtTime) {
      if (!isMediaClip(clip)) continue;

      const asset = assets.find(a => a.id === clip.assetId);
      if (!asset || asset.type === 'audio') continue; // Skip audio clips for canvas rendering

      const mediaElement = mediaElementsRef.current.get(clip.assetId);
      if (!mediaElement || mediaElement instanceof HTMLAudioElement) continue;

      // Calculate clip time within the timeline
      const clipTime = time - clip.startTime;
      const sourceTime = clipTime + (clip.trimStart || 0);

      // Seek video to correct time (only if playing or if time changed significantly)
      if (mediaElement instanceof HTMLVideoElement) {
        const timeDiff = Math.abs(mediaElement.currentTime - sourceTime);
        if (timeDiff > 0.1 || (!playing && timeDiff > 0.01)) {
          mediaElement.currentTime = Math.max(0, Math.min(sourceTime, mediaElement.duration || 0));
        }
        
        // Play/pause video based on playing state
        if (playing && mediaElement.paused) {
          mediaElement.play().catch(() => {
            // Ignore play errors (e.g., autoplay restrictions)
          });
        } else if (!playing && !mediaElement.paused) {
          mediaElement.pause();
        }
      }

      // Apply transform
      ctx.save();
      
      const transform = clip.transform;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Move to center + offset
      ctx.translate(centerX + transform.x, centerY + transform.y);
      
      // Apply rotation
      if (transform.rotation !== 0) {
        ctx.rotate((transform.rotation * Math.PI) / 180);
      }
      
      // Apply scale
      ctx.scale(
        transform.scale * transform.scaleX, 
        transform.scale * transform.scaleY
      );

      // Apply opacity
      ctx.globalAlpha = transform.opacity;

      // Get media dimensions
      let mediaWidth = canvas.width;
      let mediaHeight = canvas.height;
      
      if (mediaElement instanceof HTMLVideoElement) {
        mediaWidth = mediaElement.videoWidth || canvas.width;
        mediaHeight = mediaElement.videoHeight || canvas.height;
      } else if (mediaElement instanceof HTMLImageElement) {
        mediaWidth = mediaElement.width || canvas.width;
        mediaHeight = mediaElement.height || canvas.height;
      }

      // Draw media centered
      ctx.drawImage(
        mediaElement,
        -mediaWidth / 2,
        -mediaHeight / 2,
        mediaWidth,
        mediaHeight
      );

      // Draw resize handles if selected
      if (selectedClipId === clip.id) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          -mediaWidth / 2,
          -mediaHeight / 2,
          mediaWidth,
          mediaHeight
        );
      }

      ctx.restore();
    }
  }, [clips, tracks, selectedClipId, playing]);

  // Handle audio playback separately
  useEffect(() => {
    if (!playing) {
      // Pause all audio
      mediaElementsRef.current.forEach((element) => {
        if (element instanceof HTMLAudioElement || element instanceof HTMLVideoElement) {
          element.pause();
        }
      });
      return;
    }

    // Play audio for active clips
    const activeAudioClips = clips
      .filter(clip => playhead >= clip.startTime && playhead < clip.endTime)
      .filter(clip => {
        const track = tracks.find(t => t.id === clip.trackId);
        return track && track.visible && !track.muted;
      })
      .filter(isMediaClip);

    activeAudioClips.forEach((clip) => {
      const asset = assets.find(a => a.id === clip.assetId);
      if (!asset || (asset.type !== 'audio' && asset.type !== 'video')) return;

      const mediaElement = mediaElementsRef.current.get(clip.assetId);
      if (!mediaElement || !(mediaElement instanceof HTMLAudioElement || mediaElement instanceof HTMLVideoElement)) return;

      const clipTime = playhead - clip.startTime;
      const sourceTime = clipTime + (clip.trimStart || 0);

      if (Math.abs(mediaElement.currentTime - sourceTime) > 0.1) {
        mediaElement.currentTime = Math.max(0, Math.min(sourceTime, mediaElement.duration || 0));
      }

      if (mediaElement.paused) {
        mediaElement.play().catch(() => {
          // Ignore play errors
        });
      }
    });
  }, [playing, playhead, clips, tracks, assets]);

  // Animation loop for continuous playback
  useEffect(() => {
    if (!playing) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Render current frame when paused
      renderFrame(playhead);
      return;
    }

    let startTime = performance.now();
    let accumulatedTime = playhead;
    let lastFrameTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastFrameTime) / 1000; // Convert to seconds
      lastFrameTime = currentTime;
      
      accumulatedTime += deltaTime * playbackSpeed;
      
      // Update playhead
      onSetPlayhead(accumulatedTime);
      
      // Render frame
      renderFrame(accumulatedTime);
      
      // Find the maximum end time of all clips
      const maxEndTime = clips.length > 0 
        ? Math.max(...clips.map(c => c.endTime))
        : 0;
      
      // Stop if we've reached the end
      if (accumulatedTime >= maxEndTime) {
        onSetPlaying(false);
        onSetPlayhead(maxEndTime);
        return;
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    lastFrameTime = performance.now();
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [playing, playbackSpeed, clips, onSetPlayhead, onSetPlaying, renderFrame, playhead]);

  // Render frame when playhead changes (when paused)
  useEffect(() => {
    if (!playing) {
      renderFrame(playhead);
    }
  }, [playhead, playing, renderFrame]);

  // Update audio volumes
  useEffect(() => {
    mediaElementsRef.current.forEach((element) => {
      if (element instanceof HTMLVideoElement || element instanceof HTMLAudioElement) {
        element.volume = volume;
      }
    });
  }, [volume]);

  // Handle canvas click for clip selection
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - canvas.width / 2;
    const y = e.clientY - rect.top - canvas.height / 2;

    // Check if clicked on any clip (reverse order to check top clips first)
    for (let i = activeClips.length - 1; i >= 0; i--) {
      const clip = activeClips[i];
      if (!isMediaClip(clip)) continue;

      const asset = assets.find(a => a.id === clip.assetId);
      if (!asset || asset.type === 'audio') continue; // Skip audio clips

      const transform = clip.transform;
      const mediaElement = mediaElementsRef.current.get(clip.assetId);
      if (!mediaElement || mediaElement instanceof HTMLAudioElement) continue;

      let width = canvas.width;
      let height = canvas.height;
      
      if (mediaElement instanceof HTMLVideoElement) {
        width = mediaElement.videoWidth || canvas.width;
        height = mediaElement.videoHeight || canvas.height;
      } else if (mediaElement instanceof HTMLImageElement) {
        width = mediaElement.width || canvas.width;
        height = mediaElement.height || canvas.height;
      }

      width *= transform.scale * transform.scaleX;
      height *= transform.scale * transform.scaleY;

      const clipX = transform.x;
      const clipY = transform.y;

      if (
        x >= clipX - width / 2 &&
        x <= clipX + width / 2 &&
        y >= clipY - height / 2 &&
        y <= clipY + height / 2
      ) {
        setSelectedClipId(clip.id);
        renderFrame(playhead);
        return;
      }
    }

    setSelectedClipId(null);
    renderFrame(playhead);
  }, [activeClips, playhead, renderFrame, assets]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Get canvas dimensions based on aspect ratio
  const getCanvasDimensions = useCallback(() => {
    const container = containerRef.current;
    if (!container) return { width: canvasWidth, height: canvasHeight };

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    let width = canvasWidth;
    let height = canvasHeight;

    switch (aspectRatio) {
      case '16:9':
        width = 1920;
        height = 1080;
        break;
      case '9:16':
        width = 1080;
        height = 1920;
        break;
      case '1:1':
        width = 1080;
        height = 1080;
        break;
      case '4:3':
        width = 1440;
        height = 1080;
        break;
      case 'free':
        width = canvasWidth;
        height = canvasHeight;
        break;
    }

    // Scale to fit container
    const scaleX = containerWidth / width;
    const scaleY = containerHeight / height;
    const scale = Math.min(scaleX, scaleY, 1);

    return {
      width,
      height,
      displayWidth: width * scale,
      displayHeight: height * scale,
    };
  }, [aspectRatio, canvasWidth, canvasHeight]);

  const dimensions = getCanvasDimensions();

  // Update canvas size when dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    renderFrame(playhead);
  }, [dimensions, playhead, renderFrame]);

  if (clips.length === 0) {
    return (
      <div className="assistant-editor-preview-panel" ref={containerRef}>
        <div className="assistant-editor-preview-empty">
          <p>No clips on timeline</p>
          <p className="assistant-editor-preview-hint">
            Drag media from the assets panel to the timeline to start editing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="assistant-editor-preview-panel" ref={containerRef}>
      {/* Aspect Ratio Controls */}
      <div className="assistant-editor-preview-controls">
        <div className="assistant-editor-preview-aspect-buttons">
          {(['16:9', '9:16', '1:1', '4:3', 'free'] as AspectRatio[]).map((ratio) => (
            <button
              key={ratio}
              className={`assistant-editor-preview-aspect-btn ${
                aspectRatio === ratio ? 'active' : ''
              }`}
              onClick={() => setAspectRatio(ratio)}
              type="button"
              title={`Aspect Ratio ${ratio}`}
            >
              {ratio === 'free' ? <Grid3x3 size={14} /> : ratio}
            </button>
          ))}
        </div>
        
        <button
          className="assistant-editor-preview-fullscreen-btn"
          onClick={toggleFullscreen}
          type="button"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      {/* Canvas */}
      <div className="assistant-editor-preview-canvas-container">
        <canvas
          ref={canvasRef}
          className="assistant-editor-preview-canvas"
          style={{
            width: dimensions.displayWidth,
            height: dimensions.displayHeight,
          }}
          onClick={handleCanvasClick}
        />
      </div>

      {/* Selected Clip Info */}
      {selectedClipId && (
        <div className="assistant-editor-preview-selected-info">
          <span>Selected Clip: {selectedClipId.substring(0, 8)}...</span>
          <button
            onClick={() => setSelectedClipId(null)}
            type="button"
            className="assistant-editor-preview-deselect-btn"
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
}
