/**
 * Agent Response Types for 4-Step Pipeline
 * 
 * The assistant can respond with different formats based on which step it's in.
 */

export type QuestionType = 'text' | 'choice' | 'url';

export type ClarificationQuestion = {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
};

export type ClarificationNeededResponse = {
  responseType: 'clarification_needed';
  message: string;
  questions: ClarificationQuestion[];
};

export type ResearchInProgressResponse = {
  responseType: 'research_in_progress';
  message: string;
  competitors: string[];
  status: string;
};

export type ResearchInsights = {
  competitors_analyzed: string[];
  videos_analyzed: number;
  key_patterns: string[];
  top_hooks?: string[];
  recommended_format?: string;
  visual_patterns?: string[];
  audio_patterns?: string[];
};

export type ResearchCompleteResponse = {
  responseType: 'research_complete';
  message: string;
  insights: ResearchInsights;
};

export type AudienceHypothesis = {
  segment: string;
  pain: string;
  desire: string;
  belief_shift?: string;
  objections?: string[];
};

export type AngleMap = {
  name: string;
  hook_pattern: string;
  format: string;
  platform: string;
  body_structure?: string;
  cta?: string;
};

export type CreativeRoute = {
  route_id: string;
  format: string;
  platform: string;
  variants: number;
  hypothesis: string;
};

export type TestingMatrix = {
  total_ads: number;
  variables: string[];
  expected_learnings: string;
};

export type CreativeStrategy = {
  audiences: AudienceHypothesis[];
  angles: AngleMap[];
  creative_routes: CreativeRoute[];
  testing_matrix: TestingMatrix;
};

export type StrategyCompleteResponse = {
  responseType: 'strategy_complete';
  message: string;
  strategy: CreativeStrategy;
};

export type WorkflowReadyResponse = {
  responseType: 'workflow_ready';
  summary: string;
  steps: any[]; // AssistantPlanStep[]
};

/**
 * Union type for all possible agent responses
 */
export type AgentResponse =
  | ClarificationNeededResponse
  | ResearchInProgressResponse
  | ResearchCompleteResponse
  | StrategyCompleteResponse
  | WorkflowReadyResponse;

/**
 * Type guard functions
 */
export function isClarificationNeeded(response: any): response is ClarificationNeededResponse {
  return response?.responseType === 'clarification_needed';
}

export function isResearchInProgress(response: any): response is ResearchInProgressResponse {
  return response?.responseType === 'research_in_progress';
}

export function isResearchComplete(response: any): response is ResearchCompleteResponse {
  return response?.responseType === 'research_complete';
}

export function isStrategyComplete(response: any): response is StrategyCompleteResponse {
  return response?.responseType === 'strategy_complete';
}

export function isWorkflowReady(response: any): response is WorkflowReadyResponse {
  return response?.responseType === 'workflow_ready';
}

