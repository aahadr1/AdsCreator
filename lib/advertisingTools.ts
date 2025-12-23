/**
 * Advertising Tools Registry
 * 
 * Defines advertising-native tools that can be called by the orchestrator.
 * Each tool has schemas, evaluation rubrics, and cost/latency estimates.
 */

import type { AssistantToolKind, AssistantPlanField } from '@/types/assistant';

export type AdvertisingToolKind =
  | 'creative_strategy_generator'
  | 'ad_script_generator'
  | 'hooks_engine'
  | 'offer_engine'
  | 'brand_voice_adapter'
  | 'ad_diagnostic';

export type AdvertisingToolSpec = {
  id: AdvertisingToolKind;
  label: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  evaluationRubric: {
    criteria: string[];
    minimumScores?: Record<string, number>;
    antiGenericRules: string[];
  };
  estimatedCost: 'low' | 'medium' | 'high'; // Low: <$0.10, Medium: $0.10-1, High: >$1
  estimatedLatency: number; // seconds
  implementation: 'llm_call' | 'structured_prompt' | 'api_call';
};

/**
 * Complete registry of advertising-native tools
 */
export const ADVERTISING_TOOLS: Record<AdvertisingToolKind, AdvertisingToolSpec> = {
  creative_strategy_generator: {
    id: 'creative_strategy_generator',
    label: 'Creative Strategy Generator',
    description: 'Generates comprehensive advertising strategies including audience hypotheses, angle maps, and creative routes',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product/service description', required: true },
        targetAudience: { type: 'string', description: 'Optional audience hint' },
        competitors: { type: 'array', items: { type: 'string' }, description: 'Competitor names' },
        platforms: { type: 'array', items: { type: 'string' }, description: 'Target platforms' },
        budget: { type: 'string', enum: ['low', 'medium', 'high'] }
      },
      required: ['product']
    },
    outputSchema: {
      type: 'object',
      properties: {
        audience_hypotheses: { type: 'array', minItems: 3 },
        angle_maps: { type: 'array', minItems: 3 },
        creative_routes: { type: 'array', minItems: 2 },
        testing_matrix: { type: 'object' }
      }
    },
    evaluationRubric: {
      criteria: [
        'Must provide ≥3 distinct audience hypotheses',
        'Must provide ≥3 angle maps with different framings',
        'Must provide ≥2 creative routes',
        'Hypotheses must be hyper-specific (not "millennials")',
        'All hooks in angle maps must score ≥60 novelty'
      ],
      minimumScores: {
        audience_specificity: 70,
        angle_diversity: 80,
        hook_novelty: 60
      },
      antiGenericRules: [
        'NEVER use generic audience segments',
        'NEVER use generic hooks in angle maps',
        'MUST include concrete numbers and scenarios'
      ]
    },
    estimatedCost: 'low',
    estimatedLatency: 12,
    implementation: 'llm_call'
  },

  ad_script_generator: {
    id: 'ad_script_generator',
    label: 'Ad Script Generator',
    description: 'Generates platform-specific ad scripts with strict anti-generic enforcement',
    inputSchema: {
      type: 'object',
      properties: {
        angle: { type: 'object', description: 'Angle map from creative strategy', required: true },
        format: { type: 'string', enum: ['ugc', 'founder', 'demo', 'testimonial', 'comparison', 'explainer'], required: true },
        platform: { type: 'string', enum: ['tiktok', 'instagram', 'youtube', 'facebook', 'meta'], required: true },
        duration: { type: 'number', description: 'Duration in seconds', required: true },
        brandVoice: { type: 'object', description: 'Optional brand guidelines' }
      },
      required: ['angle', 'format', 'platform', 'duration']
    },
    outputSchema: {
      type: 'object',
      properties: {
        script: {
          type: 'object',
          properties: {
            hook: { type: 'string' },
            body: { type: 'string' },
            cta: { type: 'string' }
          }
        },
        visual_directions: { type: 'array', items: { type: 'string' } },
        voiceover_notes: { type: 'string' },
        on_screen_text: { type: 'array' },
        music_suggestion: { type: 'string' },
        novelty_score: { type: 'number' },
        platform_fit: { type: 'number' }
      }
    },
    evaluationRubric: {
      criteria: [
        'Hook must score ≥60 novelty',
        'Must match platform format',
        'CTA must be specific (not "click here")',
        'Must include precise timing (hook/body/CTA)',
        'Visual directions must be actionable'
      ],
      minimumScores: {
        novelty: 60,
        platform_fit: 70
      },
      antiGenericRules: [
        'NEVER use "Are you tired of..." without specificity',
        'NEVER use "Click here" or "Learn more" as CTA',
        'MUST include concrete details and numbers'
      ]
    },
    estimatedCost: 'low',
    estimatedLatency: 10,
    implementation: 'llm_call'
  },

  hooks_engine: {
    id: 'hooks_engine',
    label: 'Hooks Engine',
    description: 'Generates hook variants with strict novelty constraints',
    inputSchema: {
      type: 'object',
      properties: {
        angle: { type: 'string', description: 'Strategic angle', required: true },
        product: { type: 'string', description: 'Product description', required: true },
        targetAudience: { type: 'string', description: 'Target audience', required: true },
        count: { type: 'number', description: 'Number of hooks', default: 5 },
        platform: { type: 'string', enum: ['tiktok', 'instagram', 'youtube', 'facebook', 'meta'], required: true }
      },
      required: ['angle', 'product', 'targetAudience', 'platform']
    },
    outputSchema: {
      type: 'object',
      properties: {
        hooks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              novelty_score: { type: 'number' },
              category: { type: 'string' },
              rationale: { type: 'string' },
              platform_fit: { type: 'string' }
            }
          }
        }
      }
    },
    evaluationRubric: {
      criteria: [
        'All hooks must score ≥60 novelty',
        'Must provide diverse categories (not all same type)',
        'Must be platform-appropriate',
        'Must be hyper-specific to product/audience'
      ],
      minimumScores: {
        novelty: 60,
        diversity: 70
      },
      antiGenericRules: [
        'AUTOMATIC REJECTION: "Are you tired of..." without specificity',
        'AUTOMATIC REJECTION: "You won\'t believe..."',
        'AUTOMATIC REJECTION: Generic audience ("everyone", "people")'
      ]
    },
    estimatedCost: 'low',
    estimatedLatency: 8,
    implementation: 'llm_call'
  },

  offer_engine: {
    id: 'offer_engine',
    label: 'Offer Engine',
    description: 'Generates compelling offers with urgency and risk reversal',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product description', required: true },
        pricePoint: { type: 'number', description: 'Price point' },
        objective: { type: 'string', enum: ['awareness', 'consideration', 'conversion'], required: true }
      },
      required: ['product', 'objective']
    },
    outputSchema: {
      type: 'object',
      properties: {
        value_proposition: { type: 'string' },
        price_framing: { type: 'string' },
        urgency_mechanism: { type: 'string' },
        risk_reversal: { type: 'string' },
        bonuses: { type: 'array', items: { type: 'string' } },
        cta_suggestions: { type: 'array', items: { type: 'string' } }
      }
    },
    evaluationRubric: {
      criteria: [
        'Must include specific urgency (not just "limited time")',
        'Must include risk reversal (guarantee/trial)',
        'Price framing must compare to alternative',
        'CTAs must be action-specific'
      ],
      antiGenericRules: [
        'NEVER: Vague urgency ("limited time" without specifics)',
        'NEVER: Generic CTAs ("Buy now", "Order today")',
        'MUST: Include specific numbers and timeframes'
      ]
    },
    estimatedCost: 'low',
    estimatedLatency: 6,
    implementation: 'llm_call'
  },

  brand_voice_adapter: {
    id: 'brand_voice_adapter',
    label: 'Brand Voice Adapter',
    description: 'Adapts generated content to match brand voice and guidelines',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content to adapt', required: true },
        brandGuidelines: {
          type: 'object',
          description: 'Brand guidelines',
          properties: {
            colors: { type: 'array', items: { type: 'string' } },
            fonts: { type: 'array', items: { type: 'string' } },
            styleKeywords: { type: 'array', items: { type: 'string' } },
            toneOfVoice: { type: 'string' },
            avoidances: { type: 'array', items: { type: 'string' } }
          },
          required: true
        }
      },
      required: ['content', 'brandGuidelines']
    },
    outputSchema: {
      type: 'object',
      properties: {
        adapted_content: { type: 'string' },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              original: { type: 'string' },
              adapted: { type: 'string' },
              reason: { type: 'string' }
            }
          }
        },
        consistency_score: { type: 'number' }
      }
    },
    evaluationRubric: {
      criteria: [
        'Must maintain original message',
        'Must incorporate brand keywords naturally',
        'Must avoid brand avoidances',
        'Consistency score ≥70'
      ],
      minimumScores: {
        consistency: 70
      },
      antiGenericRules: [
        'NEVER force-fit brand keywords awkwardly',
        'NEVER change core message',
        'MUST maintain natural flow'
      ]
    },
    estimatedCost: 'low',
    estimatedLatency: 6,
    implementation: 'llm_call'
  },


  ad_diagnostic: {
    id: 'ad_diagnostic',
    label: 'Ad Diagnostic',
    description: 'Analyzes uploaded media to extract ad principles and suggest variations',
    inputSchema: {
      type: 'object',
      properties: {
        mediaUrl: { type: 'string', description: 'URL of media', required: true },
        mediaType: { type: 'string', enum: ['image', 'video'], required: true },
        platform: { type: 'string', description: 'Platform context' },
        productCategory: { type: 'string', description: 'Product category' }
      },
      required: ['mediaUrl', 'mediaType']
    },
    outputSchema: {
      type: 'object',
      properties: {
        visual_analysis: { type: 'object' },
        brand_elements: { type: 'object' },
        ad_elements: { type: 'object' },
        effectiveness_scores: { type: 'object' },
        platform_fit: { type: 'object' },
        strengths: { type: 'array', items: { type: 'string' } },
        weaknesses: { type: 'array', items: { type: 'string' } },
        recommendations: { type: 'array', items: { type: 'string' } },
        variations: { type: 'array' }
      }
    },
    evaluationRubric: {
      criteria: [
        'Must provide specific visual analysis',
        'Must score effectiveness objectively',
        'Must identify both strengths AND weaknesses',
        'Recommendations must be actionable',
        'Variations must have clear hypotheses'
      ],
      antiGenericRules: [
        'NEVER: Vague descriptions ("looks good")',
        'NEVER: Generic recommendations ("improve quality")',
        'MUST: Include specific, measurable suggestions'
      ]
    },
    estimatedCost: 'low',
    estimatedLatency: 10,
    implementation: 'llm_call'
  }
};

/**
 * Helper: Calculate novelty score for any text
 */
export function calculateNoveltyScore(text: string): number {
  let score = 100;

  // Penalty for generic phrases
  const genericPhrases = [
    { pattern: /are you tired of/i, penalty: 40 },
    { pattern: /click here|learn more/i, penalty: 30 },
    { pattern: /amazing|incredible|awesome/i, penalty: 20 },
    { pattern: /secret they don't want you to know/i, penalty: 40 },
    { pattern: /this one trick/i, penalty: 35 },
    { pattern: /you won't believe/i, penalty: 30 },
    { pattern: /game-changer|revolutionary/i, penalty: 25 },
    { pattern: /\beveryone\b|\bpeople\b/i, penalty: 15 }
  ];

  for (const { pattern, penalty } of genericPhrases) {
    if (pattern.test(text)) {
      score -= penalty;
    }
  }

  // Bonus for specificity
  if (/\d+/.test(text)) score += 10; // Contains numbers
  if (text.length > 50) score += 10; // Detailed
  if (/weird|embarrassing|confession|mistake|secret|revealed/i.test(text)) score += 15; // Pattern interrupt
  if (/pov:|if you|for people who/i.test(text)) score += 10; // Targeted

  return Math.max(0, Math.min(100, score));
}

/**
 * Helper: Check if content passes quality gate
 */
export function passesQualityGate(
  content: string,
  contentType: 'hook' | 'script' | 'prompt',
  customThreshold?: number
): { passed: boolean; score: number; reason?: string } {
  const thresholds = {
    hook: 60,
    script: 55,
    prompt: 50
  };

  const threshold = customThreshold ?? thresholds[contentType];
  const score = calculateNoveltyScore(content);

  if (score < threshold) {
    return {
      passed: false,
      score,
      reason: `Novelty score ${score} below threshold ${threshold}`
    };
  }

  return { passed: true, score };
}

/**
 * Helper: Get tool by ID
 */
export function getAdvertisingTool(toolId: AdvertisingToolKind): AdvertisingToolSpec | null {
  return ADVERTISING_TOOLS[toolId] || null;
}

/**
 * Helper: Get all advertising tools
 */
export function getAllAdvertisingTools(): AdvertisingToolSpec[] {
  return Object.values(ADVERTISING_TOOLS);
}

/**
 * Helper: Validate tool input against schema
 */
export function validateToolInput(
  toolId: AdvertisingToolKind,
  input: Record<string, any>
): { valid: boolean; errors?: string[] } {
  const tool = getAdvertisingTool(toolId);
  if (!tool) {
    return { valid: false, errors: ['Tool not found'] };
  }

  const errors: string[] = [];
  const required = tool.inputSchema.required || [];

  for (const field of required) {
    if (!(field in input)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * Cost estimation for advertising tools
 */
export const ADVERTISING_TOOL_COSTS: Record<AdvertisingToolKind, number> = {
  creative_strategy_generator: 0.05,
  ad_script_generator: 0.03,
  hooks_engine: 0.02,
  offer_engine: 0.02,
  brand_voice_adapter: 0.02,
  ad_diagnostic: 0.04
};

/**
 * Helper: Estimate total cost for advertising workflow
 */
export function estimateAdvertisingWorkflowCost(tools: AdvertisingToolKind[]): number {
  return tools.reduce((sum, toolId) => {
    return sum + (ADVERTISING_TOOL_COSTS[toolId] || 0);
  }, 0);
}

