export type EditorAsset = {
  id: string;
  type: 'image' | 'video' | 'audio' | 'text';
  url: string;
  thumbnail?: string;
  duration?: number; // for video/audio
  name: string;
  source: 'workflow' | 'upload' | 'task';
  sourceId?: string; // step ID, task ID, etc.
};

export type TimelineClip = {
  id: string;
  assetId: string;
  track: 'video' | 'audio';
  startTime: number; // in timeline (seconds)
  endTime: number; // in timeline (seconds)
  trimStart: number; // trim from start of source (seconds)
  trimEnd: number; // trim from end of source (seconds)
  fadeIn?: number; // fade in duration (seconds)
  fadeOut?: number; // fade out duration (seconds)
};

export type EditorState = {
  assets: EditorAsset[];
  clips: TimelineClip[];
  playhead: number;
  zoom: number;
  duration: number; // total timeline duration
  playing: boolean;
  selectedClipId?: string | null;
  volume?: number; // 0-1, default 1
  playbackSpeed?: number; // 0.25, 0.5, 1, 1.5, 2, default 1
  history?: EditorState[];
  historyIndex?: number;
};

