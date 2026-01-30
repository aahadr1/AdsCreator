// Influencer Types

export interface Influencer {
  id: string;
  user_id: string;
  name: string;
  username?: string;
  user_description: string; // Original user description
  enriched_description?: string; // LLM-enriched description
  generation_prompt?: string; // Deprecated
  // Legacy (older rows may still have these; UI can fall back)
  short_description?: string;
  full_description?: string;
  input_images?: string[];
  photo_face_closeup?: string;
  photo_full_body?: string;
  photo_right_side?: string;
  photo_left_side?: string;
  photo_back_top?: string;
  photo_main?: string;
  additional_photos?: string[];
  status: 'draft' | 'enriching' | 'generating' | 'completed' | 'failed';
  generation_error?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface CreateInfluencerRequest {
  name: string;
  user_description: string;
  input_images?: string[];
}

export interface EnrichDescriptionRequest {
  user_description: string;
}

export interface EnrichDescriptionResponse {
  enriched_description: string;
}

export interface UpdateInfluencerRequest {
  name?: string;
  username?: string;
  short_description?: string;
  full_description?: string;
}

export interface GeneratePhotoshootRequest {
  influencer_id: string;
  generation_prompt: string;
  input_images?: string[];
}

export interface PhotoshootAngle {
  type: 'face_closeup' | 'full_body' | 'right_side' | 'left_side' | 'back_top';
  prompt_suffix: string;
  field_name: 'photo_face_closeup' | 'photo_full_body' | 'photo_right_side' | 'photo_left_side' | 'photo_back_top';
}

export const PHOTOSHOOT_ANGLES: PhotoshootAngle[] = [
  {
    type: 'face_closeup',
    prompt_suffix: 'Face close-up portrait, professional studio lighting, white background, hyperrealistic, highly detailed facial features',
    field_name: 'photo_face_closeup'
  },
  {
    type: 'full_body',
    prompt_suffix: 'Full body shot, standing pose, professional studio lighting, white background, hyperrealistic, highly detailed',
    field_name: 'photo_full_body'
  },
  {
    type: 'right_side',
    prompt_suffix: 'Right side profile view, professional studio lighting, white background, hyperrealistic, highly detailed',
    field_name: 'photo_right_side'
  },
  {
    type: 'left_side',
    prompt_suffix: 'Left side profile view, professional studio lighting, white background, hyperrealistic, highly detailed',
    field_name: 'photo_left_side'
  },
  {
    type: 'back_top',
    prompt_suffix: 'Back view from slightly elevated angle, professional studio lighting, white background, hyperrealistic, highly detailed',
    field_name: 'photo_back_top'
  }
];
