import type {
  EditorAsset,
  TimelineClip,
  Track,
  Transform,
  CompositionLayer,
  CompositionFrame,
  Filter,
  BlendMode,
  MediaClip,
  TextClip,
} from '@/types/editor';
import { isMediaClip, isTextClip, DEFAULT_TRANSFORM } from '@/types/editor';
import { getAnimatedTransform } from './keyframeEngine';

/**
 * Composition Engine
 * Renders multiple layers with transforms, effects, and blend modes
 */

export class CompositionEngine {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private width: number;
  private height: number;

  // Cache for loaded media elements
  private mediaCache = new Map<string, HTMLVideoElement | HTMLImageElement>();
  private loadingPromises = new Map<string, Promise<HTMLVideoElement | HTMLImageElement>>();

  constructor(
    width: number = 1920,
    height: number = 1080,
    useOffscreen: boolean = false
  ) {
    this.width = width;
    this.height = height;

    if (useOffscreen && typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(width, height);
      this.ctx = this.canvas.getContext('2d', {
        alpha: true,
        desynchronized: true,
      }) as OffscreenCanvasRenderingContext2D;
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx = this.canvas.getContext('2d', {
        alpha: true,
        desynchronized: true,
      }) as CanvasRenderingContext2D;
    }
  }

  /**
   * Load media element (video or image) with caching
   */
  private async loadMedia(url: string, type: 'video' | 'image'): Promise<HTMLVideoElement | HTMLImageElement> {
    // Check cache
    if (this.mediaCache.has(url)) {
      return this.mediaCache.get(url)!;
    }

    // Check if already loading
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    // Start loading
    const promise = new Promise<HTMLVideoElement | HTMLImageElement>((resolve, reject) => {
      if (type === 'video') {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'auto';
        video.muted = false;
        video.playsInline = true;

        const proxiedUrl = url.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(url)}` : url;
        video.src = proxiedUrl;

        video.addEventListener('loadeddata', () => {
          this.mediaCache.set(url, video);
          this.loadingPromises.delete(url);
          resolve(video);
        });

        video.addEventListener('error', (e) => {
          // Try direct URL if proxy fails
          if (video.src.includes('/api/proxy') && video.src !== url) {
            video.src = url;
          } else {
            this.loadingPromises.delete(url);
            reject(e);
          }
        });

        video.load();
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        const proxiedUrl = url.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(url)}` : url;
        img.src = proxiedUrl;

        img.onload = () => {
          this.mediaCache.set(url, img);
          this.loadingPromises.delete(url);
          resolve(img);
        };

        img.onerror = (e) => {
          // Try direct URL if proxy fails
          if (img.src.includes('/api/proxy') && img.src !== url) {
            img.src = url;
          } else {
            this.loadingPromises.delete(url);
            reject(e);
          }
        };
      }
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }

  /**
   * Apply transform to canvas context
   */
  private applyTransform(transform: Transform) {
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    // Translate to position
    this.ctx.translate(centerX + transform.x, centerY + transform.y);

    // Rotate
    if (transform.rotation !== 0) {
      this.ctx.rotate((transform.rotation * Math.PI) / 180);
    }

    // Scale
    this.ctx.scale(transform.scale * transform.scaleX, transform.scale * transform.scaleY);

    // Apply opacity
    this.ctx.globalAlpha = transform.opacity;
  }

  /**
   * Apply filters to canvas context
   */
  private applyFilters(filters: Filter[]) {
    const filterStrings: string[] = [];

    filters.forEach((filter) => {
      if (!filter.enabled) return;

      switch (filter.type) {
        case 'blur':
          filterStrings.push(`blur(${filter.value}px)`);
          break;
        case 'brightness':
          filterStrings.push(`brightness(${filter.value}%)`);
          break;
        case 'contrast':
          filterStrings.push(`contrast(${filter.value}%)`);
          break;
        case 'saturation':
          filterStrings.push(`saturate(${filter.value}%)`);
          break;
        case 'hue':
          filterStrings.push(`hue-rotate(${filter.value}deg)`);
          break;
        case 'grayscale':
          filterStrings.push(`grayscale(${filter.value}%)`);
          break;
        case 'sepia':
          filterStrings.push(`sepia(${filter.value}%)`);
          break;
        case 'invert':
          filterStrings.push(`invert(${filter.value}%)`);
          break;
      }
    });

    this.ctx.filter = filterStrings.join(' ') || 'none';
  }

  /**
   * Apply blend mode
   */
  private applyBlendMode(blendMode: BlendMode) {
    this.ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
  }

  /**
   * Render a media clip (video/image)
   */
  private async renderMediaClip(
    clip: MediaClip,
    asset: EditorAsset,
    clipTime: number
  ): Promise<void> {
    try {
      const media = await this.loadMedia(asset.url, asset.type === 'image' ? 'image' : 'video');

      // For video, seek to correct time
      if (media instanceof HTMLVideoElement) {
        const sourceTime = clipTime + clip.trimStart;
        if (Math.abs(media.currentTime - sourceTime) > 0.1) {
          media.currentTime = sourceTime;
        }
      }

      // Get animated transform
      const transform = getAnimatedTransform(
        clip.keyframes,
        clipTime,
        clip.transform
      );

      // Save context
      this.ctx.save();

      // Apply blend mode
      this.applyBlendMode(clip.blendMode);

      // Apply filters
      this.applyFilters(clip.filters);

      // Apply transform
      this.applyTransform(transform);

      // Draw media
      const mediaWidth = asset.width || media.width || this.width;
      const mediaHeight = asset.height || media.height || this.height;

      this.ctx.drawImage(
        media,
        -mediaWidth / 2,
        -mediaHeight / 2,
        mediaWidth,
        mediaHeight
      );

      // Restore context
      this.ctx.restore();
    } catch (error) {
      console.error('Error rendering media clip:', error);
    }
  }

  /**
   * Render a text clip
   */
  private renderTextClip(clip: TextClip, clipTime: number): void {
    // Get animated transform
    const transform = getAnimatedTransform(
      clip.keyframes,
      clipTime,
      clip.transform
    );

    // Save context
    this.ctx.save();

    // Apply blend mode
    this.applyBlendMode(clip.blendMode);

    // Apply transform
    this.applyTransform(transform);

    // Set text styles
    this.ctx.font = `${clip.fontStyle} ${clip.fontWeight} ${clip.fontSize}px ${clip.fontFamily}`;
    // Canvas doesn't support 'justify', map it to 'left'
    this.ctx.textAlign = (clip.textAlign === 'justify' ? 'left' : clip.textAlign) as CanvasTextAlign;
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = clip.color;

    // Apply text shadow
    if (clip.textShadow) {
      this.ctx.shadowOffsetX = clip.textShadow.offsetX;
      this.ctx.shadowOffsetY = clip.textShadow.offsetY;
      this.ctx.shadowBlur = clip.textShadow.blur;
      this.ctx.shadowColor = clip.textShadow.color;
    }

    // Apply background if specified
    if (clip.backgroundColor) {
      const metrics = this.ctx.measureText(clip.text);
      const padding = 10;
      this.ctx.fillStyle = clip.backgroundColor;
      this.ctx.fillRect(
        -metrics.width / 2 - padding,
        -clip.fontSize / 2 - padding,
        metrics.width + padding * 2,
        clip.fontSize + padding * 2
      );
      this.ctx.fillStyle = clip.color;
    }

    // Draw text
    const lines = clip.text.split('\n');
    const lineHeight = clip.fontSize * clip.lineHeight;
    const totalHeight = lines.length * lineHeight;
    const startY = -totalHeight / 2 + lineHeight / 2;

    lines.forEach((line, index) => {
      const y = startY + index * lineHeight;

      // Draw stroke if specified
      if (clip.stroke) {
        this.ctx.strokeStyle = clip.stroke.color;
        this.ctx.lineWidth = clip.stroke.width;
        this.ctx.strokeText(line, 0, y);
      }

      // Draw fill
      this.ctx.fillText(line, 0, y);
    });

    // Restore context
    this.ctx.restore();
  }

  /**
   * Build composition layers from clips at a specific time
   */
  buildLayers(
    clips: TimelineClip[],
    tracks: Track[],
    assets: EditorAsset[],
    playhead: number
  ): CompositionLayer[] {
    const layers: CompositionLayer[] = [];

    // Filter clips that are active at current time
    const activeClips = clips.filter(
      (clip) => playhead >= clip.startTime && playhead < clip.endTime
    );

    // Sort by track index (z-order)
    const sortedClips = activeClips.sort((a, b) => {
      const trackA = tracks.find((t) => t.id === a.trackId);
      const trackB = tracks.find((t) => t.id === b.trackId);
      return (trackA?.index || 0) - (trackB?.index || 0);
    });

    // Build layers
    for (const clip of sortedClips) {
      const track = tracks.find((t) => t.id === clip.trackId);
      
      // Skip if track is not visible
      if (!track || !track.visible) continue;

      const clipTime = playhead - clip.startTime;

      if (isMediaClip(clip)) {
        const asset = assets.find((a) => a.id === clip.assetId);
        if (!asset) continue;

        const transform = getAnimatedTransform(
          clip.keyframes,
          clipTime,
          clip.transform
        );

        layers.push({
          id: clip.id,
          clip,
          asset,
          transform,
          filters: clip.filters,
          blendMode: clip.blendMode,
          mask: clip.mask,
          zIndex: track.index,
          visible: track.visible,
        });
      } else if (isTextClip(clip)) {
        const transform = getAnimatedTransform(
          clip.keyframes,
          clipTime,
          clip.transform
        );

        layers.push({
          id: clip.id,
          clip,
          transform,
          filters: [],
          blendMode: clip.blendMode,
          zIndex: track.index,
          visible: track.visible,
        });
      }
    }

    return layers;
  }

  /**
   * Render a single frame
   */
  async renderFrame(
    clips: TimelineClip[],
    tracks: Track[],
    assets: EditorAsset[],
    playhead: number,
    backgroundColor: string = '#000000'
  ): Promise<HTMLCanvasElement | OffscreenCanvas> {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Fill background
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Build layers
    const layers = this.buildLayers(clips, tracks, assets, playhead);

    // Render each layer
    for (const layer of layers) {
      if (!layer.visible) continue;

      const clipTime = playhead - layer.clip.startTime;

      if (isMediaClip(layer.clip) && layer.asset) {
        await this.renderMediaClip(layer.clip, layer.asset, clipTime);
      } else if (isTextClip(layer.clip)) {
        this.renderTextClip(layer.clip, clipTime);
      }
    }

    return this.canvas;
  }

  /**
   * Get canvas for direct manipulation
   */
  getCanvas(): HTMLCanvasElement | OffscreenCanvas {
    return this.canvas;
  }

  /**
   * Get context for direct manipulation
   */
  getContext(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * Resize canvas
   */
  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Clear media cache
   */
  clearCache() {
    this.mediaCache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Dispose resources
   */
  dispose() {
    this.clearCache();
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}

// Export singleton factory
let compositionEngineInstance: CompositionEngine | null = null;

export function getCompositionEngine(
  width?: number,
  height?: number,
  recreate: boolean = false
): CompositionEngine {
  if (!compositionEngineInstance || recreate) {
    compositionEngineInstance = new CompositionEngine(width, height);
  }
  return compositionEngineInstance;
}

