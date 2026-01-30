/**
 * Assistant Types
 * Type definitions for the AI assistant feature
 */

export type MessageRole = 'user' | 'assistant' | 'reflexion' | 'tool_call' | 'tool_result';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: Record<string, unknown>;
  files?: string[];
  isCollapsed?: boolean;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  messages: Message[];
  plan?: AssistantPlan | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantPlan {
  steps: PlanStep[];
  current_step: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  // Optional: server-side persisted avatar selection for storyboards
  selected_avatar?: {
    url: string;
    prediction_id?: string;
    description?: string;
    selected_at?: string;
  };
  // Optional: server-side persisted product image for consistent product appearance
  selected_product?: {
    url: string;
    prediction_id?: string;
    description?: string;
    selected_at?: string;
  };

  /**
   * When a storyboard is generated, we prompt the user to either modify it or proceed to video generation.
   * This flag stores the latest storyboard id awaiting confirmation.
   */
  pending_storyboard_action?: {
    storyboard_id: string;
    created_at: string;
  };

  /**
   * Store analyzed videos for future motion control use
   */
  analyzed_videos?: Array<{
    asset_id: string;
    video_url: string;
    analysis_result: VideoAnalysisOutput;
    analyzed_at: string;
  }>;

  /**
   * Image Registry - Centralized tracking of all generated images in the conversation
   * Enables the AI to reference any image as input for new generations
   */
  image_registry?: import('./imageRegistry').ImageRegistry;
}

export interface PlanStep {
  id: string;
  title: string;
  tool: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

// Tool Definitions
export type ToolName = 
  | 'script_creation' 
  | 'image_generation' 
  | 'requirements_check'
  | 'scene_director'
  | 'frame_generator'
  | 'frame_prompt_generator'
  | 'storyboard_creation' 
  | 'video_generation' 
  | 'video_analysis' 
  | 'motion_control'
  | 'prompt_creator'; // Legacy, kept for backwards compatibility

export interface Tool {
  name: ToolName;
  description: string;
  parameters: ToolParameter[];
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  enum?: string[];
}

export interface ToolCall {
  tool: ToolName;
  input: Record<string, unknown>;
}

export interface ToolResult {
  tool: ToolName;
  success: boolean;
  output?: unknown;
  error?: string;
}

// Reflexion structure
export interface Reflexion {
  analysis: string;
  user_intent: string;
  information_gaps: string[];
  selected_action: 'direct_response' | 'follow_up' | 'tool_call';
  tool_to_use?: ToolName;
  reasoning: string;
}

// Chat API request/response types
export interface ChatRequest {
  conversation_id?: string;
  message: string;
  files?: string[];
}

export interface ChatResponse {
  conversation_id: string;
  reflexion: Reflexion;
  response: Message;
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
}

// Streaming event types
export type StreamEventType = 
  | 'reflexion_start'
  | 'reflexion_chunk'
  | 'reflexion_end'
  | 'response_start'
  | 'response_chunk'
  | 'response_end'
  | 'tool_call'
  | 'tool_result'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
}

// Prompt Creator specific types
export interface PromptCreatorInput {
  target_model: 'nano_banana_image' | 'i2v_audio_model';
  prompt_type: 'scene_first_frame' | 'scene_last_frame' | 'intermediate_frame' | 'insert_shot' | 'i2v_job';
  scene_id: string;
  shot_id?: string;
  continuity?: {
    is_continuous_from_previous_scene: boolean;
    previous_scene_last_frame_url?: string | null;
  };
  reference_images?: Array<{
    url: string;
    role: 'previous_scene_last_frame' | 'scene_first_frame_anchor' | 'avatar_ref' | 'style_ref' | 'location_ref' | 'prop_ref';
    notes?: string;
  }>;
  user_intent: string;
  required_changes?: string[];
  must_keep?: string[];
  forbidden?: string[];
  dialogue?: {
    needs_spoken_dialogue: boolean;
    language?: string;
    accent?: string;
    lines?: Array<{
      speaker: string;
      text: string;
      start_s?: number;
      end_s?: number;
      emotion?: string;
    }>;
    mix_notes?: string;
  };
  render_params: {
    aspect_ratio?: string;
    style?: string;
    camera?: string;
    lighting?: string;
    motion_strength?: 'low' | 'med' | 'high';
    i2i_strength?: 'low' | 'med' | 'high';
  };
}

// Script creation specific types
export interface ScriptCreationInput {
  // New comprehensive input structure
  video_type?: 'ugc' | 'high_production' | 'tutorial' | 'testimonial' | 'reel' | 'ad' | 'vlog' | 'demo' | 'comparison' | 'explainer' | 'other';
  duration_seconds?: number;
  purpose?: string;
  platform?: 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'general' | 'youtube_shorts';
  tone?: 'casual' | 'professional' | 'energetic' | 'calm' | 'humorous' | 'serious' | 'inspiring' | string;
  has_voiceover?: boolean;
  has_dialogue?: boolean;
  speaker_description?: string;
  product_name?: string;
  product_description?: string;
  target_audience?: string;
  key_message?: string;
  include_hook?: boolean;
  additional_instructions?: string;
  // Legacy fields for backwards compatibility
  brand_name?: string;
  product?: string;
  offer?: string;
  key_benefits?: string;
  pain_points?: string;
  social_proof?: string;
  hook_style?: string;
  cta?: string;
  length_seconds?: number;
  constraints?: string;
  prompt?: string;
}

export interface ScriptCreationOutput {
  script: {
    full_text: string;
    hook?: string;
    body?: string;
    cta?: string;
  } | string;
  timing_breakdown?: Array<{
    start_s: number;
    end_s: number;
    section?: string;
    text: string;
    visual_note?: string;
  }>;
  total_duration_seconds?: number;
  word_count?: number;
  speaker_notes?: {
    tone?: string;
    pace?: string;
    emphasis?: string;
    pauses?: string;
  };
  visual_suggestions?: string[];
  scene_suggestions?: Array<{
    name: string;
    duration_seconds?: number;
    description: string;
  }>;
  audio_notes?: {
    music_style?: string;
    sound_effects?: string[];
    voiceover_style?: string;
  };
  task_id?: string;
}

// Requirements Check types
export interface RequirementsCheckInput {
  script: string;
  video_type: string;
  video_description?: string;
  available_avatars?: Array<{ url: string; description: string }>;
  available_products?: Array<{ url: string; description: string }>;
  available_settings?: Array<{ url: string; description: string }>;
  user_uploaded_images?: Array<{ url: string; gpt4v_description?: string }>;
}

export interface RequirementsCheckOutput {
  can_proceed: boolean;
  confidence: number;
  proceed_reasoning?: string;
  missing_elements?: Array<{
    type: 'avatar' | 'product' | 'setting' | 'information';
    description: string;
    criticality: 'blocker' | 'important' | 'nice_to_have';
    can_we_generate?: boolean;
    can_we_proceed_without?: boolean;
    recommended_action?: string;
  }>;
  questions_for_user?: Array<{
    question: string;
    why_asking?: string;
    default_if_not_answered?: string;
  }> | string[];
  assumptions_if_proceeding?: Array<{
    assumption: string;
    basis?: string;
    risk?: string;
  }>;
  recommendations?: Array<{
    recommendation: string;
    priority?: 'high' | 'medium' | 'low';
    reasoning?: string;
  }> | string[];
  reasoning?: string;
}

// Scene Director types
export interface SceneDirectorInput {
  mode: 'overview' | 'breakdown';
  script: string;
  video_type: string;
  style?: string;
  aspect_ratio?: string;
  avatar_descriptions?: string[];
  product_description?: string;
  user_creative_direction?: string;
  video_overview?: string; // For breakdown mode
}

export interface SceneDirectorOverviewOutput {
  video_title: string;
  video_description: string;
  concept_summary?: string;
  style_guide?: {
    visual_style: string;
    color_palette?: {
      primary?: string;
      mood_colors?: string[];
      avoid?: string;
    };
    mood: string;
    lighting?: string;
    texture?: string;
  };
  pacing?: {
    overall_rhythm?: string;
    hook_energy?: string;
    body_flow?: string;
    climax_moment?: string;
    ending_feel?: string;
  };
  visual_language?: {
    shot_style?: string;
    movement?: string;
    transitions?: string;
    recurring_motifs?: string[];
  };
  key_visual_moments?: Array<{
    moment: string;
    description: string;
    timing?: string;
  }> | string[];
  continuity_requirements?: string[];
  things_to_avoid?: string[];
  reference_notes?: string;
}

export interface SceneDirectorBreakdownOutput {
  total_scenes: number;
  total_duration_seconds: number;
  scenes: Array<{
    scene_number: number;
    scene_name: string;
    scene_description: string;
    duration_seconds: number;
    timing?: {
      start_s: number;
      end_s: number;
    };
    scene_type: 'talking_head' | 'product_showcase' | 'b_roll' | 'demonstration' | 'text_card' | 'transition';
    scene_purpose?: string;
    setting?: {
      location: string;
      time_of_day?: string;
      lighting?: string;
      key_elements?: string[];
    };
    character?: {
      uses_avatar: boolean;
      which_avatar?: string;
      position_in_frame?: string;
      expression?: string;
      action?: string;
    };
    product?: {
      appears: boolean;
      how?: string;
      prominence?: string;
    };
    camera?: {
      shot_type?: string;
      angle?: string;
      movement?: string;
      framing_notes?: string;
    };
    script_text: string;
    visual_action?: string;
    audio?: {
      dialogue?: string;
      music?: string;
      sound_effects?: string[];
    };
    transition?: {
      from_previous?: string;
      continuous_with_previous?: boolean;
      to_next?: string;
    };
    continuity_notes?: string;
  }>;
  scene_flow_summary?: string;
  critical_continuity_points?: string[];
}

// Frame Generator types
export interface FrameGeneratorInput {
  video_description: string;
  scenes: SceneDirectorBreakdownOutput['scenes'];
  avatar_references?: Array<{
    description: string;
    url: string;
    gpt4v_analysis?: string;
  }>;
  product_references?: Array<{
    description: string;
    url: string;
    gpt4v_analysis?: string;
  }>;
  continuity_rules?: string[];
}

export interface FrameGeneratorOutput {
  frame_designs: Array<{
    scene_number: number;
    scene_name?: string;
    scene_summary?: string;
    first_frame: {
      description: string;
      key_visual_elements?: string[];
      composition?: {
        focal_point?: string;
        rule_of_thirds?: string;
        depth?: string;
        negative_space?: string;
      };
      character_state?: {
        present: boolean;
        position?: string;
        pose?: string;
        expression?: string;
        eye_direction?: string;
        hands?: string;
        wardrobe_visible?: string;
      };
      product_state?: {
        present: boolean;
        position?: string;
        visibility?: string;
        interaction?: string;
      };
      environment?: {
        setting?: string;
        lighting_quality?: string;
        light_direction?: string;
        atmosphere?: string;
        key_props?: string[];
      };
      camera?: {
        shot_size?: string;
        angle?: string;
        lens_feel?: string;
      };
      mood_conveyed?: string;
    };
    last_frame: {
      description: string;
      key_visual_elements?: string[];
      composition?: object;
      character_state?: object;
      product_state?: object;
      environment?: object;
      camera?: object;
      mood_conveyed?: string;
      progression_from_first_frame?: string;
      change_from_first?: string;
    };
    motion_between_frames?: {
      character_action?: string;
      camera_movement?: string;
      environmental_changes?: string;
      emotional_arc?: string;
    };
    transition_design?: {
      how_scene_ends?: string;
      connects_to_next?: string;
      continuity_handoff?: string;
    };
  }>;
  global_consistency_notes?: {
    character_constants?: string[];
    setting_constants?: string[];
    style_constants?: string[];
  };
  frame_by_frame_progression?: string;
}

// Frame Prompt Generator types
export interface FramePromptGeneratorInput {
  frame_designs: FrameGeneratorOutput['frame_designs'];
  avatar_references: Array<{
    id: string;
    description: string;
    url: string;
    gpt4v_description?: string;
  }>;
  product_references?: Array<{
    id: string;
    description: string;
    url: string;
    gpt4v_description?: string;
  }>;
  setting_references?: Array<{
    id: string;
    description: string;
    url: string;
    gpt4v_description?: string;
  }>;
  previously_generated_frames?: Array<{
    scene_number: number;
    frame_type: 'first' | 'last';
    url: string;
    gpt4v_description?: string;
  }>;
}

export interface FramePromptGeneratorOutput {
  frame_prompts: Array<{
    scene_number: number;
    scene_name?: string;
    first_frame_prompt: {
      text_prompt: string;
      image_inputs: Array<{
        url: string;
        role: 'avatar_reference' | 'product_reference' | 'setting_reference' | 'prev_frame_continuity' | 'scene_first_frame';
        purpose?: string;
        what_model_gets_from_this?: string;
        what_prompt_should_add?: string;
        what_to_maintain?: string;
        what_to_change?: string;
      }>;
      must_keep_from_inputs?: string[];
      must_change_from_inputs?: string[];
      should_not_mention_in_prompt?: string[];
      prompt_strategy_explanation?: string;
    };
    last_frame_prompt: {
      text_prompt: string;
      image_inputs: Array<{
        url: string;
        role: string;
        purpose?: string;
      }>;
      changes_from_first_frame?: string[];
      must_keep_from_inputs?: string[];
      must_change_from_inputs?: string[];
      should_not_mention_in_prompt?: string[];
      prompt_strategy_explanation?: string;
    };
  }>;
  continuity_chain?: {
    description?: string;
    cross_scene_references?: Array<{
      from_scene: number;
      from_frame: string;
      to_scene: number;
      to_frame: string;
      relationship: string;
    }>;
  };
  prompt_engineering_notes?: string;
}

// Image generation specific types
export interface ImageGenerationInput {
  prompt: string;
  aspect_ratio?: string;
  output_format?: 'jpg' | 'png';
  model?: string;
  image_input?: string[];
  purpose?: 'avatar' | 'scene_frame' | 'scene_first_frame' | 'scene_last_frame' | 'product' | 'b_roll' | 'setting' | 'other';
  avatar_description?: string;
  character_role?: 'main_character' | 'supporting' | 'background';
  // Reference images for consistency (DEPRECATED - use image_input directly)
  reference_images?: {
    avatar_url?: string;           // Avatar image for character consistency
    first_frame_url?: string;      // Scene's first frame (when generating last frame)
    product_url?: string;          // Product image for product consistency
    prev_scene_last_frame_url?: string; // Previous scene's last frame (for smooth transitions)
  };
}

/**
 * AI reflexion result for image reference selection
 */
export interface ImageReferenceReflexion {
  reasoning: string;
  selected_image_urls: string[];
  expected_consistency_gains: string;
}

export interface ImageGenerationOutput {
  prediction_id: string;
  status: string;
  output_url?: string;
}

// Storyboard specific types

/**
 * Video Scenario - High-level description of the complete video
 * This is generated first before individual scenes are detailed
 */
export interface VideoScenario {
  title: string;
  concept: string; // The core creative concept/idea
  narrative_arc: string; // How the story flows from beginning to end
  target_emotion: string; // The emotional journey we want viewers to experience
  key_message: string; // The single most important takeaway
  scene_breakdown: SceneOutline[]; // High-level scene breakdown
}

/**
 * Scene Outline - Brief scene description from the scenario phase
 */
export interface SceneOutline {
  scene_number: number;
  scene_name: string;
  purpose: string; // Why this scene exists in the narrative
  duration_seconds: number;
  needs_avatar: boolean; // Whether this scene requires the AI avatar/actor
  scene_type: 'talking_head' | 'product_showcase' | 'b_roll' | 'demonstration' | 'text_card' | 'transition';
  /**
   * If true, we should ask the user for more specifics before generating frames for this scene.
   * Useful for non-avatar scenes where setting/objects are underspecified.
   */
  needs_user_details?: boolean;
  /** A short, direct question to ask the user to clarify this scene. */
  user_question?: string;
  /** Whether this scene displays the product and needs the product image for consistency */
  needs_product_image?: boolean;
  /** Whether to use the previous scene's last frame for a smooth visual transition */
  use_prev_scene_transition?: boolean;
  
  // NEW FIELDS FOR VISUAL CONSISTENCY (from scenario planning)
  /** Short concrete setting description (e.g., "Small modern bathroom, warm morning light") */
  scene_setting?: string;
  /** TRUE if this scene moves to a new location/environment vs previous scene */
  setting_change?: boolean;
  /** Numeric ID grouping consecutive scenes in the same setting (for tracking continuity) */
  continuity_group_id?: number;
}

/**
 * Refined Scene - Detailed scene specification with precise prompts
 * Generated in individual LLM calls for maximum precision
 */
export interface StoryboardScene {
  scene_number: number;
  scene_name: string;
  description: string;
  /** Full scene description for UI display (from scene_director) */
  scene_description?: string;
  duration_seconds?: number;
  /** Timing info */
  timing?: {
    start_s: number;
    end_s: number;
  };
  
  // First frame prompt - extremely precise and specific
  first_frame_prompt: string;
  first_frame_visual_elements: string[]; // Explicit list of visual elements
  /** Image input URLs for first frame generation (avatars, products, previous frames) */
  first_frame_image_inputs?: string[];
  
  // Last frame prompt - extremely precise and specific  
  last_frame_prompt: string;
  last_frame_visual_elements: string[]; // Explicit list of visual elements
  /** Image input URLs for last frame generation */
  last_frame_image_inputs?: string[];
  
  // Video generation prompt - describes the motion/action between frames
  video_generation_prompt: string;
  
  // NEW FIELDS FOR VISUAL CONSISTENCY (from scene refinement)
  /** Setting anchor that applies to BOTH first and last frame for consistency enforcement */
  scene_setting_lock?: string;
  /** Optional notes explaining camera moves/reveals within the scene */
  continuity_notes?: string;

  // Video generation output (populated when user proceeds to generation)
  video_model?: string;
  video_prediction_id?: string;
  video_status?: 'pending' | 'generating' | 'processing' | 'succeeded' | 'failed';
  video_url?: string; // (typically proxied/persisted)
  video_raw_url?: string; // direct output from provider
  video_error?: string;
  
  // Audio specification
  voiceover_text?: string; // Exact text the creator should say
  audio_mood?: string; // Background music mood/style
  sound_effects?: string[]; // Specific sound effects needed
  audio_notes?: string; // Additional audio instructions
  
  // Scene metadata
  transition_type?: 'smooth' | 'cut';
  camera_angle?: string;
  camera_movement?: string; // pan, zoom, static, tracking, etc.
  lighting_description?: string;
  setting_change?: boolean;
  
  // Avatar usage
  uses_avatar?: boolean;
  /** Which avatar identifier this scene uses (for multi-character videos) */
  which_avatar?: string;
  avatar_action?: string; // What the avatar is doing in this scene
  avatar_expression?: string; // Facial expression description
  avatar_position?: string; // Where avatar is in frame
  
  // For non-avatar scenes
  scene_type?: 'talking_head' | 'product_showcase' | 'b_roll' | 'demonstration' | 'text_card' | 'transition';
  product_focus?: boolean; // Is this a product-focused scene
  text_overlay?: string; // Any text that should appear on screen
  /**
   * If present, indicates this scene needs user clarification before we can generate frames.
   * The UI can show this and the assistant can prompt the user.
   */
  needs_user_details?: boolean;
  user_question?: string;
  
  // Generated image URLs and status (populated after generation)
  first_frame_url?: string;
  last_frame_url?: string;
  /** Direct provider URL (e.g., Replicate). Kept for debugging; may expire. */
  first_frame_raw_url?: string;
  /** Direct provider URL (e.g., Replicate). Kept for debugging; may expire. */
  last_frame_raw_url?: string;
  first_frame_prediction_id?: string;
  last_frame_prediction_id?: string;
  first_frame_status?: 'pending' | 'generating' | 'succeeded' | 'failed';
  last_frame_status?: 'pending' | 'generating' | 'succeeded' | 'failed';
  first_frame_error?: string;
  last_frame_error?: string;
  // Track whether frames need regeneration after modification
  first_frame_needs_regeneration?: boolean;
  last_frame_needs_regeneration?: boolean;
  // Track whether this scene needs the product image
  needs_product_image?: boolean;
  // Track whether this scene should use previous scene's last frame for smooth transition
  use_prev_scene_transition?: boolean;
}

export interface Storyboard {
  id: string;
  title: string;
  brand_name?: string;
  product?: string;
  target_audience?: string;
  platform?: 'tiktok' | 'instagram' | 'facebook' | 'youtube_shorts' | 'youtube' | 'general';
  total_duration_seconds?: number;
  style?: string;
  aspect_ratio?: string;
  // NEW: Video description for display in UI
  video_description?: string;
  video_type?: string;
  // NEW: Full script text
  script_full_text?: string;
  // Avatar reference for consistency
  avatar_image_url?: string;
  avatar_description?: string;
  // Additional avatars for multi-character videos
  additional_avatars?: Array<{
    url: string;
    description: string;
    role?: string;
  }>;
  // Product image reference for consistent product appearance across scenes
  product_image_url?: string;
  product_image_description?: string;
  // Video scenario - the creative foundation
  scenario?: VideoScenario;
  scenes: StoryboardScene[];
  created_at: string;
  status: 'draft' | 'planning' | 'refining_scenes' | 'awaiting_product_image' | 'generating' | 'ready' | 'failed';
  // Scenes that need product image (populated during planning)
  scenes_needing_product?: number[];
}

/**
 * Input for the scenario planning phase (Phase 1)
 * This generates the high-level video concept and scene breakdown
 */
export interface ScenarioPlanningInput {
  brand_name?: string;
  product?: string;
  product_description?: string;
  target_audience?: string;
  platform?: 'tiktok' | 'instagram' | 'facebook' | 'youtube_shorts';
  total_duration_seconds?: number;
  style?: string;
  aspect_ratio?: string;
  key_benefits?: string[];
  pain_points?: string[];
  call_to_action?: string;
  creative_direction?: string; // Any specific creative requests
  avatar_image_url?: string;
  avatar_description?: string;
}

/**
 * Input for refining a single scene (Phase 2)
 * Each scene gets its own LLM call for maximum precision
 */
export interface SceneRefinementInput {
  scenario: VideoScenario;
  scene_outline: SceneOutline;
  avatar_image_url?: string;
  avatar_description?: string;
  aspect_ratio?: string;
  style?: string;
  brand_name?: string;
  product?: string;
  previous_scene?: StoryboardScene; // For continuity
}

export interface StoryboardCreationInput {
  title: string;
  brand_name?: string;
  product?: string;
  product_description?: string;
  target_audience?: string;
  platform?: 'tiktok' | 'instagram' | 'facebook' | 'youtube_shorts';
  total_duration_seconds?: number;
  style?: string;
  aspect_ratio?: string;
  key_benefits?: string[];
  pain_points?: string[];
  call_to_action?: string;
  creative_direction?: string;
  // Avatar reference for image-to-image consistency
  avatar_image_url?: string;
  avatar_description?: string;
  // Product image reference for consistent product appearance
  product_image_url?: string;
  product_image_description?: string;
  /**
   * Scenes can be:
   * - Minimal outlines (small tool_call payload; server will refine prompts), OR
   * - Fully detailed scenes (backwards compatible)
   */
  scenes: Array<{
    scene_number: number;
    scene_name: string;
    description: string;
    duration_seconds?: number;
    scene_type?: 'talking_head' | 'product_showcase' | 'b_roll' | 'demonstration' | 'text_card' | 'transition';
    uses_avatar?: boolean;
    // Optional in tool input; server will generate/refine when missing
    first_frame_prompt?: string;
    first_frame_visual_elements?: string[];
    last_frame_prompt?: string;
    last_frame_visual_elements?: string[];
    video_generation_prompt?: string;
    voiceover_text?: string;
    audio_mood?: string;
    sound_effects?: string[];
    audio_notes?: string;
    transition_type?: 'smooth' | 'cut';
    camera_angle?: string;
    camera_movement?: string;
    lighting_description?: string;
    setting_change?: boolean;
    avatar_action?: string;
    avatar_expression?: string;
    avatar_position?: string;
    product_focus?: boolean;
    text_overlay?: string;
    // Whether this scene needs the product image for consistency
    needs_product_image?: boolean;
    // Whether to use previous scene's last frame for smooth transition
    use_prev_scene_transition?: boolean;
  }>;
}

export interface StoryboardCreationOutput {
  storyboard: Storyboard;
}

export interface VideoGenerationInput {
  storyboard_id: string;
  scenes_to_generate?: number[];
  video_model?: string;
  resolution?: '720p' | '1080p';
  quality_priority?: 'quality' | 'speed';
}

export interface VideoGenerationOutput {
  storyboard: Storyboard;
}

// Video analysis specific types
export interface VideoAnalysisInput {
  video_url?: string;
  video_file?: string; // For uploaded files
  max_duration_seconds?: number; // Default 30
}

export interface VideoAnalysisFrame {
  timestamp_seconds: number;
  image_url: string;
  description: string;
  people_count: number;
  broll_detected: boolean;
  has_text_overlay: boolean;
  scene_change: boolean;
  confidence: number;
}

export interface VideoAnalysisOutput {
  asset_id: string;
  video_url: string;
  duration_seconds: number;
  fps_estimate?: number;
  aspect_ratio?: string;
  frames: VideoAnalysisFrame[];
  summary: string;
  eligibility: {
    is_single_character_only: boolean;
    has_b_roll: boolean;
    recommended_for_motion_control: boolean;
    reasoning: string;
  };
}

// Motion control specific types
export interface MotionControlInput {
  video_url: string; // Reference video (motion source)
  image_url: string; // Reference character image
  prompt?: string; // Optional text prompt for additional context
  character_orientation?: 'image' | 'video'; // 'image': same as person in picture (max 10s), 'video': consistent with video (max 30s)
  mode?: 'std' | 'pro'; // 'std': Standard (cost-effective), 'pro': Professional (higher quality)
  keep_original_sound?: boolean;
}

export interface MotionControlOutput {
  prediction_id: string;
  status: string;
  output_url?: string;
  output_raw_url?: string;
}
