// Credit system types and interfaces

export type SubscriptionTier = 'basic' | 'pro';

export interface CreditLimits {
  basic: number;
  pro: number;
}

export interface ModelCost {
  name: string;
  category: 'lipsync' | 'tts' | 'editing' | 'enhancement' | 'other';
  credits: number;
  provider?: string;
  description?: string;
}

export interface CreditUsage {
  id: string;
  user_id: string;
  model_name: string;
  model_category: string;
  credits_used: number;
  task_id?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface UserCredits {
  user_id: string;
  subscription_tier: SubscriptionTier;
  monthly_limit: number;
  used_credits: number;
  remaining_credits: number;
  current_period_start: string;
  current_period_end: string;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: 'usage' | 'refund' | 'bonus' | 'reset';
  credits: number;
  balance_before: number;
  balance_after: number;
  model_name?: string;
  task_id?: string;
  description: string;
  created_at: string;
}

// Credit pricing configuration
export const CREDIT_LIMITS: CreditLimits = {
  basic: 500,
  pro: 1000,
};

// Model credit costs based on API pricing and complexity
export const MODEL_COSTS: Record<string, ModelCost> = {
  // Lipsync Models
  'sievesync-1.1': {
    name: 'Sieve Sync Basic',
    category: 'lipsync',
    credits: 10,
    provider: 'Sieve',
    description: 'Basic lipsync with good quality and speed',
  },
  'lipsync-2': {
    name: 'Sync Labs Standard',
    category: 'lipsync',
    credits: 15,
    provider: 'Sync Labs',
    description: 'High-quality lipsync with natural movements',
  },
  'lipsync-2-pro': {
    name: 'Sync Labs Pro',
    category: 'lipsync',
    credits: 25,
    provider: 'Sync Labs',
    description: 'Premium lipsync with best quality and accuracy',
  },
  'latentsync': {
    name: 'LatentSync',
    category: 'lipsync',
    credits: 20,
    provider: 'Replicate',
    description: 'Research-grade lipsync with advanced AI',
  },
  'kling': {
    name: 'Kling Video',
    category: 'lipsync',
    credits: 30,
    provider: 'Kling',
    description: 'State-of-the-art video generation and lipsync',
  },

  // TTS Models
  'minimax-speech-02-hd': {
    name: 'Minimax TTS HD',
    category: 'tts',
    credits: 5,
    provider: 'Replicate',
    description: 'High-quality text-to-speech synthesis',
  },
  'elevenlabs-tts': {
    name: 'ElevenLabs TTS',
    category: 'tts',
    credits: 8,
    provider: 'ElevenLabs',
    description: 'Premium voice synthesis with emotion',
  },
  'dia-tts': {
    name: 'Dia TTS',
    category: 'tts',
    credits: 6,
    provider: 'Dia',
    description: 'Natural voice generation with customization',
  },

  // Editing and Enhancement
  'auto-edit': {
    name: 'Auto Edit',
    category: 'editing',
    credits: 15,
    description: 'AI-powered video editing and content generation',
  },
  'background-remove': {
    name: 'Background Removal',
    category: 'enhancement',
    credits: 8,
    description: 'AI background removal for images and videos',
  },
  'video-enhance': {
    name: 'Video Enhancement',
    category: 'enhancement',
    credits: 12,
    description: 'AI video upscaling and quality improvement',
  },
  'image-generate': {
    name: 'Image Generation',
    category: 'other',
    credits: 5,
    description: 'AI image creation and manipulation',
  },
  'transcription': {
    name: 'Transcription',
    category: 'other',
    credits: 3,
    description: 'Audio to text conversion',
  },
  'veo-generate': {
    name: 'Veo Video Generation',
    category: 'other',
    credits: 35,
    provider: 'Google',
    description: 'Advanced AI video generation',
  },
};

// Helper functions
export function getCreditCost(modelName: string): number {
  return MODEL_COSTS[modelName]?.credits || 10; // Default cost if not found
}

export function getSubscriptionLimit(tier: SubscriptionTier): number {
  return CREDIT_LIMITS[tier];
}

export function formatCredits(credits: number): string {
  return credits.toLocaleString();
}

export function getCreditProgress(used: number, limit: number): number {
  return Math.min((used / limit) * 100, 100);
}

export function getCreditStatus(used: number, limit: number): 'good' | 'warning' | 'critical' {
  const percentage = getCreditProgress(used, limit);
  if (percentage >= 90) return 'critical';
  if (percentage >= 75) return 'warning';
  return 'good';
}
