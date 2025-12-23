/**
 * Safety Gates Implementation
 * Phase 4: Add safety gates (ambiguity and quality only)
 */

import type { AmbiguityGate, QualityGate } from '@/types/execution';
import { calculateNoveltyScore } from './advertisingTools';

/**
 * Detect ambiguity in user request
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
  const assumptions: string[] = [];
  
  if (!hasProduct) {
    questions.push('What product or service should the ads promote?');
  } else {
    assumptions.push('Product inferred from request');
  }
  
  if (!hasPlatform && questions.length < 2) {
    questions.push('Which platform(s): TikTok, Instagram, YouTube, or Meta?');
    assumptions.push('Will default to TikTok/Instagram if not specified');
  }

  if (questions.length === 0) {
    return null;
  }

  return {
    type: 'ambiguity',
    triggered: true,
    severity: 'warning',
    message: 'User request needs clarification',
    recommendation: 'Ask user to clarify or proceed with assumptions',
    questions: questions.slice(0, 2), // Max 2 questions
    inferredAssumptions: assumptions
  };
}

/**
 * Check quality gate for content
 */
export function checkQualityGate(
  content: string,
  contentType: 'hook' | 'script' | 'prompt',
  threshold?: number
): QualityGate | null {
  const thresholds = {
    hook: 60,
    script: 55,
    prompt: 50
  };

  const requiredThreshold = threshold ?? thresholds[contentType];
  const noveltyScore = calculateNoveltyScore(content);

  if (noveltyScore >= requiredThreshold) {
    return null; // Passed
  }

  // Failed quality check
  const suggestions: string[] = [];

  // Analyze why it failed
  if (/are you tired of/i.test(content)) {
    suggestions.push('Replace "Are you tired of..." with a more specific scenario');
  }
  if (/click here|learn more/i.test(content)) {
    suggestions.push('Replace vague CTA with specific action (e.g., "Try first box 50% off")');
  }
  if (!/\d+/.test(content)) {
    suggestions.push('Add specific numbers to increase credibility');
  }
  if (content.length < 50) {
    suggestions.push('Add more specific details and context');
  }

  return {
    type: 'quality',
    triggered: true,
    severity: 'blocking',
    message: `Content quality below threshold (${noveltyScore}/${requiredThreshold})`,
    recommendation: 'Regenerate with stricter novelty constraints',
    contentType,
    noveltyScore,
    threshold: requiredThreshold,
    failureReason: `Generic language detected. Score: ${noveltyScore}/${requiredThreshold}`,
    suggestions,
    retryCount: 0,
    maxRetries: 3
  };
}

/**
 * Retry quality check with updated content
 */
export function retryQualityGate(
  gate: QualityGate,
  newContent: string
): { passed: boolean; gate: QualityGate | null } {
  if (gate.retryCount >= gate.maxRetries) {
    return {
      passed: false,
      gate: {
        ...gate,
        message: `Max retries (${gate.maxRetries}) exceeded`,
        severity: 'warning'
      }
    };
  }

  const updatedGate = checkQualityGate(newContent, gate.contentType, gate.threshold);
  
  if (updatedGate) {
    updatedGate.retryCount = gate.retryCount + 1;
    return { passed: false, gate: updatedGate };
  }

  return { passed: true, gate: null };
}

/**
 * Check all safety gates for a plan
 */
export function checkSafetyGates(params: {
  userRequest?: string;
  content?: string;
  contentType?: 'hook' | 'script' | 'prompt';
}): {
  ambiguityGate: AmbiguityGate | null;
  qualityGate: QualityGate | null;
  hasBlockingGates: boolean;
} {
  const ambiguityGate = params.userRequest ? detectAmbiguity(params.userRequest) : null;
  const qualityGate = (params.content && params.contentType) 
    ? checkQualityGate(params.content, params.contentType)
    : null;

  const hasBlockingGates = !!(
    (ambiguityGate && ambiguityGate.severity === 'blocking') ||
    (qualityGate && qualityGate.severity === 'blocking')
  );

  return {
    ambiguityGate,
    qualityGate,
    hasBlockingGates
  };
}

