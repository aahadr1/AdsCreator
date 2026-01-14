export type UgcAvatarPickerBlock = {
  blockType: 'ugc_avatar_picker';
  id: string;
  data: {
    avatars: Array<{
      id: string;
      url?: string;
      jobId?: string;
      prompt: string;
      status: 'pending' | 'processing' | 'complete' | 'failed';
    }>;
    selectedAvatarId?: string;
    refinementPrompt?: string;
  };
};

export type UgcStoryboardLinkBlock = {
  blockType: 'ugc_storyboard_link';
  id: string;
  data: {
    storyboard: {
      scenes: Array<{
        id: string;
        imageJobId?: string;
        imageUrl?: string;
        description: string;
        script: string;
        status?: 'pending' | 'processing' | 'complete' | 'failed';
      }>;
      globalScript?: string;
      metadata?: Record<string, any>;
    };
    selectedAvatarUrl: string;
    isOpen?: boolean;
  };
};

export type UgcClipsResultBlock = {
  blockType: 'ugc_clips_result';
  id: string;
  data: {
    clips: Array<{
      sceneId: string;
      url?: string;
      jobId?: string;
      status: 'pending' | 'processing' | 'complete' | 'failed';
      prompt?: string;
    }>;
  };
};
