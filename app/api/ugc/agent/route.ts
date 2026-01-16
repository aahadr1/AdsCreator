// =============================================================================
// UGC AGENT API - Capability-Based, Agentic (No Rigid Phases)
// =============================================================================

import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import type {
  UgcProject,
  AgentResponse,
  WidgetBlock,
  ToolCall,
  QcmOption,
  CreativeBrief,
  ActorOption,
  Scene,
  Keyframe,
  getProjectCapabilities,
  ProjectCapabilities,
} from '@/types/ugc';
import {
  createProject,
  getProject,
  updateProject,
  updateBrief,
  addActors,
  selectActor,
  createStoryboard,
  updateScene,
  approveStoryboard,
  approveScene,
  addClip,
  updateClip,
  generateId,
} from '@/lib/projectStore';
import { generateStyleBible, createStyleBibleForProject } from '@/lib/styleBible';
import { analyzeForkNeeds, checkOutOfDate } from '@/lib/versioning';

export const runtime = 'nodejs';
export const maxDuration = 120;

// NOTE: Replicate expects Anthropic models in the form "anthropic/<model-id>".
// We keep this aligned with the known-working model used elsewhere in the repo.
const CLAUDE_MODEL = 'anthropic/claude-4.5-sonnet';

// -----------------------------------------------------------------------------
// Intent Classification
// -----------------------------------------------------------------------------

type UserIntent =
  | 'greeting'
  | 'create_project'
  | 'edit_brief'
  | 'ask_question'
  | 'request_actors'
  | 'select_actor'
  | 'regenerate_actor'
  | 'set_direction'
  | 'generate_storyboard'
  | 'edit_scene'
  | 'regenerate_keyframes'
  | 'approve_scene'
  | 'approve_storyboard'
  | 'generate_videos'
  | 'regenerate_clip'
  | 'assemble'
  | 'export'
  | 'qcm_response'
  | 'change_settings'
  | 'off_topic'
  | 'unclear';

type IntentClassification = {
  intent: UserIntent;
  confidence: number;
  entities: Record<string, any>;
  requiresClarification: boolean;
  clarificationQuestion?: string;
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function chunkToString(chunk: any): string {
  if (!chunk && chunk !== 0) return '';
  if (typeof chunk === 'string' || typeof chunk === 'number') return String(chunk);
  if (Array.isArray(chunk)) return chunk.map(chunkToString).join('');
  if (typeof chunk === 'object') {
    if (typeof chunk.text === 'string') return chunk.text;
    if (typeof chunk.delta === 'string') return chunk.delta;
    if (chunk.output !== undefined) return chunkToString(chunk.output);
    if (Array.isArray(chunk.content)) return chunk.content.map(chunkToString).join('');
  }
  try { return JSON.stringify(chunk); } catch { return ''; }
}

function safeJsonParse<T>(raw: string): T | null {
  const cleaned = (raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned) as T; }
  catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]) as T; } catch { return null; } }
    return null;
  }
}

function deriveCapabilities(project: UgcProject | null): ProjectCapabilities {
  if (!project) {
    return {
      hasBrief: false, hasActors: false, hasSelectedActor: false, hasStyleBible: false,
      hasDirectionLock: false, hasStoryboard: false, isStoryboardApproved: false,
      hasAllKeyframes: false, hasClips: false, hasAllClipsReady: false,
      hasFinalEdit: false, hasFinalExport: false,
      canGenerateActors: false, canGenerateStoryboard: false, canGenerateVideos: false, canAssemble: false,
    };
  }
  
  const hasBrief = !!project.brief?.productName && !!project.brief?.targetAudience;
  const hasActors = project.actors.length > 0;
  const hasSelectedActor = !!project.selectedActorId && project.actors.some(a => a.id === project.selectedActorId);
  const hasStyleBible = !!project.styleBible;
  const hasDirectionLock = !!project.directionLock;
  const hasStoryboard = !!project.storyboard && project.storyboard.scenes.length > 0;
  const isStoryboardApproved = !!project.storyboard?.isApproved;
  const hasAllKeyframes = hasStoryboard && project.storyboard!.scenes.every(
    s => s.keyframes.length >= 2 && s.keyframes.every(k => k.status === 'complete')
  );
  const hasClips = project.clips.length > 0;
  const hasAllClipsReady = hasStoryboard && project.storyboard!.scenes.every(s =>
    project.clips.some(c => c.sceneId === s.id && c.status === 'complete')
  );
  const hasFinalEdit = !!project.finalEdit;
  const hasFinalExport = !!project.finalEdit?.finalVideoUrl;
  
  return {
    hasBrief, hasActors, hasSelectedActor, hasStyleBible, hasDirectionLock,
    hasStoryboard, isStoryboardApproved, hasAllKeyframes, hasClips, hasAllClipsReady,
    hasFinalEdit, hasFinalExport,
    canGenerateActors: hasBrief,
    canGenerateStoryboard: hasSelectedActor && hasDirectionLock,
    canGenerateVideos: isStoryboardApproved && hasAllKeyframes,
    canAssemble: hasAllClipsReady,
  };
}

// -----------------------------------------------------------------------------
// Agent Core - Intent Classification via LLM
// -----------------------------------------------------------------------------

async function classifyIntent(
  replicate: Replicate,
  userMessage: string,
  capabilities: ProjectCapabilities,
  conversationContext: string
): Promise<IntentClassification> {
  const prompt = `You are an intent classifier for a UGC ad creation assistant.

USER MESSAGE: "${userMessage}"

CURRENT PROJECT STATE:
- Has brief: ${capabilities.hasBrief}
- Has actors generated: ${capabilities.hasActors}
- Has actor selected: ${capabilities.hasSelectedActor}
- Has direction locked: ${capabilities.hasDirectionLock}
- Has storyboard: ${capabilities.hasStoryboard}
- Storyboard approved: ${capabilities.isStoryboardApproved}
- Has video clips: ${capabilities.hasClips}
- All clips ready: ${capabilities.hasAllClipsReady}
- Has final export: ${capabilities.hasFinalExport}

RECENT CONTEXT: ${conversationContext}

Classify the user's intent into ONE of these categories:
- greeting: User is saying hello or starting conversation
- create_project: User wants to start a new ad project
- edit_brief: User is providing product info, audience, goals, or editing existing brief
- ask_question: User is asking a question (not providing info)
- request_actors: User wants to generate/see creator options
- select_actor: User is choosing an actor (e.g., "I'll go with option 2")
- regenerate_actor: User wants to regenerate actor options
- set_direction: User is setting filming style, voice mode, structure
- generate_storyboard: User wants to create/generate storyboard
- edit_scene: User wants to edit a specific scene
- regenerate_keyframes: User wants to regenerate keyframes
- approve_scene: User is approving a specific scene
- approve_storyboard: User is approving the entire storyboard
- generate_videos: User wants to generate video clips
- regenerate_clip: User wants to regenerate a specific clip
- assemble: User wants to assemble final video
- export: User wants to export/download
- qcm_response: User is answering a multiple choice question (e.g., "option A", "the first one", "b")
- change_settings: User wants to change format, duration, language
- off_topic: Message is completely unrelated to UGC ad creation
- unclear: Cannot determine intent

Extract any relevant entities (product names, numbers, options selected, etc.)

Respond with JSON only:
{
  "intent": "the_intent",
  "confidence": 0.0-1.0,
  "entities": { ... },
  "requiresClarification": true/false,
  "clarificationQuestion": "if clarification needed"
}`;

  try {
    const llmOut = await replicate.run(CLAUDE_MODEL as `${string}/${string}`, {
      input: {
        prompt,
        max_tokens: 500,
        system_prompt: 'You are a JSON-only intent classifier. Output valid JSON only.',
      },
    });
    
    const result = safeJsonParse<IntentClassification>(chunkToString(llmOut));
    return result || {
      intent: 'unclear',
      confidence: 0.3,
      entities: {},
      requiresClarification: true,
      clarificationQuestion: "I'm not sure I understood. Could you tell me more about what you'd like to do?",
    };
  } catch (e) {
    console.error('[UGC Agent] classifyIntent failed:', e);
    return {
      intent: 'unclear',
      confidence: 0.1,
      entities: {},
      requiresClarification: true,
    };
  }
}

// -----------------------------------------------------------------------------
// Agent Core - Response Generation
// -----------------------------------------------------------------------------

async function generateAgentResponse(
  replicate: Replicate,
  userMessage: string,
  intent: IntentClassification,
  project: UgcProject | null,
  capabilities: ProjectCapabilities
): Promise<{ message: string; suggestedActions: string[] }> {
  const contextSummary = project ? `
Project: "${project.name}"
Brief: ${project.brief?.productName || 'Not set'} for ${project.brief?.targetAudience || 'Not set'}
Actors: ${project.actors.length} generated, ${project.selectedActorId ? 'one selected' : 'none selected'}
Storyboard: ${project.storyboard ? `${project.storyboard.scenes.length} scenes` : 'Not created'}
Clips: ${project.clips.filter(c => c.status === 'complete').length} ready
` : 'No project started yet';

  const prompt = `You are a friendly UGC ad creation assistant. Generate a helpful response.

USER SAID: "${userMessage}"
DETECTED INTENT: ${intent.intent} (confidence: ${intent.confidence})
ENTITIES: ${JSON.stringify(intent.entities)}

PROJECT STATE:
${contextSummary}

CAPABILITIES:
- Can generate actors: ${capabilities.canGenerateActors}
- Can generate storyboard: ${capabilities.canGenerateStoryboard}
- Can generate videos: ${capabilities.canGenerateVideos}
- Can assemble: ${capabilities.canAssemble}

RULES:
1. Be concise, friendly, and helpful (2-3 sentences max)
2. If something is missing, tell the user what's needed
3. Suggest natural next steps based on capabilities
4. Never assume a rigid flow - adapt to what the user wants
5. If the user asks something off-topic, briefly answer then guide back
6. Use casual language, occasional emoji is fine

Respond with JSON:
{
  "message": "Your response to the user",
  "suggestedActions": ["action1", "action2"]
}`;

  try {
    const llmOut = await replicate.run(CLAUDE_MODEL as `${string}/${string}`, {
      input: {
        prompt,
        max_tokens: 400,
        system_prompt: 'You are a JSON-only API. Output valid JSON only.',
      },
    });
    
    const result = safeJsonParse<{ message: string; suggestedActions: string[] }>(chunkToString(llmOut));
    return result || {
      message: "I'm here to help! What would you like to do with your UGC ad?",
      suggestedActions: [],
    };
  } catch (e) {
    console.error('[UGC Agent] generateAgentResponse failed:', e);
    return {
      message: "Let me help you create your UGC ad. What product or service would you like to promote?",
      suggestedActions: ['Tell me about your product'],
    };
  }
}

// -----------------------------------------------------------------------------
// Widget Builders
// -----------------------------------------------------------------------------

function buildIntakeWidget(project: UgcProject | null): WidgetBlock {
  return {
    id: generateId(),
    type: 'intake',
    data: {
      brief: project?.brief || {},
      settings: project?.settings || { aspectRatio: '9:16', targetDuration: 30, fps: 30, resolution: '1080p', language: 'en' },
    },
    timestamp: new Date(),
  };
}

function buildActorSelectionWidget(project: UgcProject): WidgetBlock {
  return {
    id: generateId(),
    type: 'actor_selection',
    data: {
      actors: project.actors,
      selectedActorId: project.selectedActorId,
      canRegenerate: true,
    },
    timestamp: new Date(),
  };
}

function buildStoryboardWidget(project: UgcProject): WidgetBlock {
  return {
    id: generateId(),
    type: 'storyboard',
    data: {
      storyboard: project.storyboard,
      isApproved: project.storyboard?.isApproved || false,
      totalDuration: project.storyboard?.totalDuration || 0,
      sceneCount: project.storyboard?.scenes.length || 0,
    },
    timestamp: new Date(),
  };
}

function buildQcmWidget(question: string, options: QcmOption[], allowMultiple = false): WidgetBlock {
  return {
    id: generateId(),
    type: 'qcm',
    data: {
      question,
      options,
      allowMultiple,
      required: true,
    },
    timestamp: new Date(),
  };
}

function buildClarificationWidget(questions: { id: string; question: string; options?: QcmOption[] }[]): WidgetBlock {
  return {
    id: generateId(),
    type: 'clarification',
    data: { questions },
    timestamp: new Date(),
  };
}

function buildGenerationQueueWidget(project: UgcProject): WidgetBlock {
  return {
    id: generateId(),
    type: 'generation_queue',
    data: {
      scenes: project.storyboard?.scenes || [],
      clips: project.clips,
    },
    timestamp: new Date(),
  };
}

function buildAssemblyWidget(project: UgcProject): WidgetBlock {
  return {
    id: generateId(),
    type: 'assembly',
    data: {
      clips: project.clips.filter(c => c.status === 'complete'),
      finalEdit: project.finalEdit,
      storyboard: project.storyboard,
    },
    timestamp: new Date(),
  };
}

function buildStatusWidget(status: string, progress?: number): WidgetBlock {
  return {
    id: generateId(),
    type: 'status',
    data: { status, progress },
    timestamp: new Date(),
  };
}

function buildErrorWidget(error: string, recoveryOptions: string[]): WidgetBlock {
  return {
    id: generateId(),
    type: 'error',
    data: { error, recoveryOptions },
    timestamp: new Date(),
  };
}

// -----------------------------------------------------------------------------
// Intent Handlers
// -----------------------------------------------------------------------------

async function handleEditBrief(
  replicate: Replicate,
  userMessage: string,
  intent: IntentClassification,
  project: UgcProject | null,
  userId: string
): Promise<{ project: UgcProject; response: AgentResponse }> {
  // Extract brief info from user message using LLM
  const extractPrompt = `Extract product/service information from this message:
"${userMessage}"

Return JSON with any fields you can extract:
{
  "productName": "name if mentioned",
  "productType": "physical/digital/service/app/course if clear",
  "productDescription": "description if provided",
  "targetAudience": "audience if mentioned",
  "brandTone": ["tones if mentioned"],
  "primaryGoal": "sales/leads/installs/awareness if mentioned",
  "offer": "offer/discount if mentioned",
  "cta": "call to action if mentioned",
  "keyClaims": ["claims if mentioned"],
  "platform": "tiktok/instagram/youtube if mentioned"
}

Only include fields that are clearly present. Use null for missing fields.`;

  const llmOut = await replicate.run(CLAUDE_MODEL as `${string}/${string}`, {
    input: { prompt: extractPrompt, max_tokens: 500, system_prompt: 'JSON only' },
  });
  
  const extracted = safeJsonParse<Partial<CreativeBrief>>(chunkToString(llmOut)) || {};
  
  // Create or update project
  let updatedProject: UgcProject;
  if (!project) {
    updatedProject = await createProject(userId, extracted.productName || 'New UGC Ad');
    await updateBrief(updatedProject.id, extracted);
    updatedProject = (await getProject(updatedProject.id))!;
  } else {
    await updateBrief(project.id, extracted);
    updatedProject = (await getProject(project.id))!;
  }
  
  const caps = deriveCapabilities(updatedProject);
  const blocks: WidgetBlock[] = [];
  
  // Check what's still missing
  const missing: string[] = [];
  if (!updatedProject.brief?.productName) missing.push('product name');
  if (!updatedProject.brief?.targetAudience) missing.push('target audience');
  if (!updatedProject.brief?.primaryGoal) missing.push('primary goal');
  
  let message: string;
  if (missing.length > 0) {
    message = `Got it! I still need: ${missing.join(', ')}. What else can you tell me?`;
    blocks.push(buildIntakeWidget(updatedProject));
  } else if (!caps.hasActors) {
    message = `Perfect! I have enough info to generate creator options. Want me to find some creators for this ad?`;
  } else {
    message = `Brief updated! Your project is ready for the next step.`;
  }
  
  return {
    project: updatedProject,
    response: {
      message,
      contextPatch: { brief: updatedProject.brief },
      blocks,
      capabilities: caps,
      suggestedActions: caps.canGenerateActors && !caps.hasActors
        ? ['Generate creator options']
        : [],
    },
  };
}

async function handleRequestActors(
  replicate: Replicate,
  project: UgcProject,
  userId: string
): Promise<{ project: UgcProject; response: AgentResponse; toolCalls: ToolCall[] }> {
  const caps = deriveCapabilities(project);
  
  if (!caps.canGenerateActors) {
    return {
      project,
      response: {
        message: "I need more info about your product and target audience before I can generate creator options. Could you tell me more?",
        blocks: [buildIntakeWidget(project)],
        capabilities: caps,
      },
      toolCalls: [],
    };
  }
  
  // Generate actor personas using LLM
  const prompt = `Generate 3 diverse UGC creator personas for this ad:
Product: ${project.brief?.productName} (${project.brief?.productType})
Target audience: ${project.brief?.targetAudience}
Brand tone: ${project.brief?.brandTone?.join(', ') || 'authentic'}
Goal: ${project.brief?.primaryGoal}

Return JSON array with 3 creators:
[{
  "id": "creator_1",
  "label": "The [Archetype]",
  "description": "Why they fit this brand",
  "personaTags": ["tag1", "tag2"],
  "demographics": {
    "ageRange": "25-35",
    "gender": "female/male/non-binary",
    "ethnicity": "contextual",
    "style": "casual/professional/trendy"
  },
  "imagePrompt": "Detailed prompt for a realistic UGC creator selfie portrait. Include: appearance, setting, lighting, pose, wardrobe. Must be adult 21+."
}]

Make them diverse but relevant. Each should have a distinct personality.`;

  const llmOut = await replicate.run(CLAUDE_MODEL as `${string}/${string}`, {
    input: { prompt, max_tokens: 1500, system_prompt: 'JSON array only' },
  });
  
  const personas = safeJsonParse<any[]>(chunkToString(llmOut)) || [];
  
  // Create actor options with pending image jobs
  const actors: ActorOption[] = [];
  const toolCalls: ToolCall[] = [];
  
  for (const persona of personas.slice(0, 3)) {
    const actorId = generateId();
    const imagePrompt = persona.imagePrompt || `Realistic UGC creator portrait, ${persona.demographics?.gender || 'person'}, ${persona.demographics?.ageRange || '25-35'}, natural selfie-style, authentic vibe. 21+ adult only.`;
    
    actors.push({
      id: actorId,
      label: persona.label || `Creator ${actors.length + 1}`,
      description: persona.description || '',
      personaTags: persona.personaTags || [],
      demographics: persona.demographics || { ageRange: '25-35', gender: 'female', style: 'casual' },
      imageStatus: 'pending',
      prompt: imagePrompt,
      createdAt: new Date(),
    });
    
    toolCalls.push({
      id: generateId(),
      tool: 'generate_actors',
      params: { actorId, prompt: imagePrompt },
      status: 'pending',
    });
  }
  
  await addActors(project.id, actors);
  const updatedProject = (await getProject(project.id))!;
  
  return {
    project: updatedProject,
    response: {
      message: `I'm generating 3 creator options for your ad. Pick the one that best represents your brand! 🎬`,
      blocks: [buildActorSelectionWidget(updatedProject)],
      capabilities: deriveCapabilities(updatedProject),
      toolCalls,
    },
    toolCalls,
  };
}

async function handleSelectActor(
  project: UgcProject,
  intent: IntentClassification
): Promise<{ project: UgcProject; response: AgentResponse }> {
  // Determine which actor was selected
  let selectedActorId: string | undefined;
  const entities = intent.entities;
  
  if (entities.actorId) {
    selectedActorId = entities.actorId;
  } else if (entities.optionNumber !== undefined) {
    const idx = parseInt(entities.optionNumber) - 1;
    if (idx >= 0 && idx < project.actors.length) {
      selectedActorId = project.actors[idx].id;
    }
  } else if (entities.optionLabel) {
    const actor = project.actors.find(a =>
      a.label.toLowerCase().includes(entities.optionLabel.toLowerCase())
    );
    selectedActorId = actor?.id;
  }
  
  if (!selectedActorId) {
    // Ask for clarification with QCM
    const options: QcmOption[] = project.actors.map((a, i) => ({
      id: a.id,
      label: a.label,
      description: a.description,
      value: a.id,
    }));
    
    return {
      project,
      response: {
        message: "Which creator would you like to use?",
        blocks: [buildQcmWidget('Select a creator:', options)],
        capabilities: deriveCapabilities(project),
      },
    };
  }
  
  await selectActor(project.id, selectedActorId);
  const updatedProject = (await getProject(project.id))!;
  const selectedActor = updatedProject.actors.find(a => a.id === selectedActorId);
  
  // Create style bible
  await createStyleBibleForProject(project.id, updatedProject);
  const finalProject = (await getProject(project.id))!;
  
  const caps = deriveCapabilities(finalProject);
  
  // Build clarification questions for direction lock
  const clarificationQuestions = [
    {
      id: 'filmingStyle',
      question: 'What filming style works best?',
      options: [
        { id: 'talking-head', label: 'Talking head', description: 'Creator speaks directly to camera', value: 'talking-head' },
        { id: 'product-demo', label: 'Product demo', description: 'Focus on showing the product', value: 'product-demo' },
        { id: 'lifestyle', label: 'Lifestyle', description: 'Show product in real-life context', value: 'lifestyle' },
        { id: 'mixed', label: 'Mixed', description: 'Combination of styles', value: 'mixed' },
      ],
    },
    {
      id: 'voiceMode',
      question: 'How should the audio work?',
      options: [
        { id: 'actor-speaks', label: 'Actor speaks', description: 'Creator delivers the script on camera', value: 'actor-speaks' },
        { id: 'voiceover', label: 'Voiceover', description: 'Separate voice narration over footage', value: 'voiceover' },
        { id: 'text-only', label: 'Text only', description: 'No spoken audio, text overlays only', value: 'text-only' },
      ],
    },
  ];
  
  return {
    project: finalProject,
    response: {
      message: `Great choice! ${selectedActor?.label} is locked in. Now let's nail down the creative direction. 🎯`,
      blocks: [buildClarificationWidget(clarificationQuestions)],
      capabilities: caps,
      suggestedActions: ['Set direction', 'Generate storyboard'],
    },
  };
}

async function handleGenerateStoryboard(
  replicate: Replicate,
  project: UgcProject
): Promise<{ project: UgcProject; response: AgentResponse; toolCalls: ToolCall[] }> {
  const caps = deriveCapabilities(project);
  
  if (!caps.hasSelectedActor) {
    return {
      project,
      response: {
        message: "Please select a creator first before we generate the storyboard.",
        blocks: project.actors.length > 0 ? [buildActorSelectionWidget(project)] : [],
        capabilities: caps,
      },
      toolCalls: [],
    };
  }
  
  const selectedActor = project.actors.find(a => a.id === project.selectedActorId);
  const brief = project.brief!;
  
  // Generate script and storyboard
  const prompt = `Create a ${project.settings.targetDuration}-second UGC ad storyboard:

PRODUCT: ${brief.productName} (${brief.productType})
AUDIENCE: ${brief.targetAudience}
GOAL: ${brief.primaryGoal}
OFFER: ${brief.offer || 'Check it out'}
CTA: ${brief.cta}
CLAIMS: ${brief.keyClaims?.join(', ') || 'none specified'}

CREATOR: ${selectedActor?.label} - ${selectedActor?.description}

DIRECTION:
- Filming style: ${project.directionLock?.filmingStyle || 'talking-head'}
- Voice: ${project.directionLock?.voiceMode || 'actor-speaks'}
- Subtitles: ${project.directionLock?.subtitlesEnabled ? 'yes' : 'no'}

Return JSON with 4-6 scenes:
{
  "scenes": [{
    "id": "scene_1",
    "order": 0,
    "beatType": "hook/problem/solution/proof/demo/cta",
    "objective": "What this scene achieves",
    "duration": 3-8,
    "script": "What the creator says",
    "voiceover": "If different from script",
    "onScreenText": "Text overlay",
    "actionNotes": "What happens visually",
    "shotType": "close-up/medium/wide",
    "cameraDescription": "Camera movement",
    "veoPrompt": "Detailed video generation prompt",
    "firstKeyframePrompt": "Prompt for opening frame",
    "lastKeyframePrompt": "Prompt for ending frame"
  }],
  "totalDuration": sum of durations,
  "hookStrategy": "How the hook grabs attention"
}

RULES:
- Hook must grab attention in first 3 seconds
- Include problem → solution arc
- End with clear CTA
- Each scene should flow naturally to next`;

  const llmOut = await replicate.run(CLAUDE_MODEL as `${string}/${string}`, {
    input: { prompt, max_tokens: 2500, system_prompt: 'JSON only' },
  });
  
  const storyboardData = safeJsonParse<any>(chunkToString(llmOut));
  if (!storyboardData?.scenes) {
    return {
      project,
      response: {
        message: "I had trouble generating the storyboard. Let me try again...",
        blocks: [buildErrorWidget('Storyboard generation failed', ['Try again', 'Adjust brief'])],
        capabilities: caps,
      },
      toolCalls: [],
    };
  }
  
  // Create scenes with keyframe placeholders
  const scenes: Omit<Scene, 'createdAt' | 'updatedAt'>[] = storyboardData.scenes.map((s: any, i: number) => ({
    id: s.id || `scene_${i + 1}`,
    order: i,
    version: 1,
    beatType: s.beatType || 'hook',
    objective: s.objective || '',
    duration: s.duration || 5,
    script: s.script || '',
    voiceover: s.voiceover,
    onScreenText: s.onScreenText,
    actionNotes: s.actionNotes || '',
    shotType: s.shotType || 'medium',
    cameraDescription: s.cameraDescription,
    veoPrompt: s.veoPrompt,
    keyframes: [
      { id: `${s.id}_kf_first`, position: 'first' as const, status: 'pending' as const, prompt: s.firstKeyframePrompt || s.veoPrompt },
      { id: `${s.id}_kf_last`, position: 'last' as const, status: 'pending' as const, prompt: s.lastKeyframePrompt || s.veoPrompt },
    ],
    isApproved: false,
  }));
  
  await createStoryboard(project.id, scenes);
  const updatedProject = (await getProject(project.id))!;
  
  // Queue keyframe generation
  const toolCalls: ToolCall[] = scenes.flatMap(s =>
    s.keyframes.map(kf => ({
      id: generateId(),
      tool: 'generate_keyframes' as const,
      params: { sceneId: s.id, keyframeId: kf.id, prompt: kf.prompt },
      status: 'pending' as const,
    }))
  );
  
  return {
    project: updatedProject,
    response: {
      message: `Storyboard ready! ${scenes.length} scenes, ${storyboardData.totalDuration}s total. I'm generating keyframes now - review and approve when ready. 🎬`,
      blocks: [buildStoryboardWidget(updatedProject)],
      capabilities: deriveCapabilities(updatedProject),
      toolCalls,
      suggestedActions: ['Review scenes', 'Edit a scene', 'Approve storyboard'],
    },
    toolCalls,
  };
}

async function handleApproveStoryboard(
  project: UgcProject
): Promise<{ project: UgcProject; response: AgentResponse }> {
  if (!project.storyboard) {
    return {
      project,
      response: {
        message: "No storyboard to approve yet. Let me generate one first?",
        capabilities: deriveCapabilities(project),
      },
    };
  }
  
  // Check validation
  const unapprovedScenes = project.storyboard.scenes.filter(s => !s.isApproved);
  if (unapprovedScenes.length > 0) {
    return {
      project,
      response: {
        message: `${unapprovedScenes.length} scene(s) still need approval. Review them first?`,
        blocks: [buildStoryboardWidget(project)],
        capabilities: deriveCapabilities(project),
      },
    };
  }
  
  await approveStoryboard(project.id);
  const updatedProject = (await getProject(project.id))!;
  const caps = deriveCapabilities(updatedProject);
  
  return {
    project: updatedProject,
    response: {
      message: `Storyboard approved and locked! 🔒 Ready to generate video clips?`,
      blocks: [
        { id: generateId(), type: 'approval_gate', data: { approved: true, storyboardVersion: updatedProject.storyboardVersion }, timestamp: new Date() },
      ],
      capabilities: caps,
      suggestedActions: caps.canGenerateVideos ? ['Generate video clips'] : ['Complete keyframes first'],
    },
  };
}

async function handleGenerateVideos(
  project: UgcProject
): Promise<{ project: UgcProject; response: AgentResponse; toolCalls: ToolCall[] }> {
  const caps = deriveCapabilities(project);
  
  if (!caps.canGenerateVideos) {
    let missing = [];
    if (!caps.isStoryboardApproved) missing.push('approve the storyboard');
    if (!caps.hasAllKeyframes) missing.push('generate all keyframes');
    
    return {
      project,
      response: {
        message: `Before generating videos, please ${missing.join(' and ')}.`,
        blocks: [buildStoryboardWidget(project)],
        capabilities: caps,
      },
      toolCalls: [],
    };
  }
  
  // Queue video generation for each scene
  const toolCalls: ToolCall[] = project.storyboard!.scenes.map(scene => ({
    id: generateId(),
    tool: 'generate_video' as const,
    params: {
      sceneId: scene.id,
      prompt: scene.veoPrompt,
      duration: scene.duration,
      keyframes: scene.keyframes.filter(k => k.status === 'complete'),
    },
    status: 'pending' as const,
  }));
  
  return {
    project,
    response: {
      message: `Starting video generation for ${project.storyboard!.scenes.length} scenes. This usually takes 1-2 minutes per scene... ⏳`,
      blocks: [buildGenerationQueueWidget(project)],
      capabilities: caps,
      toolCalls,
    },
    toolCalls,
  };
}

async function handleAssemble(
  project: UgcProject
): Promise<{ project: UgcProject; response: AgentResponse; toolCalls: ToolCall[] }> {
  const caps = deriveCapabilities(project);
  
  if (!caps.canAssemble) {
    return {
      project,
      response: {
        message: "Some video clips aren't ready yet. Please wait for all clips to finish generating.",
        blocks: [buildGenerationQueueWidget(project)],
        capabilities: caps,
      },
      toolCalls: [],
    };
  }
  
  const toolCalls: ToolCall[] = [{
    id: generateId(),
    tool: 'assemble' as const,
    params: {
      clips: project.clips.filter(c => c.status === 'complete'),
      storyboard: project.storyboard,
      settings: project.settings,
    },
    status: 'pending' as const,
  }];
  
  return {
    project,
    response: {
      message: "Assembling your final video! Adding transitions, subtitles, and final touches... 🎬",
      blocks: [buildAssemblyWidget(project)],
      capabilities: caps,
      toolCalls,
    },
    toolCalls,
  };
}

async function handleQcmResponse(
  project: UgcProject | null,
  intent: IntentClassification
): Promise<{ project: UgcProject | null; response: AgentResponse }> {
  // Handle QCM responses - the entities should contain the selection
  const selected = intent.entities?.selected || intent.entities?.optionId;
  
  if (!selected) {
    return {
      project,
      response: {
        message: "I didn't catch your selection. Could you choose from the options?",
        capabilities: deriveCapabilities(project),
      },
    };
  }
  
  // The actual handling depends on what QCM was pending
  // For now, acknowledge and suggest next step
  return {
    project,
    response: {
      message: `Got it! You selected: ${selected}. What would you like to do next?`,
      capabilities: deriveCapabilities(project),
    },
  };
}

// -----------------------------------------------------------------------------
// Main Handler
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userMessage,
      userId,
      projectId,
      conversationHistory = [],
    } = body;

    if (!userId) {
      return Response.json({ error: 'Missing userId' }, { status: 401 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return Response.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });
    }

    const replicate = new Replicate({ auth: token });
    
    // Get or create project
    let project = projectId ? await getProject(projectId) : null;
    let capabilities = deriveCapabilities(project);
    
    // Build conversation context
    const recentContext = conversationHistory
      .slice(-5)
      .map((m: any) => `${m.role}: ${m.content}`)
      .join('\n');
    
    // Classify intent
    const intent = await classifyIntent(replicate, userMessage, capabilities, recentContext);
    
    // Handle based on intent
    let response: AgentResponse;
    let toolCalls: ToolCall[] = [];
    
    switch (intent.intent) {
      case 'greeting':
      case 'create_project': {
        if (!project) {
          project = await createProject(userId, 'New UGC Ad');
        }
        const { message, suggestedActions } = await generateAgentResponse(
          replicate, userMessage, intent, project, capabilities
        );
        response = {
          message: message || "Hey! 👋 I'm your UGC ad creator. Tell me about the product or service you want to promote!",
          blocks: [buildIntakeWidget(project)],
          capabilities: deriveCapabilities(project),
          suggestedActions,
        };
        break;
      }
      
      case 'edit_brief': {
        const result = await handleEditBrief(replicate, userMessage, intent, project, userId);
        project = result.project;
        response = result.response;
        break;
      }
      
      case 'request_actors': {
        if (!project) {
          project = await createProject(userId, 'New UGC Ad');
        }
        const result = await handleRequestActors(replicate, project, userId);
        project = result.project;
        response = result.response;
        toolCalls = result.toolCalls;
        break;
      }
      
      case 'select_actor': {
        if (!project || project.actors.length === 0) {
          response = {
            message: "No creators to select yet. Let me generate some options first?",
            capabilities,
            suggestedActions: ['Generate creator options'],
          };
        } else {
          const result = await handleSelectActor(project, intent);
          project = result.project;
          response = result.response;
        }
        break;
      }
      
      case 'generate_storyboard': {
        if (!project) {
          response = {
            message: "Let's set up the basics first. What product are you promoting?",
            blocks: [buildIntakeWidget(null)],
            capabilities,
          };
        } else {
          const result = await handleGenerateStoryboard(replicate, project);
          project = result.project;
          response = result.response;
          toolCalls = result.toolCalls;
        }
        break;
      }
      
      case 'approve_storyboard': {
        if (!project) {
          response = { message: "No project to approve.", capabilities };
        } else {
          const result = await handleApproveStoryboard(project);
          project = result.project;
          response = result.response;
        }
        break;
      }
      
      case 'generate_videos': {
        if (!project) {
          response = { message: "No project yet. Let's start with your product info.", capabilities };
        } else {
          const result = await handleGenerateVideos(project);
          project = result.project;
          response = result.response;
          toolCalls = result.toolCalls;
        }
        break;
      }
      
      case 'assemble': {
        if (!project) {
          response = { message: "No project to assemble.", capabilities };
        } else {
          const result = await handleAssemble(project);
          project = result.project;
          response = result.response;
          toolCalls = result.toolCalls;
        }
        break;
      }
      
      case 'qcm_response': {
        const result = await handleQcmResponse(project, intent);
        project = result.project;
        response = result.response;
        break;
      }
      
      case 'ask_question':
      case 'off_topic':
      case 'unclear':
      default: {
        const { message, suggestedActions } = await generateAgentResponse(
          replicate, userMessage, intent, project, capabilities
        );
        response = {
          message,
          capabilities: deriveCapabilities(project),
          suggestedActions,
        };
        
        // If unclear, add clarification
        if (intent.requiresClarification && intent.clarificationQuestion) {
          response.message = intent.clarificationQuestion;
        }
      }
    }
    
    // Add out-of-date warnings if applicable
    if (project) {
      const warnings = checkOutOfDate(project);
      if (warnings.length > 0) {
        response.message += `\n\n⚠️ ${warnings[0].reason}`;
      }
    }
    
    // Always include project ID and updated capabilities
    return Response.json({
      ...response,
      projectId: project?.id,
      capabilities: deriveCapabilities(project),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    });

  } catch (error: any) {
    console.error('[UGC Agent] Error:', error);
    return Response.json({
      error: error?.message || 'Unknown error',
      message: "Oops, something went wrong. Let's try that again! 🔄",
    }, { status: 500 });
  }
}
