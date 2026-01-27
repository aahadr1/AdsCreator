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
export type ToolName = 'script_creation' | 'image_generation' | 'storyboard_creation' | 'video_generation' | 'video_analysis' | 'motion_control';

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

// Script creation specific types
export interface ScriptCreationInput {
  brand_name?: string;
  product?: string;
  offer?: string;
  target_audience?: string;
  key_benefits?: string;
  pain_points?: string;
  social_proof?: string;
  tone?: string;
  platform?: 'tiktok' | 'instagram' | 'facebook' | 'youtube_shorts';
  hook_style?: string;
  cta?: string;
  length_seconds?: number;
  constraints?: string;
  prompt?: string;
}

export interface ScriptCreationOutput {
  script: string;
  task_id?: string;
}

// Image generation specific types
export interface ImageGenerationInput {
  prompt: string;
  aspect_ratio?: string;
  output_format?: 'jpg' | 'png';
  model?: string;
  image_input?: string[];
  purpose?: 'avatar' | 'scene_frame' | 'scene_first_frame' | 'scene_last_frame' | 'product' | 'b_roll' | 'other';
  avatar_description?: string;
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
}

/**
 * Refined Scene - Detailed scene specification with precise prompts
 * Generated in individual LLM calls for maximum precision
 */
export interface StoryboardScene {
  scene_number: number;
  scene_name: string;
  description: string;
  duration_seconds?: number;
  
  // First frame prompt - extremely precise and specific
  first_frame_prompt: string;
  first_frame_visual_elements: string[]; // Explicit list of visual elements
  
  // Last frame prompt - extremely precise and specific  
  last_frame_prompt: string;
  last_frame_visual_elements: string[]; // Explicit list of visual elements
  
  // Video generation prompt - describes the motion/action between frames
  video_generation_prompt: string;

  // Video generation output (populated when user proceeds to generation)
  video_model?: string;
  video_prediction_id?: string;
  video_status?: 'pending' | 'generating' | 'succeeded' | 'failed';
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
  platform?: 'tiktok' | 'instagram' | 'facebook' | 'youtube_shorts';
  total_duration_seconds?: number;
  style?: string;
  aspect_ratio?: string;
  // Avatar reference for consistency
  avatar_image_url?: string;
  avatar_description?: string;
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
