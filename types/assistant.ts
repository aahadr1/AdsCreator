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
export type ToolName = 'script_creation' | 'image_generation' | 'storyboard_creation';

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
}

export interface ImageGenerationOutput {
  prediction_id: string;
  status: string;
  output_url?: string;
}

// Storyboard specific types
export interface StoryboardScene {
  scene_number: number;
  scene_name: string;
  description: string;
  duration_seconds?: number;
  first_frame_prompt: string;
  last_frame_prompt: string;
  transition_type?: 'smooth' | 'cut';
  camera_angle?: string;
  setting_change?: boolean;
  uses_avatar?: boolean;
  video_generation_prompt?: string;
  audio_notes?: string;
  // Generated image URLs and status (populated after generation)
  first_frame_url?: string;
  last_frame_url?: string;
  first_frame_prediction_id?: string;
  last_frame_prediction_id?: string;
  first_frame_status?: 'pending' | 'generating' | 'succeeded' | 'failed';
  last_frame_status?: 'pending' | 'generating' | 'succeeded' | 'failed';
  first_frame_error?: string;
  last_frame_error?: string;
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
  scenes: StoryboardScene[];
  created_at: string;
  status: 'draft' | 'generating' | 'ready' | 'failed';
}

export interface StoryboardCreationInput {
  title: string;
  brand_name?: string;
  product?: string;
  target_audience?: string;
  platform?: 'tiktok' | 'instagram' | 'facebook' | 'youtube_shorts';
  total_duration_seconds?: number;
  style?: string;
  aspect_ratio?: string;
  // Avatar reference for image-to-image consistency
  avatar_image_url?: string;
  avatar_description?: string;
  scenes: Array<{
    scene_number: number;
    scene_name: string;
    description: string;
    duration_seconds?: number;
    first_frame_prompt: string;
    last_frame_prompt: string;
    transition_type?: 'smooth' | 'cut';
    camera_angle?: string;
    setting_change?: boolean;
    uses_avatar?: boolean;
    video_generation_prompt?: string;
    audio_notes?: string;
  }>;
}

export interface StoryboardCreationOutput {
  storyboard: Storyboard;
}
