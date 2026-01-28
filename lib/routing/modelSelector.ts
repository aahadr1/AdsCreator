/**
 * Model Selection & Routing Logic
 * 
 * Decision trees and functions for selecting the optimal model for each task.
 */

export type ModelSelectionContext = {
  // Image context
  needsText?: boolean;
  aspectRatio?: string;
  qualityPriority?: 'speed' | 'quality' | 'cinematic';
  hasReferenceImages?: boolean;
  
  // Video context
  duration?: number; // seconds
  hasStartImage?: boolean;
  motion?: 'static' | 'moderate' | 'dynamic';
  
  // Audio context
  language?: string;
  
  // General context
  budget?: 'low' | 'medium' | 'high';
  latencyTolerance?: 'fast' | 'normal' | 'patient';
  platform?: string;
};

/**
 * IMAGE MODEL SELECTION
 */
export function selectImageModel(context: ModelSelectionContext): {
  model: string;
  reasoning: string;
  adjustedParams?: Record<string, any>;
} {
  const {
    needsText = false,
    aspectRatio = '2:3',
    qualityPriority = 'quality',
    hasReferenceImages = false,
    budget = 'medium'
  } = context;

  // RULE 1: Typography needs → GPT-1.5 (only model with reliable text rendering)
  if (needsText) {
    const validRatios = ['1:1', '3:2', '2:3'];
    const adjustedRatio = validRatios.includes(aspectRatio) ? aspectRatio : '2:3';
    
    return {
      model: 'openai/gpt-image-1.5',
      reasoning: 'Text overlay required. GPT-1.5 is the only model with reliable typography rendering.',
      adjustedParams: {
        aspect_ratio: adjustedRatio,
        number_of_images: 1,
        quality: 'high'
      }
    };
  }

  // Seedream-4 is the only image model (Nano Banana removed)
  const normalizedAR =
    aspectRatio === 'match_input_image'
      ? 'match_input_image'
      : aspectRatio === '9:16'
        ? '9:16'
        : aspectRatio === '16:9'
          ? '16:9'
          : aspectRatio === '4:3'
            ? '4:3'
            : aspectRatio === '3:4'
              ? '3:4'
              : '1:1';

  // Prefer higher res when cinematic/quality; otherwise default to 1K.
  const size = qualityPriority === 'cinematic' ? '2K' : qualityPriority === 'quality' ? '2K' : '1K';
  const arForSeedream = hasReferenceImages ? 'match_input_image' : normalizedAR;

  return {
    model: 'bytedance/seedream-4',
    reasoning: 'Seedream-4 is configured as the only image model for consistency and reliability.',
    adjustedParams: {
      size,
      aspect_ratio: arForSeedream,
      sequential_image_generation: 'disabled',
      max_images: 1,
      enhance_prompt: false,
    },
  };
}

/**
 * VIDEO MODEL SELECTION
 */
export function selectVideoModel(context: ModelSelectionContext): {
  model: string;
  reasoning: string;
  adjustedParams?: Record<string, any>;
} {
  const {
    duration = 5,
    qualityPriority = 'quality',
    hasStartImage = false,
    motion = 'moderate',
    budget = 'medium',
    latencyTolerance = 'normal'
  } = context;

  // RULE 1: Short duration + start image + speed priority → Wan 2.2 i2v Fast
  if (duration <= 5 && hasStartImage && latencyTolerance === 'fast') {
    return {
      model: 'wan-video/wan-2.2-i2v-fast',
      reasoning: 'Short video with start image, fast generation needed. Wan 2.2 i2v Fast is optimized for this.',
      adjustedParams: {
        duration: Math.min(duration, 8),
        aspect_ratio: '16:9'
      }
    };
  }

  // RULE 2: Cinematic quality + budget allows + patience → Veo 3.1 (full)
  if (qualityPriority === 'cinematic' && budget === 'high' && latencyTolerance === 'patient') {
    return {
      model: 'google/veo-3.1',
      reasoning: 'Cinematic quality with patient timeline. Veo 3.1 full provides best video fidelity.',
      adjustedParams: {
        resolution: '1080p'
      }
    };
  }

  // RULE 3: Balanced quality/speed → Kling 2.6 (DEFAULT for most cases)
  if (qualityPriority === 'quality' && latencyTolerance === 'normal') {
    return {
      model: 'kwaivgi/kling-v2.6',
      reasoning: 'Balanced quality and speed requirements. Kling 2.6 Pro is optimal for production use with native audio generation.',
      adjustedParams: {
        duration: 5,
        generate_audio: true,
        aspect_ratio: '16:9'
      }
    };
  }

  // RULE 4: Start image required (Kling v2.1) + moderate quality
  if (hasStartImage && qualityPriority === 'quality' && duration >= 5) {
    return {
      model: 'kwaivgi/kling-v2.1',
      reasoning: 'Start image provided with quality focus. Kling v2.1 excels at image-to-video animation.',
      adjustedParams: {
        duration: duration <= 5 ? 5 : 10,
        aspect_ratio: '16:9',
        mode: 'standard'
      }
    };
  }

  // RULE 5: Fast iteration/draft → LTX-2 Fast
  if (qualityPriority === 'speed' || latencyTolerance === 'fast') {
    return {
      model: 'lightricks/ltx-2-fast',
      reasoning: 'Draft quality or fast iteration needed. LTX-2 Fast provides rapid generation.',
      adjustedParams: {}
    };
  }

  // RULE 6: Default to Kling 2.6 (best balance with audio)
  return {
    model: 'kwaivgi/kling-v2.6',
    reasoning: 'General video generation. Kling 2.6 Pro provides best balance of quality, speed, and cost with native audio generation.',
    adjustedParams: {
      duration: 5,
      generate_audio: true,
      aspect_ratio: '16:9'
    }
  };
}

/**
 * TTS MODEL SELECTION
 */
export function selectTTSModel(context: ModelSelectionContext): {
  model: string;
  provider: string;
  reasoning: string;
} {
  const {
    qualityPriority = 'quality',
    budget = 'medium',
    language = 'en'
  } = context;

  // RULE 1: Draft or budget-constrained → Minimax (fast, cheap)
  if (qualityPriority === 'speed' || budget === 'low') {
    return {
      model: 'minimax-speech-02-hd',
      provider: 'replicate',
      reasoning: 'Draft quality or budget priority. Minimax provides fast, cost-effective TTS.'
    };
  }

  // RULE 2: Premium quality + budget allows → ElevenLabs
  if (qualityPriority === 'quality' && budget === 'high') {
    return {
      model: 'elevenlabs-premium',
      provider: 'elevenlabs',
      reasoning: 'Premium quality requested with budget. ElevenLabs provides most natural-sounding speech.'
    };
  }

  // RULE 3: Default to Minimax for speed and reliability
  return {
    model: 'minimax-speech-02-hd',
    provider: 'replicate',
    reasoning: 'General TTS use. Minimax provides good balance of quality, speed, and cost.'
  };
}

/**
 * LIPSYNC MODEL SELECTION
 */
export function selectLipsyncModel(context: ModelSelectionContext & {
  inputType?: 'image' | 'video';
  characterCount?: 1 | 2;
}): {
  model: string;
  reasoning: string;
} {
  const {
    inputType = 'image',
    duration = 10,
    qualityPriority = 'quality',
    characterCount = 1
  } = context;

  // RULE 1: Two characters → InfiniteTalk Multi
  if (characterCount === 2) {
    return {
      model: 'wavespeed-ai/infinitetalk/multi',
      reasoning: 'Two characters detected. InfiniteTalk Multi supports dual-character lipsync.'
    };
  }

  // RULE 2: Video redubbing → InfiniteTalk Video-to-Video
  if (inputType === 'video') {
    return {
      model: 'wavespeed-ai/infinitetalk/video-to-video',
      reasoning: 'Video input detected. InfiniteTalk Video-to-Video is optimized for video redubbing.'
    };
  }

  // RULE 3: Cinematic quality from image + audio → Wan 2.2 S2V
  if (inputType === 'image' && qualityPriority === 'cinematic' && duration <= 10) {
    return {
      model: 'wan-video/wan-2.2-s2v',
      reasoning: 'Image input with cinematic quality. Wan 2.2 S2V provides audio-driven cinematic video.'
    };
  }

  // RULE 4: Standard image + audio lipsync → InfiniteTalk (DEFAULT)
  if (inputType === 'image') {
    return {
      model: 'wavespeed-ai/infinitetalk',
      reasoning: 'Image input with audio. InfiniteTalk provides reliable image-to-video lipsync.'
    };
  }

  // RULE 5: Fast lipsync on existing video → Sievesync
  if (qualityPriority === 'speed') {
    return {
      model: 'sievesync-1.1',
      reasoning: 'Fast lipsync needed. Sievesync provides quickest turnaround.'
    };
  }

  // RULE 6: Default to InfiniteTalk
  return {
    model: 'wavespeed-ai/infinitetalk',
    reasoning: 'General lipsync use. InfiniteTalk provides best overall quality and flexibility.'
  };
}

/**
 * PLATFORM-SPECIFIC ASPECT RATIO LOGIC
 */
export const PLATFORM_ASPECT_RATIOS: Record<string, string> = {
  tiktok: '9:16', // Vertical only
  'instagram_reels': '9:16', // Vertical preferred
  'instagram_feed': '1:1', // Square or 4:5
  'instagram_story': '9:16', // Vertical only
  'youtube_shorts': '9:16', // Vertical only
  'youtube_video': '16:9', // Horizontal
  'facebook_feed': '1:1', // Square or 16:9
  'facebook_story': '9:16', // Vertical only
  linkedin: '1:1', // Square or 16:9
  twitter: '16:9' // Horizontal or 1:1
};

/**
 * Detect platform from user request
 */
export function detectPlatformFromRequest(userRequest: string): string[] {
  const platforms: string[] = [];
  const lower = userRequest.toLowerCase();

  if (lower.includes('tiktok')) platforms.push('tiktok');
  if (lower.includes('instagram') || lower.includes('ig') || lower.includes('reels')) {
    platforms.push('instagram_reels');
  }
  if (lower.includes('youtube shorts') || lower.includes('yt shorts')) {
    platforms.push('youtube_shorts');
  }
  if (lower.includes('youtube')) platforms.push('youtube_video');
  if (lower.includes('facebook') || lower.includes('fb')) platforms.push('facebook_feed');
  if (lower.includes('linkedin')) platforms.push('linkedin');
  if (lower.includes('twitter') || lower.includes('x.com')) platforms.push('twitter');

  // Default to mobile-first if no platform specified
  if (platforms.length === 0) {
    platforms.push('tiktok', 'instagram_reels');
  }

  return platforms;
}

/**
 * Get aspect ratio for platform
 */
export function getAspectRatioForPlatform(platform: string): string {
  return PLATFORM_ASPECT_RATIOS[platform] || '9:16'; // Default to mobile
}

/**
 * BRAND CONSISTENCY ENFORCEMENT
 */
export type BrandGuidelines = {
  colors?: string[]; // Hex codes
  fonts?: string[];
  logoUrl?: string;
  styleKeywords?: string[];
  toneOfVoice?: string;
  avoidances?: string[];
};

export function enforceBrandConsistency(
  prompt: string,
  guidelines: BrandGuidelines
): string {
  let enhancedPrompt = prompt;

  // Inject brand colors
  if (guidelines.colors && guidelines.colors.length > 0) {
    enhancedPrompt += ` Brand colors: ${guidelines.colors.join(', ')}.`;
  }

  // Inject style keywords
  if (guidelines.styleKeywords && guidelines.styleKeywords.length > 0) {
    enhancedPrompt += ` Style: ${guidelines.styleKeywords.join(', ')}.`;
  }

  // Add avoidances as negative prompt elements
  if (guidelines.avoidances && guidelines.avoidances.length > 0) {
    enhancedPrompt += ` Avoid: ${guidelines.avoidances.join(', ')}.`;
  }

  return enhancedPrompt;
}

/**
 * COMPLETE MODEL SELECTION ROUTER
 */
export function selectModel(
  tool: 'image' | 'video' | 'tts' | 'lipsync',
  context: ModelSelectionContext & { inputType?: 'image' | 'video'; characterCount?: 1 | 2 }
): {
  model: string;
  provider?: string;
  reasoning: string;
  adjustedParams?: Record<string, any>;
} {
  switch (tool) {
    case 'image':
      return selectImageModel(context);
    case 'video':
      return selectVideoModel(context);
    case 'tts':
      return selectTTSModel(context);
    case 'lipsync':
      return selectLipsyncModel(context);
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

/**
 * Cost estimation per model
 */
export const MODEL_COSTS: Record<string, number> = {
  // Image models (per generation)
  'openai/gpt-image-1.5': 0.80,
  'bytedance/seedream-4': 0.50,
  'bytedance/seedream-4.5': 0.70,
  'bytedance/seededit-3.0': 0.40,

  // Video models (per generation)
  'google/veo-3.1-fast': 1.20,
  'google/veo-3.1': 2.50,
  'wan-video/wan-2.2-i2v-fast': 0.60,
  'wan-video/wan-2.2-animate-replace': 1.50,
  'wan-video/wan-2.5-i2v': 1.80,
  'bytedance/omni-human-1.5': 1.00,
  'lightricks/ltx-2-fast': 0.40,
  'lightricks/ltx-2-pro': 1.20,
  'kwaivgi/kling-v2.5-turbo-pro': 1.50,
  'kwaivgi/kling-v2.1': 1.80,
  'kwaivgi/kling-v2.6': 2.00,
  'kwaivgi/kling-v2.6-motion-control': 2.25,

  // TTS models (per generation)
  'minimax-speech-02-hd': 0.05,
  'jaaari/kokoro-82m': 0.03,
  'elevenlabs-premium': 0.30,

  // Lipsync models (per generation)
  'wan-video/wan-2.2-s2v': 1.50,
  'wavespeed-ai/infinitetalk': 1.20,
  'wavespeed-ai/infinitetalk/multi': 1.80,
  'wavespeed-ai/infinitetalk/video-to-video': 1.50,
  'sievesync-1.1': 0.80,
  'latentsync': 1.00,

  // Other tools
  'background-remover': 0.20,
  'topazlabs/image-upscale': 0.50,
  'openai/gpt-4o-transcribe': 0.10
};

/**
 * Latency estimation per model (seconds)
 */
export const MODEL_LATENCIES: Record<string, number> = {
  // Image models
  'openai/gpt-image-1.5': 30,
  'bytedance/seedream-4': 45,
  'bytedance/seedream-4.5': 60,
  'bytedance/seededit-3.0': 40,

  // Video models
  'google/veo-3.1-fast': 180, // 3 min
  'google/veo-3.1': 600, // 10 min
  'wan-video/wan-2.2-i2v-fast': 120, // 2 min
  'wan-video/wan-2.2-animate-replace': 300, // 5 min
  'wan-video/wan-2.5-i2v': 400,
  'bytedance/omni-human-1.5': 200,
  'lightricks/ltx-2-fast': 60,
  'lightricks/ltx-2-pro': 240,
  'kwaivgi/kling-v2.5-turbo-pro': 250,
  'kwaivgi/kling-v2.1': 350,
  'kwaivgi/kling-v2.6': 300, // 5 min
  'kwaivgi/kling-v2.6-motion-control': 450,

  // TTS models
  'minimax-speech-02-hd': 15,
  'jaaari/kokoro-82m': 10,
  'elevenlabs-premium': 20,

  // Lipsync models
  'wan-video/wan-2.2-s2v': 300,
  'wavespeed-ai/infinitetalk': 240,
  'wavespeed-ai/infinitetalk/multi': 360,
  'wavespeed-ai/infinitetalk/video-to-video': 300,
  'sievesync-1.1': 120,
  'latentsync': 180
};

/**
 * Get cost estimate for model
 */
export function getModelCost(model: string): number {
  return MODEL_COSTS[model] || 0;
}

/**
 * Get latency estimate for model
 */
export function getModelLatency(model: string): number {
  return MODEL_LATENCIES[model] || 60;
}

