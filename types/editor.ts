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
