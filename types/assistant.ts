// Simplified assistant types - UGC only
export type AssistantToolKind = 'ugc';

export type AssistantMedia = {
  type: 'image' | 'video' | 'audio' | 'url' | 'unknown';
  url: string;
  label?: string;
};

export type AssistantPlanMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

// UGC-specific types
export type UgcBrief = {
  product: string;
  targetAudience: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'other';
  offer?: string;
  brandVibe?: string;
  language?: string;
  constraints?: string;
  mustInclude?: string;
};

export type UgcCreator = {
  id: string;
  label: string;
  description: string;
  imageUrl?: string;
  jobId?: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  prompt: string;
};

export type UgcScene = {
  id: string;
  order: number;
  beatType: 'hook' | 'problem' | 'solution' | 'proof' | 'cta' | 'transition';
  duration: number; // seconds
  script: string;
  visualDescription: string;
  imageUrl?: string;
  imageJobId?: string;
  videoUrl?: string;
  videoJobId?: string;
  status: 'pending' | 'image_processing' | 'image_ready' | 'video_processing' | 'video_ready' | 'failed';
  onScreenText?: string;
  soundNote?: string;
};

export type UgcProject = {
  id: string;
  brief: Partial<UgcBrief>;
  creators: UgcCreator[];
  selectedCreatorId?: string;
  script?: string;
  scenes: UgcScene[];
  finalVideoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

// Chat message type for the interface
export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: AssistantMedia[];
  // UGC-specific data
  ugcData?: {
    creators?: UgcCreator[];
    scenes?: UgcScene[];
    brief?: Partial<UgcBrief>;
    projectId?: string;
  };
};
