/**
 * Reflexion Helper
 * 
 * Enables continuous reflexion throughout assistant operations.
 * The assistant can reflect at any time: before tools, between tools,
 * during long operations, and after completion.
 */

import OpenAI from 'openai';

// Lazy initialize OpenAI to avoid build-time errors
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Perform autonomous reflexion
 * 
 * The assistant reflects on current state and decides next action.
 * Returns natural thinking text, not structured data.
 */
export async function performReflexion(params: {
  context: string;
  question: string;
  lastToolResult?: any;
  conversationHistory?: string;
}): Promise<string> {
  
  const prompt = `You are reflecting on the current state of your work.

Context:
${params.context}

${params.lastToolResult ? `Last tool result:\n${JSON.stringify(params.lastToolResult, null, 2)}` : ''}

${params.conversationHistory ? `Conversation history:\n${params.conversationHistory}` : ''}

Reflect on this question:
${params.question}

Write your thoughts naturally - what you're noticing, whether things are going well, 
what might need adjustment, whether you should proceed or ask the user for feedback.

Don't use rigid categories. Just think naturally and honestly about the current state.`;

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an AI assistant performing self-reflection. Write natural, 
honest thoughts about your current work state. Be concise but insightful. Think like 
a professional evaluating their own work.`
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 300,
  });
  
  return response.choices[0].message.content || 'Reflection: Proceeding with current approach.';
}

/**
 * Quick reflexion checkpoint
 * 
 * Faster, more focused reflexion for simple go/no-go decisions
 */
export async function quickReflexion(params: {
  question: string;
  data: any;
}): Promise<{
  shouldProceed: boolean;
  reasoning: string;
  needsAdjustment: boolean;
}> {
  
  const prompt = `Quick assessment needed:

Data to evaluate:
${typeof params.data === 'string' ? params.data : JSON.stringify(params.data, null, 2)}

Question: ${params.question}

Respond with:
1. Should we proceed? (yes/no)
2. Why? (brief reasoning)
3. Does anything need adjustment? (yes/no)

Be concise and direct.`;

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are performing a quick quality check. Be direct and concise.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.5,
    max_tokens: 150,
  });
  
  const text = response.choices[0].message.content || '';
  
  // Parse the response naturally
  const shouldProceed = text.toLowerCase().includes('yes') || 
                       text.toLowerCase().includes('proceed') ||
                       !text.toLowerCase().includes('no');
  
  const needsAdjustment = text.toLowerCase().includes('adjust') ||
                         text.toLowerCase().includes('fix') ||
                         text.toLowerCase().includes('change');
  
  return {
    shouldProceed,
    reasoning: text,
    needsAdjustment
  };
}

/**
 * Stream reflexion event
 * 
 * Helper to send reflexion events through SSE
 */
export function formatReflexionEvent(reflexion: string): string {
  return `event: reflexion_chunk\ndata: ${JSON.stringify({ content: reflexion })}\n\n`;
}

/**
 * Reflexion wrapper for tool execution
 * 
 * Executes a tool with before/after reflexion checkpoints
 */
export async function executeWithReflexion<T>(
  toolName: string,
  toolFn: () => Promise<T>,
  params: {
    beforeQuestion?: string;
    afterQuestion?: string;
    context: string;
    onReflexion?: (reflexion: string) => void;
  }
): Promise<{
  result: T;
  beforeReflexion?: string;
  afterReflexion?: string;
}> {
  
  let beforeReflexion: string | undefined;
  let afterReflexion: string | undefined;
  
  // Before reflexion
  if (params.beforeQuestion) {
    beforeReflexion = await performReflexion({
      context: params.context,
      question: params.beforeQuestion,
    });
    
    if (params.onReflexion) {
      params.onReflexion(beforeReflexion);
    }
  }
  
  // Execute tool
  const result = await toolFn();
  
  // After reflexion
  if (params.afterQuestion) {
    afterReflexion = await performReflexion({
      context: params.context,
      question: params.afterQuestion,
      lastToolResult: result,
    });
    
    if (params.onReflexion) {
      params.onReflexion(afterReflexion);
    }
  }
  
  return {
    result,
    beforeReflexion,
    afterReflexion,
  };
}

/**
 * Progress reflexion during long operations
 * 
 * Periodically reflects on progress during lengthy tasks
 */
export async function progressReflexion(params: {
  operationName: string;
  currentStep: string;
  totalSteps: number;
  currentStepNumber: number;
  intermediateResult?: any;
}): Promise<string> {
  
  const progress = Math.round((params.currentStepNumber / params.totalSteps) * 100);
  
  const prompt = `You are ${progress}% through ${params.operationName}.

Current step (${params.currentStepNumber}/${params.totalSteps}): ${params.currentStep}

${params.intermediateResult ? `Intermediate result:\n${JSON.stringify(params.intermediateResult, null, 2)}` : ''}

Quick progress check: Is everything on track? Any concerns?`;

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are checking progress on a multi-step operation. Be brief and focused.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.6,
    max_tokens: 100,
  });
  
  return response.choices[0].message.content || 'Progress: On track.';
}
