import type { EditorSequence, EditorAsset, ExportJob } from '@/types/editor';
import { CompositionEngine } from './compositionEngine';

/**
 * Client-Side Video Renderer
 * Exports video directly in the browser using MediaRecorder API
 */

export type ClientRenderOptions = {
  format: 'webm' | 'mp4';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  fps: number;
  width: number;
  height: number;
  videoBitrate?: number;
  audioBitrate?: number;
};

export type RenderProgress = {
  currentFrame: number;
  totalFrames: number;
  progress: number; // 0-100
  estimatedTimeRemaining: number; // seconds
};

export class ClientRenderer {
  private engine: CompositionEngine;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private onProgress?: (progress: RenderProgress) => void;
  private onComplete?: (blob: Blob) => void;
  private onError?: (error: Error) => void;

  constructor() {
    this.engine = new CompositionEngine();
  }

  /**
   * Check if MediaRecorder is supported
   */
  static isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined';
  }

  /**
   * Get supported MIME types
   */
  static getSupportedMimeTypes(): string[] {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm;codecs=h264',
      'video/webm',
      'video/mp4',
    ];

    return types.filter((type) => {
      try {
        return MediaRecorder.isTypeSupported(type);
      } catch {
        return false;
      }
    });
  }

  /**
   * Get best MIME type for options
   */
  private getBestMimeType(format: 'webm' | 'mp4'): string {
    const supported = ClientRenderer.getSupportedMimeTypes();

    if (format === 'mp4') {
      const mp4Type = supported.find((t) => t.includes('mp4'));
      if (mp4Type) return mp4Type;
    }

    // Prefer VP9 for WebM
    const vp9Type = supported.find((t) => t.includes('vp9'));
    if (vp9Type) return vp9Type;

    // Fallback to VP8
    const vp8Type = supported.find((t) => t.includes('vp8'));
    if (vp8Type) return vp8Type;

    // Last resort
    return supported[0] || 'video/webm';
  }

  /**
   * Get bitrate for quality level
   */
  private getBitrate(quality: string, width: number, height: number): number {
    const pixels = width * height;
    const base = pixels / (1920 * 1080); // Normalize to 1080p

    switch (quality) {
      case 'low':
        return Math.floor(2_500_000 * base);
      case 'medium':
        return Math.floor(5_000_000 * base);
      case 'high':
        return Math.floor(8_000_000 * base);
      case 'ultra':
        return Math.floor(15_000_000 * base);
      default:
        return Math.floor(5_000_000 * base);
    }
  }

  /**
   * Render using MediaRecorder (real-time capture)
   */
  async renderWithMediaRecorder(
    sequence: EditorSequence,
    assets: EditorAsset[],
    options: ClientRenderOptions,
    callbacks: {
      onProgress?: (progress: RenderProgress) => void;
      onComplete?: (blob: Blob) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    this.onProgress = callbacks.onProgress;
    this.onComplete = callbacks.onComplete;
    this.onError = callbacks.onError;

    try {
      // Resize engine canvas
      this.engine.resize(options.width, options.height);

      // Get canvas and create stream
      const canvas = this.engine.getCanvas() as HTMLCanvasElement;
      const stream = canvas.captureStream(options.fps);

      // Setup MediaRecorder
      const mimeType = this.getBestMimeType(options.format);
      const bitrate = options.videoBitrate || this.getBitrate(options.quality, options.width, options.height);

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: bitrate,
        audioBitsPerSecond: options.audioBitrate || 128000,
      });

      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: mimeType });
        if (this.onComplete) {
          this.onComplete(blob);
        }
      };

      this.mediaRecorder.onerror = (e: Event) => {
        if (this.onError) {
          this.onError(new Error(`MediaRecorder error: ${e}`));
        }
      };

      // Start recording
      this.mediaRecorder.start();

      // Render frames
      const duration = sequence.duration;
      const frameTime = 1 / options.fps;
      const totalFrames = Math.ceil(duration * options.fps);
      let currentFrame = 0;
      const startTime = performance.now();

      const renderFrame = async (time: number) => {
        await this.engine.renderFrame(
          sequence.clips,
          sequence.tracks,
          assets,
          time
        );

        currentFrame++;
        const progress = (currentFrame / totalFrames) * 100;
        const elapsed = (performance.now() - startTime) / 1000;
        const estimatedTotal = (elapsed / currentFrame) * totalFrames;
        const estimatedRemaining = estimatedTotal - elapsed;

        if (this.onProgress) {
          this.onProgress({
            currentFrame,
            totalFrames,
            progress,
            estimatedTimeRemaining: estimatedRemaining,
          });
        }

        if (time + frameTime < duration) {
          // Schedule next frame
          setTimeout(() => renderFrame(time + frameTime), frameTime * 1000);
        } else {
          // Stop recording
          if (this.mediaRecorder) {
            this.mediaRecorder.stop();
          }
        }
      };

      // Start rendering
      await renderFrame(0);
    } catch (error) {
      if (this.onError) {
        this.onError(error as Error);
      }
    }
  }

  /**
   * Render frame-by-frame (higher quality but slower)
   */
  async renderFrameByFrame(
    sequence: EditorSequence,
    assets: EditorAsset[],
    options: ClientRenderOptions,
    callbacks: {
      onProgress?: (progress: RenderProgress) => void;
      onComplete?: (blob: Blob) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    this.onProgress = callbacks.onProgress;
    this.onComplete = callbacks.onComplete;
    this.onError = callbacks.onError;

    try {
      // Resize engine canvas
      this.engine.resize(options.width, options.height);

      const duration = sequence.duration;
      const frameTime = 1 / options.fps;
      const totalFrames = Math.ceil(duration * options.fps);
      const frames: Blob[] = [];
      const startTime = performance.now();

      // Render each frame
      for (let i = 0; i < totalFrames; i++) {
        const time = i * frameTime;

        await this.engine.renderFrame(
          sequence.clips,
          sequence.tracks,
          assets,
          time
        );

        // Convert canvas to blob
        const canvas = this.engine.getCanvas() as HTMLCanvasElement;
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => {
              if (b) resolve(b);
              else reject(new Error('Failed to convert canvas to blob'));
            },
            'image/png',
            1.0
          );
        });

        frames.push(blob);

        // Report progress
        const progress = ((i + 1) / totalFrames) * 100;
        const elapsed = (performance.now() - startTime) / 1000;
        const estimatedTotal = (elapsed / (i + 1)) * totalFrames;
        const estimatedRemaining = estimatedTotal - elapsed;

        if (this.onProgress) {
          this.onProgress({
            currentFrame: i + 1,
            totalFrames,
            progress,
            estimatedTimeRemaining: estimatedRemaining,
          });
        }
      }

      // Note: Frame-by-frame export would need additional processing
      // to combine frames into video. This could be done with FFmpeg.wasm
      // or by sending frames to server. For now, we'll just return the frames.

      // Create a simple WebM or send to server for encoding
      if (this.onComplete) {
        // This is a placeholder - in production, frames would be encoded
        const placeholder = new Blob([JSON.stringify({ frames: frames.length })], {
          type: 'application/json',
        });
        this.onComplete(placeholder);
      }
    } catch (error) {
      if (this.onError) {
        this.onError(error as Error);
      }
    }
  }

  /**
   * Cancel ongoing render
   */
  cancel() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Dispose resources
   */
  dispose() {
    this.cancel();
    this.engine.dispose();
  }
}

/**
 * Export video using best available method
 */
export async function exportVideo(
  sequence: EditorSequence,
  assets: EditorAsset[],
  options: ClientRenderOptions,
  callbacks: {
    onProgress?: (progress: RenderProgress) => void;
    onComplete?: (blob: Blob) => void;
    onError?: (error: Error) => void;
  }
): Promise<void> {
  const renderer = new ClientRenderer();

  if (ClientRenderer.isSupported()) {
    await renderer.renderWithMediaRecorder(sequence, assets, options, callbacks);
  } else {
    // Fallback to frame-by-frame
    await renderer.renderFrameByFrame(sequence, assets, options, callbacks);
  }
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

