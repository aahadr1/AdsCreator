/**
 * Enhanced Execution Plan Schemas with Safety Gates
 * 
 * Extends the existing AssistantPlanStep with advertising-specific metadata
 * and safety gate configurations.
 */

import type { AssistantPlanStep } from './assistant';

/**
 * Execution mode for the agent
 */
export type ExecutionMode = 'manual' | 'auto';

/**
 * Cost tiers for estimation
 */
export type CostTier = 'low' | 'medium' | 'high';
// Low: <$1, Medium: $1-5, High: >$5

/**
 * Risk levels for safety gates
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Safety gate types
 */
export type SafetyGateType = 'ambiguity' | 'quality';

/**
 * Enhanced Plan Step with execution metadata
 */
export type EnhancedPlanStep = AssistantPlanStep & {
  // Execution control
  executionMode: ExecutionMode;
  requiresApproval: boolean;
  
  // Cost & Performance
  estimatedCost: CostTier;
  estimatedCostAmount?: number; // Exact dollar amount if known
  estimatedLatency: number; // seconds
  
  // Risk & Safety
  riskLevel: RiskLevel;
  checkpoint: boolean; // Pause for review even in auto mode
  pauseReason?: string; // Why this step was paused
  
  // Research & Analysis
  researchRequired?: boolean;
  
  
  // Quality
  minimumNoveltyScore?: number; // For hooks/scripts
  maxRetries?: number; // How many times to retry if quality fails
};

/**
 * Safety Gate Configuration
 */
export type SafetyGate = {
  type: SafetyGateType;
  triggered: boolean;
  severity: 'blocking' | 'warning';
  message: string;
  recommendation?: string;
  data?: Record<string, any>;
};

/**
 * Ambiguity Gate
 */
export type AmbiguityGate = SafetyGate & {
  type: 'ambiguity';
  questions: string[]; // Max 2 questions
  inferredAssumptions?: string[]; // What agent assumed
};


/**
 * Quality Gate
 */
export type QualityGate = SafetyGate & {
  type: 'quality';
  contentType: 'hook' | 'script' | 'prompt';
  noveltyScore: number;
  threshold: number;
  failureReason: string;
  suggestions: string[];
  retryCount: number;
  maxRetries: number;
};

/**
 * Complete Execution Plan with Safety Gates
 */
export type EnhancedExecutionPlan = {
  summary: string;
  steps: EnhancedPlanStep[];
  
  // Execution metadata
  executionMode: ExecutionMode;
  totalEstimatedCost: number;
  totalEstimatedLatency: number; // seconds
  
  // Safety gates
  safetyGates: SafetyGate[];
  checkpoints: string[]; // Step IDs that are checkpoints
  
  // Research & Strategy
  includesResearch: boolean;
  includesStrategy: boolean;
  
  // User context
  userId: string;
  conversationId?: string;
  
  // Timestamps
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

/**
 * Step Execution Result
 */
export type StepExecutionResult = {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  outputUrl?: string | null;
  outputText?: string | null;
  error?: string;
  
  // Performance
  startTime?: number; // timestamp
  endTime?: number; // timestamp
  duration?: number; // seconds
  cost?: number; // actual cost
  
  // Quality
  noveltyScore?: number;
  qualityCheckPassed?: boolean;
  complianceCheckPassed?: boolean;
  
  // Retries
  retryCount?: number;
  rejectionReasons?: string[];
};

/**
 * Execution Progress Event
 */
export type ExecutionProgressEvent = 
  | { type: 'plan_generated'; plan: EnhancedExecutionPlan }
  | { type: 'safety_gate_triggered'; gate: SafetyGate }
  | { type: 'checkpoint_reached'; stepId: string; data: any }
  | { type: 'step_start'; stepId: string; title: string }
  | { type: 'step_progress'; stepId: string; progress: number }
  | { type: 'step_complete'; stepId: string; result: StepExecutionResult }
  | { type: 'step_failed'; stepId: string; error: string; retrying: boolean }
  | { type: 'quality_check_failed'; stepId: string; score: number; threshold: number }
  | { type: 'compliance_check_failed'; stepId: string; violations: string[] }
  | { type: 'workflow_paused'; reason: string; resumable: boolean }
  | { type: 'workflow_complete'; success: boolean; outputs: Record<string, StepExecutionResult> };

/**
 * Execution Controller Configuration
 */
export type ExecutionControllerConfig = {
  mode: ExecutionMode;
  
  
  // Quality thresholds
  minimumNoveltyScore?: number;
  maxRetriesPerStep?: number;
  
  // Safety
  enableQualityChecks: boolean;
  enableAmbiguityDetection: boolean;
  
  // Checkpoints
  pauseAtCheckpoints: boolean;
  pauseAfterResearch: boolean;
  pauseAfterStrategy: boolean;
  pauseAfterFirstVariant: boolean;
  
  // Timeouts
  maxStepDuration?: number; // seconds
  maxWorkflowDuration?: number; // seconds
};

/**
 * Helper: Calculate total cost for plan
 */
export function calculatePlanCost(steps: EnhancedPlanStep[]): number {
  return steps.reduce((sum, step) => {
    return sum + (step.estimatedCostAmount || 0);
  }, 0);
}

/**
 * Helper: Calculate total latency for plan
 */
export function calculatePlanLatency(steps: EnhancedPlanStep[]): number {
  // Sequential execution, so sum all latencies
  return steps.reduce((sum, step) => {
    return sum + step.estimatedLatency;
  }, 0);
}


/**
 * Helper: Check for ambiguity in request
 */
export function detectAmbiguity(userRequest: string): AmbiguityGate | null {
  const hasProduct = /\b(product|service|app|tool|brand|company)\b/i.test(userRequest) ||
                     userRequest.split(' ').length > 5;
  const hasPlatform = /\b(tiktok|instagram|youtube|facebook|meta|linkedin)\b/i.test(userRequest);
  const hasGoal = /\b(ad|ads|campaign|creative|video|content|promote|sell|market)\b/i.test(userRequest);

  const clarityScore = [hasProduct, hasPlatform, hasGoal].filter(Boolean).length;

  if (clarityScore >= 2) {
    return null; // Clear enough
  }

  const questions: string[] = [];
  
  if (!hasProduct) {
    questions.push('What product or service should the ads promote?');
  }
  if (!hasPlatform && questions.length < 2) {
    questions.push('Which platform(s): TikTok, Instagram, YouTube, or Meta?');
  }

  if (questions.length === 0) {
    return null;
  }

  return {
    type: 'ambiguity',
    triggered: true,
    severity: 'blocking',
    message: 'User request needs clarification',
    recommendation: 'Ask user to clarify',
    questions: questions.slice(0, 2), // Max 2 questions
    inferredAssumptions: []
  };
}

/**
 * Helper: Format time estimate for display
 */
export function formatTimeEstimate(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * Helper: Format cost estimate for display
 */
export function formatCostEstimate(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Helper: Get cost tier from amount
 */
export function getCostTier(amount: number): CostTier {
  if (amount < 1) return 'low';
  if (amount < 5) return 'medium';
  return 'high';
}

/**
 * Helper: Get risk level for step
 */
export function getRiskLevel(step: EnhancedPlanStep): RiskLevel {
  // High risk if:
  // - High cost
  // - Long latency
  // - Research required
  // - First time trying something

  if (step.estimatedCost === 'high' || step.estimatedLatency > 300) {
    return 'high';
  }

  if (step.researchRequired || step.checkpoint) {
    return 'medium';
  }

  return 'low';
}

