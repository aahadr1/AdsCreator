// Shared types for the Auto Edit (beta) pipeline

export type UserUpload = {
  fileName: string;
  url: string;
  tags?: string[];
  aspect?: '16:9' | '9:16' | '1:1';
};

export type BRollVariantIdea = {
  idea_title: string;
  description: string;
  duration_sec: number;
  camera_motion: string;
  shot_type: string;
  lighting_mood: string;
  safety_notes?: string;
};

export type ScriptSegment = {
  segment_id: string;
  segment_text: string;
  variants: BRollVariantIdea[]; // length = 3
};

export type VariantGenerationPlan = {
  segment_id: string;
  variant_index: number; // 0..2
  prompt_text: string;
  must_have_elements: string[];
  negatives?: string[];
  aspect: '16:9' | '9:16';
  resolution: '480p' | '720p' | '1080p';
  frames_per_second: number; // default 16
  num_frames: number; // default 81
  seed?: number | null;
  selected_image: string | null; // fileName of user image
  synth_image_url?: string | null; // filled in Step 2b if needed
  why_this_image?: string;
};

export type VariantVideoAsset = {
  segment_id: string;
  variant_index: number;
  video_url: string;
  used_image_url: string;
  prompt_text: string;
  meta: {
    fps: number;
    frames: number;
    resolution: string;
    seed?: number | null;
  };
};

export type JobStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

export type ProgressEvent = {
  jobId: string;
  step: 'STEP_1' | 'STEP_2' | 'STEP_2B' | 'STEP_3' | 'STEP_4' | 'ERROR';
  label: string;
  status: JobStatus;
  payload?: unknown;
  error?: string;
};

export type StartJobRequest = {
  script: string;
  uploads: UserUpload[];
  settings?: {
    defaultAspect?: '9:16' | '16:9';
    defaultFps?: number;
    defaultFrames?: number;
  };
};

export type StartJobResponse = {
  jobId: string;
};


