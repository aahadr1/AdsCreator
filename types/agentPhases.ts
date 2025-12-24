/**
 * Agent Phase System
 * 
 * Separates assistant work into 3 distinct phases:
 * 1. THINKING - Reasoning, research, analysis (visible chain of thought)
 * 2. PLANNING - Building the concrete execution plan (all decisions made)
 * 3. EXECUTING - Running models one by one (no more thinking needed)
 */

// ============================================================================
// PHASE 1: THINKING
// ============================================================================

export type ThoughtType = 
  | 'understanding'    // Understanding user's request
  | 'questioning'      // Deciding what to ask
  | 'researching'      // Competitor/market research
  | 'analyzing'        // Analyzing data/content
  | 'strategizing'     // Building creative strategy
  | 'deciding'         // Making a decision
  | 'planning'         // Planning next steps
  | 'concluding';      // Final conclusions

export type Thought = {
  id: string;
  type: ThoughtType;
  title: string;
  content: string;
  details?: string[];
  data?: Record<string, any>;
  timestamp: number;
  duration?: number; // ms
};

export type ThinkingPhase = {
  phase: 'thinking';
  status: 'active' | 'complete';
  thoughts: Thought[];
  currentThought?: string;
  summary?: string;
};

// ============================================================================
// PHASE 2: PLANNING
// ============================================================================

export type PlanStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  tool: string;
  model: string;
  inputs: Record<string, any>;
  prompt: string;
  dependencies: string[];
  outputType: 'image' | 'video' | 'audio' | 'text';
  estimatedTime: number; // seconds
  reasoning?: string; // Why this step was chosen
};

export type PlanningPhase = {
  phase: 'planning';
  status: 'active' | 'complete';
  summary: string;
  totalSteps: number;
  steps: PlanStep[];
  estimatedTotalTime: number;
  creativeStrategy?: {
    audiences: any[];
    angles: any[];
    routes: any[];
  };
};

// ============================================================================
// PHASE 3: EXECUTING
// ============================================================================

export type ExecutionStepStatus = 'pending' | 'running' | 'complete' | 'error' | 'skipped';

export type ExecutionStep = {
  id: string;
  status: ExecutionStepStatus;
  progress?: number; // 0-100
  output?: {
    url?: string;
    text?: string;
    data?: any;
  };
  error?: string;
  startTime?: number;
  endTime?: number;
};

export type ExecutingPhase = {
  phase: 'executing';
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  currentStep?: string;
  steps: Record<string, ExecutionStep>;
  outputs: Array<{
    stepId: string;
    type: 'image' | 'video' | 'audio' | 'text';
    url?: string;
    data?: any;
  }>;
};

// ============================================================================
// UNIFIED RESPONSE
// ============================================================================

export type AgentPhaseResponse = {
  responseType: 'phased';
  
  // Current active phase
  activePhase: 'thinking' | 'planning' | 'ready' | 'executing' | 'complete';
  
  // Phase data
  thinking?: ThinkingPhase;
  planning?: PlanningPhase;
  executing?: ExecutingPhase;
  
  // User interaction
  needsInput?: {
    type: 'question' | 'confirmation' | 'choice';
    data: any;
  };
  
  // Metadata
  requestId: string;
  timestamp: number;
};

// ============================================================================
// HELPERS
// ============================================================================

export function createThought(
  type: ThoughtType,
  title: string,
  content: string,
  details?: string[]
): Thought {
  return {
    id: `thought_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    title,
    content,
    details,
    timestamp: Date.now(),
  };
}

export function isAgentPhaseResponse(response: any): response is AgentPhaseResponse {
  return response?.responseType === 'phased';
}

