// ============================================================================
// ASSET TYPES
// ============================================================================

export type EditorAsset = {
  id: string;
  type: 'image' | 'video' | 'audio' | 'text';
  url: string;
  thumbnail?: string;
  duration?: number; // for video/audio
  name: string;
  source: 'workflow' | 'upload' | 'task';
  sourceId?: string; // step ID, task ID, etc.
  width?: number; // for video/image
  height?: number; // for video/image
  fps?: number; // for video
};

// ============================================================================
// TRACK TYPES
// ============================================================================

export type TrackType = 'video' | 'audio' | 'text';

export type Track = {
  id: string;
  type: TrackType;
  name: string;
  index: number; // z-index for layering
  height: number; // track height in pixels
  locked: boolean;
  muted: boolean;
  visible: boolean;
  color?: string; // custom color for organization
  group?: string; // group ID for synchronized editing
};

// ============================================================================
// KEYFRAME TYPES
// ============================================================================

export type EasingType = 
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'bezier';

export type KeyframeProperty = 
  | 'x' 
  | 'y' 
  | 'scale' 
  | 'scaleX'
  | 'scaleY'
  | 'rotation' 
  | 'opacity'
  | 'volume'
  | 'fontSize'
  | 'letterSpacing';

export type Keyframe = {
  id: string;
  time: number; // time on clip (not timeline)
  property: KeyframeProperty;
  value: number;
  easing: EasingType;
  bezierPoints?: [number, number, number, number]; // for bezier easing
};

// ============================================================================
// TRANSFORM & EFFECT TYPES
// ============================================================================

export type Transform = {
  x: number; // horizontal position (0 = center)
  y: number; // vertical position (0 = center)
  scale: number; // uniform scale
  scaleX: number; // horizontal scale
  scaleY: number; // vertical scale
  rotation: number; // degrees
  opacity: number; // 0-1
  anchorX: number; // 0-1 (pivot point)
  anchorY: number; // 0-1 (pivot point)
};

export type BlendMode = 
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'colorDodge'
  | 'colorBurn'
  | 'hardLight'
  | 'softLight'
  | 'difference'
  | 'exclusion';

export type Filter = {
  id: string;
  type: 'blur' | 'brightness' | 'contrast' | 'saturation' | 'hue' | 'grayscale' | 'sepia' | 'invert';
  enabled: boolean;
  value: number; // 0-100 or appropriate range
};

export type Transition = {
  id: string;
  type: 'fade' | 'dissolve' | 'wipe' | 'slide' | 'zoom';
  duration: number; // seconds
  easing: EasingType;
};

export type Mask = {
  id: string;
  type: 'rectangle' | 'circle' | 'polygon';
  enabled: boolean;
  inverted: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  feather: number; // edge softness
};

// ============================================================================
// CLIP TYPES
// ============================================================================

export type BaseClip = {
  id: string;
  trackId: string;
  startTime: number; // in timeline (seconds)
  endTime: number; // in timeline (seconds)
  locked: boolean;
  name?: string;
  color?: string;
};

export type MediaClip = BaseClip & {
  type: 'video' | 'audio' | 'image';
  assetId: string;
  trimStart: number; // trim from start of source (seconds)
  trimEnd: number; // trim from end of source (seconds)
  fadeIn?: number; // fade in duration (seconds)
  fadeOut?: number; // fade out duration (seconds)
  transform: Transform;
  keyframes: Keyframe[];
  filters: Filter[];
  blendMode: BlendMode;
  mask?: Mask;
  volume?: number; // 0-1 for audio/video
  speed?: number; // playback speed multiplier
};

export type TextClip = BaseClip & {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontStyle: 'normal' | 'italic';
  color: string;
  backgroundColor?: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  letterSpacing: number;
  textShadow?: {
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
  };
  stroke?: {
    width: number;
    color: string;
  };
  transform: Transform;
  keyframes: Keyframe[];
  blendMode: BlendMode;
  animation?: {
    type: 'fadeIn' | 'fadeOut' | 'typewriter' | 'slideIn' | 'slideOut' | 'bounce' | 'none';
    duration: number;
    delay: number;
  };
};

export type SequenceClip = BaseClip & {
  type: 'sequence';
  sequenceId: string; // reference to another EditorSequence
  transform: Transform;
  keyframes: Keyframe[];
  blendMode: BlendMode;
};

export type CompoundClip = BaseClip & {
  type: 'compound';
  clipIds: string[]; // IDs of clips grouped together
  collapsed: boolean;
};

export type TimelineClip = MediaClip | TextClip | SequenceClip | CompoundClip;

// ============================================================================
// SEQUENCE & PROJECT TYPES
// ============================================================================

export type Marker = {
  id: string;
  time: number;
  name: string;
  color?: string;
};

export type Region = {
  id: string;
  startTime: number;
  endTime: number;
  name: string;
  color?: string;
};

export type EditorSequence = {
  id: string;
  name: string;
  tracks: Track[];
  clips: TimelineClip[];
  markers: Marker[];
  regions: Region[];
  duration: number;
  fps: number; // frames per second
  width: number; // canvas width
  height: number; // canvas height
};

// ============================================================================
// EDITOR STATE & HISTORY
// ============================================================================

export type EditorTool = 
  | 'select'
  | 'razor'
  | 'slip'
  | 'slide'
  | 'text'
  | 'shape';

export type HistoryAction = {
  id: string;
  type: string;
  timestamp: number;
  description: string;
  undo: () => void;
  redo: () => void;
};

export type EditorState = {
  // Current sequence
  currentSequenceId: string;
  sequences: Record<string, EditorSequence>;
  
  // Assets
  assets: EditorAsset[];
  
  // Playback
  playhead: number;
  playing: boolean;
  loop: boolean;
  volume: number; // 0-1, master volume
  playbackSpeed: number; // 0.25, 0.5, 1, 1.5, 2
  
  // UI State
  zoom: number; // horizontal zoom
  verticalZoom: number; // track height multiplier
  selectedClipIds: string[]; // multi-select support
  selectedTrackId: string | null;
  activeTool: EditorTool;
  
  // Timeline settings
  snapEnabled: boolean;
  snapTolerance: number; // milliseconds
  magneticTimeline: boolean;
  showWaveforms: boolean;
  showThumbnails: boolean;
  
  // History
  history: HistoryAction[];
  historyIndex: number;
  
  // Panels visibility
  panels: {
    assets: boolean;
    inspector: boolean;
    keyframes: boolean;
    effects: boolean;
    text: boolean;
  };
  
  // Export settings
  exportSettings: {
    format: 'mp4' | 'webm' | 'mov' | 'gif' | 'mp3';
    resolution: '480p' | '720p' | '1080p' | '1440p' | '4k' | 'source';
    quality: 'low' | 'medium' | 'high' | 'ultra';
    fps: number;
    codec: string;
  };
};

// ============================================================================
// EXPORT & RENDER TYPES
// ============================================================================

export type ExportMode = 'client' | 'server';

export type ExportJob = {
  id: string;
  sequenceId: string;
  mode: ExportMode;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  startTime: number;
  endTime?: number;
  error?: string;
  outputUrl?: string;
  settings: EditorState['exportSettings'];
};

export type RenderFrame = {
  time: number;
  layers: Array<{
    clip: TimelineClip;
    asset?: EditorAsset;
    transform: Transform;
    opacity: number;
    blendMode: BlendMode;
  }>;
};

// ============================================================================
// COMPOSITION ENGINE TYPES
// ============================================================================

export type CompositionLayer = {
  id: string;
  clip: TimelineClip;
  asset?: EditorAsset;
  transform: Transform;
  filters: Filter[];
  blendMode: BlendMode;
  mask?: Mask;
  zIndex: number;
  visible: boolean;
};

export type CompositionFrame = {
  time: number;
  width: number;
  height: number;
  layers: CompositionLayer[];
  backgroundColor: string;
};

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Point = {
  x: number;
  y: number;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TimeRange = {
  start: number;
  end: number;
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isMediaClip(clip: TimelineClip): clip is MediaClip {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'image';
}

export function isTextClip(clip: TimelineClip): clip is TextClip {
  return clip.type === 'text';
}

export function isSequenceClip(clip: TimelineClip): clip is SequenceClip {
  return clip.type === 'sequence';
}

export function isCompoundClip(clip: TimelineClip): clip is CompoundClip {
  return clip.type === 'compound';
}

export function isVideoTrack(track: Track): boolean {
  return track.type === 'video';
}

export function isAudioTrack(track: Track): boolean {
  return track.type === 'audio';
}

export function isTextTrack(track: Track): boolean {
  return track.type === 'text';
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1,
  anchorX: 0.5,
  anchorY: 0.5,
};

export const DEFAULT_TRACK_HEIGHT = 60;
export const DEFAULT_FPS = 30;
export const DEFAULT_CANVAS_WIDTH = 1920;
export const DEFAULT_CANVAS_HEIGHT = 1080;

export const WEB_SAFE_FONTS = [
  'Arial',
  'Arial Black',
  'Verdana',
  'Helvetica',
  'Tahoma',
  'Trebuchet MS',
  'Times New Roman',
  'Georgia',
  'Garamond',
  'Courier New',
  'Brush Script MT',
  'Impact',
  'Comic Sans MS',
] as const;

// ============================================================================
// VIDEOSOS TYPES (for integration)
// ============================================================================

export type VideoSOSAspectRatio = "16:9" | "9:16" | "1:1";

export type VideoSOSProject = {
  id: string;
  title: string;
  description: string;
  aspectRatio: VideoSOSAspectRatio;
  duration?: number; // in milliseconds
};

export type VideoSOSTrackType = "video" | "music" | "voiceover";

export const VIDEO_SOS_TRACK_TYPE_ORDER: Record<VideoSOSTrackType, number> = {
  video: 1,
  music: 2,
  voiceover: 3,
};

export type VideoSOSTrack = {
  id: string;
  locked: boolean;
  label: string;
  type: VideoSOSTrackType;
  projectId: string;
};

export type VideoSOSKeyFrameData = {
  type: "prompt" | "image" | "video" | "voiceover" | "music";
  mediaId: string;
} & (
  | {
      type: "prompt";
      prompt: string;
    }
  | {
      type: "image";
      prompt: string;
      url: string;
    }
  | {
      type: "video";
      prompt: string;
      url: string;
    }
  | {
      type: "voiceover";
      prompt: string;
      url: string;
    }
  | {
      type: "music";
      prompt: string;
      url: string;
    }
);

export type VideoSOSKeyFrame = {
  id: string;
  timestamp: number; // in seconds
  duration: number; // in seconds
  trackId: string;
  data: VideoSOSKeyFrameData;
};

export type VideoSOSMediaItem = {
  id: string;
  kind: "generated" | "uploaded";
  provider?: "fal" | "runware";
  endpointId?: string;
  requestId?: string;
  taskUUID?: string;
  projectId: string;
  mediaType: "image" | "video" | "music" | "voiceover";
  status: "pending" | "running" | "completed" | "failed";
  createdAt: number;
  input?: Record<string, any>;
  output?: Record<string, any>;
  url?: string;
  blob?: Blob;
  thumbnailBlob?: Blob;
  metadata?: Record<string, any>;
} & (
  | {
      kind: "generated";
      provider?: "fal" | "runware";
      endpointId: string;
      requestId?: string;
      taskUUID?: string;
      input: Record<string, any>;
      output?: Record<string, any>;
    }
  | {
      kind: "uploaded";
      url: string;
      blob?: Blob;
    }
);

// ============================================================================
// ADAPTER FUNCTIONS (convert between systems)
// ============================================================================

/**
 * Convert EditorAsset to VideoSOSMediaItem
 */
export function editorAssetToVideoSOSMedia(
  asset: EditorAsset,
  projectId: string
): VideoSOSMediaItem {
  // Map type: 'audio' -> 'music', 'text' -> not supported in VideoSOS
  const mediaType: VideoSOSMediaItem['mediaType'] =
    asset.type === 'audio' ? 'music' :
    asset.type === 'text' ? 'image' : // fallback
    asset.type === 'image' ? 'image' :
    asset.type === 'video' ? 'video' : 'image';

  return {
    id: asset.id,
    kind: asset.source === 'upload' ? 'uploaded' : 'uploaded', // treat workflow/task as uploaded
    projectId,
    mediaType,
    status: 'completed',
    createdAt: Date.now(),
    url: asset.url,
    metadata: {
      name: asset.name,
      duration: asset.duration,
      width: asset.width,
      height: asset.height,
      fps: asset.fps,
      source: asset.source,
      sourceId: asset.sourceId,
    },
    ...(asset.thumbnail && {
      thumbnailBlob: undefined, // would need to convert URL to blob
    }),
  };
}

/**
 * Convert VideoSOSMediaItem to EditorAsset
 */
export function videoSOSMediaToEditorAsset(
  media: VideoSOSMediaItem,
  source: EditorAsset['source'] = 'upload'
): EditorAsset {
  const type: EditorAsset['type'] =
    media.mediaType === 'music' ? 'audio' :
    media.mediaType === 'voiceover' ? 'audio' :
    media.mediaType === 'video' ? 'video' :
    media.mediaType === 'image' ? 'image' : 'image';

  const url = media.url || (media.blob ? URL.createObjectURL(media.blob) : '');

  return {
    id: media.id,
    type,
    url,
    name: media.metadata?.name || `Media ${media.id.substring(0, 8)}`,
    source,
    duration: media.metadata?.duration,
    width: media.metadata?.width,
    height: media.metadata?.height,
    fps: media.metadata?.fps,
    thumbnail: media.thumbnailBlob ? URL.createObjectURL(media.thumbnailBlob) : undefined,
  };
}

/**
 * Convert Track to VideoSOSTrack
 */
export function trackToVideoSOSTrack(
  track: Track,
  projectId: string
): VideoSOSTrack {
  const type: VideoSOSTrackType =
    track.type === 'audio' ? 'music' :
    track.type === 'video' ? 'video' :
    'music'; // fallback for text tracks

  return {
    id: track.id,
    locked: track.locked,
    label: track.name,
    type,
    projectId,
  };
}

/**
 * Convert VideoSOSTrack to Track
 */
export function videoSOSTrackToTrack(
  track: VideoSOSTrack,
  index: number
): Track {
  const type: TrackType =
    track.type === 'music' ? 'audio' :
    track.type === 'voiceover' ? 'audio' :
    track.type === 'video' ? 'video' :
    'audio';

  return {
    id: track.id,
    type,
    name: track.label,
    index,
    height: DEFAULT_TRACK_HEIGHT,
    locked: track.locked,
    muted: false,
    visible: true,
  };
}
