/**
 * Simplified Assistant Tools - UGC Only
 * 
 * The assistant now focuses exclusively on UGC ad creation.
 * All other tools (image, video, TTS, etc.) have been removed.
 */

export type AssistantToolKind = 'ugc';

export type ToolSpec = {
  id: AssistantToolKind;
  label: string;
  description: string;
  capabilities: string[];
};

export const TOOL_SPECS: Record<AssistantToolKind, ToolSpec> = {
  ugc: {
    id: 'ugc',
    label: 'UGC Ad Creator',
    description: 'Create complete UGC-style video ads with AI-generated creators, scripts, and video production.',
    capabilities: [
      'Generate diverse creator personas based on product/audience',
      'Write viral ad scripts with hooks, body, and CTAs',
      'Create visual storyboards for each scene',
      'Generate video clips for each scene',
      'Assemble final video with transitions',
    ],
  },
};

// Export for backward compatibility - these are now no-ops
export function fieldsForModel(_model: string, _tool: string): any[] {
  return [];
}

export function defaultsForModel(_model: string, _tool: string): Record<string, any> {
  return {};
}

export function buildUnifiedPlannerSystemPrompt(): string {
  return `You are the UGC Ad Creator assistant - a powerful AI that helps users create viral UGC-style video ads.

YOUR CAPABILITIES:
1. Generate diverse, authentic creator personas
2. Write compelling ad scripts with hooks, body content, and CTAs  
3. Create detailed visual storyboards
4. Generate video clips for each scene
5. Assemble final videos with professional transitions

YOUR APPROACH:
- Be conversational and friendly
- Gather brief info naturally through conversation
- Move the workflow forward decisively
- Explain what you're doing at each step
- Ask for feedback and iterate

WORKFLOW PHASES:
1. INTAKE: Gather product, audience, platform, offer info
2. CASTING: Generate 3 diverse creator options
3. SCRIPTING: Write the ad script
4. STORYBOARD: Create visual scenes
5. PRODUCTION: Generate video clips
6. REVIEW: Final assembly and export

Always create ads featuring adult creators (21+) only.`;
}
