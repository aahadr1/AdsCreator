import type { EditorSequence, EditorAsset, MediaClip, TextClip, ExportJob } from '@/types/editor';
import { isMediaClip, isTextClip } from '@/types/editor';

/**
 * Server-Side FFmpeg Renderer
 * Generates FFmpeg commands from timeline data for high-quality exports
 */

export type FFmpegExportOptions = {
  format: 'mp4' | 'mov' | 'webm' | 'gif' | 'mp3';
  resolution: '480p' | '720p' | '1080p' | '1440p' | '4k' | 'source';
  fps: number;
  codec: 'h264' | 'h265' | 'vp9' | 'prores';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  preset: 'ultrafast' | 'fast' | 'medium' | 'slow' | 'veryslow';
};

/**
 * Get resolution dimensions
 */
function getResolutionDimensions(
  resolution: string,
  sourceWidth: number,
  sourceHeight: number
): { width: number; height: number } {
  switch (resolution) {
    case '480p':
      return { width: 854, height: 480 };
    case '720p':
      return { width: 1280, height: 720 };
    case '1080p':
      return { width: 1920, height: 1080 };
    case '1440p':
      return { width: 2560, height: 1440 };
    case '4k':
      return { width: 3840, height: 2160 };
    case 'source':
    default:
      return { width: sourceWidth, height: sourceHeight };
  }
}

/**
 * Get CRF value based on quality
 */
function getCRF(quality: string, codec: string): number {
  const crfMap: Record<string, Record<string, number>> = {
    h264: { low: 28, medium: 23, high: 18, ultra: 15 },
    h265: { low: 30, medium: 26, high: 22, ultra: 18 },
    vp9: { low: 40, medium: 31, high: 24, ultra: 15 },
  };

  return crfMap[codec]?.[quality] || 23;
}

/**
 * Generate FFmpeg filter_complex for a single clip
 */
function generateClipFilter(
  clip: MediaClip,
  asset: EditorAsset,
  inputIndex: number,
  canvasWidth: number,
  canvasHeight: number
): string[] {
  const filters: string[] = [];

  // Input
  let filterChain = `[${inputIndex}:v]`;

  // Trim
  if (clip.trimStart > 0 || clip.trimEnd > 0) {
    const duration = (asset.duration || 0) - clip.trimStart - clip.trimEnd;
    filterChain += `trim=start=${clip.trimStart}:duration=${duration},setpts=PTS-STARTPTS,`;
  }

  // Speed adjustment
  if (clip.speed && clip.speed !== 1) {
    filterChain += `setpts=${1 / clip.speed}*PTS,`;
  }

  // Scale (transform.scale)
  const scale = clip.transform.scale * clip.transform.scaleX;
  const scaleY = clip.transform.scale * clip.transform.scaleY;
  if (scale !== 1 || scaleY !== 1) {
    filterChain += `scale=iw*${scale}:ih*${scaleY},`;
  }

  // Rotation
  if (clip.transform.rotation !== 0) {
    const radians = (clip.transform.rotation * Math.PI) / 180;
    filterChain += `rotate=${radians},`;
  }

  // Opacity
  if (clip.transform.opacity !== 1) {
    filterChain += `format=yuva420p,colorchannelmixer=aa=${clip.transform.opacity},`;
  }

  // Filters
  clip.filters.forEach((filter) => {
    if (!filter.enabled) return;

    switch (filter.type) {
      case 'blur':
        filterChain += `gblur=sigma=${filter.value / 10},`;
        break;
      case 'brightness':
        filterChain += `eq=brightness=${(filter.value - 100) / 100},`;
        break;
      case 'contrast':
        filterChain += `eq=contrast=${filter.value / 100},`;
        break;
      case 'saturation':
        filterChain += `eq=saturation=${filter.value / 100},`;
        break;
      case 'hue':
        filterChain += `hue=h=${filter.value},`;
        break;
      case 'grayscale':
        filterChain += `hue=s=0,`;
        break;
    }
  });

  // Position overlay
  const x = canvasWidth / 2 + clip.transform.x;
  const y = canvasHeight / 2 + clip.transform.y;
  filterChain += `[v${inputIndex}]`;

  filters.push(filterChain);

  return filters;
}

/**
 * Generate FFmpeg command for timeline export
 */
export function generateFFmpegCommand(
  sequence: EditorSequence,
  assets: EditorAsset[],
  options: FFmpegExportOptions,
  outputPath: string
): string {
  const { width, height } = getResolutionDimensions(
    options.resolution,
    sequence.width,
    sequence.height
  );

  const crf = getCRF(options.quality, options.codec);

  // Input files
  const inputs: string[] = [];
  const mediaClips = sequence.clips.filter(isMediaClip);

  mediaClips.forEach((clip) => {
    const asset = assets.find((a) => a.id === clip.assetId);
    if (asset) {
      inputs.push(`-i "${asset.url}"`);
    }
  });

  // Build filter_complex
  const filterComplexParts: string[] = [];

  // Create base canvas
  filterComplexParts.push(
    `color=c=black:s=${width}x${height}:r=${options.fps}:d=${sequence.duration}[base]`
  );

  // Process each video clip
  mediaClips.forEach((clip, index) => {
    const asset = assets.find((a) => a.id === clip.assetId);
    if (!asset) return;

    const clipFilters = generateClipFilter(clip, asset, index, width, height);
    filterComplexParts.push(...clipFilters);
  });

  // Overlay clips onto base
  let overlayChain = '[base]';
  mediaClips.forEach((clip, index) => {
    const x = width / 2 + clip.transform.x;
    const y = height / 2 + clip.transform.y;
    const enableTime = `enable='between(t,${clip.startTime},${clip.endTime})'`;

    overlayChain += `[v${index}]overlay=${x}:${y}:${enableTime}`;

    if (index < mediaClips.length - 1) {
      overlayChain += `[tmp${index}];[tmp${index}]`;
    }
  });

  filterComplexParts.push(overlayChain);

  const filterComplex = filterComplexParts.join(';');

  // Build command
  const codecParams: string[] = [];

  switch (options.codec) {
    case 'h264':
      codecParams.push(`-c:v libx264`);
      codecParams.push(`-preset ${options.preset}`);
      codecParams.push(`-crf ${crf}`);
      break;
    case 'h265':
      codecParams.push(`-c:v libx265`);
      codecParams.push(`-preset ${options.preset}`);
      codecParams.push(`-crf ${crf}`);
      break;
    case 'vp9':
      codecParams.push(`-c:v libvpx-vp9`);
      codecParams.push(`-crf ${crf}`);
      codecParams.push(`-b:v 0`);
      break;
    case 'prores':
      codecParams.push(`-c:v prores_ks`);
      codecParams.push(`-profile:v 3`);
      break;
  }

  const command = [
    'ffmpeg',
    ...inputs,
    `-filter_complex "${filterComplex}"`,
    `-r ${options.fps}`,
    ...codecParams,
    `-c:a aac`,
    `-b:a 192k`,
    `-pix_fmt yuv420p`,
    `-movflags +faststart`,
    outputPath,
  ].join(' ');

  return command;
}

/**
 * Generate timeline JSON for server-side rendering
 */
export function generateTimelineJSON(
  sequence: EditorSequence,
  assets: EditorAsset[]
): string {
  const timeline = {
    version: '1.0',
    sequence: {
      ...sequence,
      clips: sequence.clips.map((clip) => {
        if (isMediaClip(clip)) {
          const asset = assets.find((a) => a.id === clip.assetId);
          return {
            ...clip,
            asset: asset
              ? {
                  url: asset.url,
                  type: asset.type,
                  duration: asset.duration,
                  width: asset.width,
                  height: asset.height,
                }
              : null,
          };
        }
        return clip;
      }),
    },
  };

  return JSON.stringify(timeline, null, 2);
}

/**
 * Validate timeline for server rendering
 */
export function validateTimeline(
  sequence: EditorSequence,
  assets: EditorAsset[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check all clips have valid assets
  sequence.clips.forEach((clip) => {
    if (isMediaClip(clip)) {
      const asset = assets.find((a) => a.id === clip.assetId);
      if (!asset) {
        errors.push(`Clip ${clip.id} references missing asset ${clip.assetId}`);
      } else if (!asset.url) {
        errors.push(`Asset ${asset.id} has no URL`);
      }
    }
  });

  // Check duration is valid
  if (sequence.duration <= 0) {
    errors.push('Sequence duration must be greater than 0');
  }

  // Check tracks exist
  if (sequence.tracks.length === 0) {
    errors.push('Sequence must have at least one track');
  }

  // Check clips are within sequence duration
  sequence.clips.forEach((clip) => {
    if (clip.endTime > sequence.duration) {
      errors.push(
        `Clip ${clip.id} extends beyond sequence duration (${clip.endTime} > ${sequence.duration})`
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Estimate render time based on sequence complexity
 */
export function estimateRenderTime(
  sequence: EditorSequence,
  options: FFmpegExportOptions
): number {
  // Basic estimation: 1 second of video takes ~2-5 seconds to render
  // depending on resolution and quality

  let multiplier = 2;

  // Adjust for resolution
  const { width, height } = getResolutionDimensions(
    options.resolution,
    sequence.width,
    sequence.height
  );
  const pixels = width * height;
  const basePixels = 1920 * 1080;
  multiplier *= pixels / basePixels;

  // Adjust for quality/preset
  if (options.preset === 'veryslow') multiplier *= 3;
  else if (options.preset === 'slow') multiplier *= 2;
  else if (options.preset === 'ultrafast') multiplier *= 0.5;

  // Adjust for codec
  if (options.codec === 'h265' || options.codec === 'vp9') multiplier *= 1.5;
  if (options.codec === 'prores') multiplier *= 0.8;

  // Adjust for clip count (more clips = more complexity)
  multiplier *= Math.min(1 + sequence.clips.length * 0.1, 3);

  return sequence.duration * multiplier;
}

