export type UgcAvatarPickerBlock = {
  blockType: 'ugc_avatar_picker';
  id: string;
  data: {
    sessionId?: string;
    brief?: Record<string, any>;
    productImageUrl?: string;
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
        imagePrompt?: string;
        motionPrompt?: string;
        beatType?: string;
        shotType?: string;
        onScreenText?: string;
        actorAction?: string;
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
    sessionId?: string;
    clips: Array<{
      sceneId: string;
      url?: string;
      jobId?: string;
      status: 'pending' | 'processing' | 'complete' | 'failed';
      prompt?: string;
    }>;
  };
};
