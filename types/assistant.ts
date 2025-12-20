export type AssistantToolKind =
  | 'image'
  | 'video'
  | 'lipsync'
  | 'background_remove'
  | 'enhance'
  | 'transcription'
  | 'tts';

export type AssistantPlanField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'url' | 'choice';
  required?: boolean;
  helper?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
};

export type AssistantPlanStep = {
  id: string;
  title: string;
  description?: string;
  tool: AssistantToolKind;
  model: string;
  modelOptions?: string[];
  inputs: Record<string, any>;
  suggestedParams?: Record<string, any>;
  fields?: AssistantPlanField[];
  outputType?: 'image' | 'video' | 'audio' | 'text' | 'json';
  dependencies?: string[];
  validations?: string[];
};

export type AssistantPlan = {
  summary: string;
  steps: AssistantPlanStep[];
};

export type AssistantPlanMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type AssistantMedia = {
  type: 'image' | 'video' | 'audio' | 'url' | 'unknown';
  url: string;
  label?: string;
};

export type AssistantRunEvent =
  | { type: 'task'; taskId: string }
  | { type: 'step_start'; stepId: string; title?: string }
  | { type: 'step_complete'; stepId: string; outputUrl?: string | null; outputText?: string | null }
  | { type: 'step_error'; stepId: string; error: string }
  | { type: 'done'; status: 'success' | 'error'; outputs?: Record<string, unknown> };
