import type { AssistantPlan, AssistantPlanMessage, AssistantMedia, AssistantPlanStep, AssistantToolKind, AssistantPlanField } from '@/types/assistant';

type ToolModel = {
  id: string;
  label: string;
  defaultInputs?: Record<string, any>;
};

type ToolSpec = {
  id: AssistantToolKind;
  label: string;
  description: string;
  outputType: AssistantPlanStep['outputType'];
  fields: AssistantPlanField[];
  models: ToolModel[];
  validations?: string[];
};

export const TOOL_SPECS: Record<AssistantToolKind, ToolSpec> = {
  image: {
    id: 'image',
    label: 'Image Generation',
    description: 'Create or edit still imagery.',
    outputType: 'image',
    validations: ['GPT Image 1.5 supports up to 10 references.', 'Use quoted text for typography fidelity.'],
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, helper: 'What should the image contain? Include style + lighting.' },
      { key: 'negative_prompt', label: 'Negative prompt', type: 'text', required: false },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'text', required: false, helper: 'e.g., 1:1, 16:9, 9:16' },
      { key: 'input_images', label: 'Reference images (comma separated URLs)', type: 'text', required: false },
      { key: 'number_of_images', label: 'Output count', type: 'number', required: false, min: 1, max: 10 },
      { key: 'input_fidelity', label: 'Input fidelity', type: 'text', required: false, helper: 'low, medium, high for GPT Image 1.5' },
    ],
    models: [
      { id: 'openai/gpt-image-1.5', label: 'GPT Image 1.5', defaultInputs: { number_of_images: 1, aspect_ratio: '1:1' } },
      { id: 'black-forest-labs/flux-kontext-max', label: 'Flux Kontext Max', defaultInputs: { aspect_ratio: '16:9' } },
      { id: 'black-forest-labs/flux-krea-dev', label: 'Flux Krea Dev', defaultInputs: { aspect_ratio: '1:1' } },
      { id: 'google/nano-banana', label: 'Nano Banana', defaultInputs: { output_format: 'jpg' } },
      { id: 'google/nano-banana-pro', label: 'Nano Banana Pro', defaultInputs: { output_format: 'png' } },
    ],
  },
  video: {
    id: 'video',
    label: 'Video Generation',
    description: 'Animate or render motion from text or start frames.',
    outputType: 'video',
    validations: ['Kling v2.1 requires start_image.', 'Kling duration must be provided (short clips recommended).'],
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, helper: 'Shot description, camera moves, pacing.' },
      { key: 'negative_prompt', label: 'Negative prompt', type: 'text', required: false },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'text', required: false, helper: '16:9, 9:16, 1:1...' },
      { key: 'duration', label: 'Duration (s)', type: 'number', required: false, min: 2, max: 12 },
      { key: 'start_image', label: 'Start image URL', type: 'url', required: false, helper: 'Required for Kling v2.1' },
      { key: 'end_image', label: 'End image URL', type: 'url', required: false },
    ],
    models: [
      { id: 'google/veo-3.1-fast', label: 'VEO 3.1 Fast', defaultInputs: { resolution: '720p' } },
      { id: 'google/veo-3-fast', label: 'VEO 3 Fast', defaultInputs: { resolution: '720p' } },
      { id: 'google/veo-3.1', label: 'VEO 3.1', defaultInputs: { resolution: '1080p' } },
      { id: 'openai/sora-2', label: 'Sora 2', defaultInputs: { resolution: '720p' } },
      { id: 'openai/sora-2-pro', label: 'Sora 2 Pro', defaultInputs: { resolution: '1080p' } },
      { id: 'kwaivgi/kling-v2.5-turbo-pro', label: 'Kling v2.5 Turbo Pro', defaultInputs: { duration: 5, aspect_ratio: '16:9' } },
      { id: 'kwaivgi/kling-v2.1', label: 'Kling v2.1', defaultInputs: { duration: 4, aspect_ratio: '16:9', mode: 'default' } },
      { id: 'wan-video/wan-2.2-i2v-fast', label: 'WAN 2.2 i2v Fast', defaultInputs: { aspect_ratio: '16:9' } },
      { id: 'bytedance/seedance-1-lite', label: 'Seedance 1 Lite', defaultInputs: { aspect_ratio: '16:9' } },
    ],
  },
  lipsync: {
    id: 'lipsync',
    label: 'Lip Sync',
    description: 'Match audio to mouth movements.',
    outputType: 'video',
    fields: [
      { key: 'video', label: 'Video URL', type: 'url', required: true },
      { key: 'audio', label: 'Audio URL', type: 'url', required: true },
      { key: 'backend', label: 'Backend', type: 'select', options: [
        { value: 'sievesync-1.1', label: 'Sieve Sync 1.1' },
        { value: 'latentsync', label: 'LatentSync' },
      ], required: true },
    ],
    models: [
      { id: 'sievesync-1.1', label: 'Sieve Sync 1.1' },
      { id: 'bytedance/latentsync', label: 'LatentSync' },
    ],
  },
  background_remove: {
    id: 'background_remove',
    label: 'Background Remove',
    description: 'Remove backgrounds from videos.',
    outputType: 'video',
    fields: [
      { key: 'video_url', label: 'Video URL', type: 'url', required: true },
    ],
    models: [{ id: 'background-remover', label: 'Background Remover' }],
  },
  enhance: {
    id: 'enhance',
    label: 'Enhance',
    description: 'Upscale or polish still images.',
    outputType: 'image',
    fields: [
      { key: 'image', label: 'Image URL', type: 'url', required: true },
      { key: 'upscale_factor', label: 'Upscale factor', type: 'text', required: false, helper: '2x / 4x / 6x' },
      { key: 'face_enhancement', label: 'Face enhancement (true/false)', type: 'text', required: false },
    ],
    models: [{ id: 'topazlabs/image-upscale', label: 'Topaz Upscale' }],
  },
  transcription: {
    id: 'transcription',
    label: 'Transcription',
    description: 'Convert speech to text.',
    outputType: 'text',
    fields: [
      { key: 'audio_file', label: 'Audio URL', type: 'url', required: true },
      { key: 'language', label: 'Language', type: 'text', required: false },
    ],
    models: [{ id: 'openai/gpt-4o-transcribe', label: 'GPT-4o Transcribe' }],
  },
  tts: {
    id: 'tts',
    label: 'Text to Speech',
    description: 'Synthesize speech from scripts.',
    outputType: 'audio',
    fields: [
      { key: 'text', label: 'Text', type: 'textarea', required: true },
      { key: 'voice_id', label: 'Voice ID', type: 'text', required: false },
    ],
    models: [
      { id: 'minimax-speech-02-hd', label: 'Minimax Speech 02 HD' },
      { id: 'elevenlabs-tts', label: 'ElevenLabs TTS' },
      { id: 'dia-tts', label: 'Dia TTS' },
    ],
  },
};

function fieldsForTool(tool: AssistantToolKind): AssistantPlanField[] {
  return TOOL_SPECS[tool]?.fields || [];
}

export function buildPlannerSystemPrompt(): string {
  const toolSections = Object.values(TOOL_SPECS)
    .map((tool) => {
      const models = tool.models.map((m) => `- ${m.label} (${m.id})`).join('\n');
      const fieldLines = tool.fields.map((f) => `- ${f.key}${f.required ? ' (required)' : ''}${f.helper ? ` — ${f.helper}` : ''}`).join('\n');
      const validation = tool.validations?.map((v) => `- ${v}`).join('\n') || '';
      return [
        `${tool.label}: ${tool.description}`,
        'Models:',
        models,
        'Inputs:',
        fieldLines,
        validation ? 'Constraints:\n' + validation : '',
      ].join('\n');
    })
    .join('\n\n');

  const constraints = [
    'GPT Image 1.5: up to 10 reference images. Requires prompt. input_fidelity low/medium/high.',
    'Flux/Nano models accept aspect_ratio and optional input_image.',
    'Video: Kling v2.1 requires start_image and mode; Kling duration is required; WAN animate-replace requires video + character_image.',
    'Background remove only accepts video_url.',
    'TTS requires text; Transcription requires audio_file.',
  ].join('\n');

  const outputFormat = `Return JSON only:
{
  "summary": "1-2 sentence plan",
  "steps": [
    {
      "id": "step-1",
      "title": "Describe action",
      "tool": "image|video|lipsync|background_remove|enhance|transcription|tts",
      "model": "model id",
      "modelOptions": ["optional", "..."],
      "inputs": { "prompt": "", "...": "" },
      "outputType": "image|video|audio|text",
      "dependencies": ["step-0"],
      "validations": ["list constraints"]
    }
  ]
}`;

  return [
    'You are an expert planner for a creative assistant. Choose the minimal set of steps and map each step to an available tool/model.',
    'Respect required params and constraints. Include dependencies when a step uses a previous output.',
    'Always include defaults for durations, aspect_ratio, and start_image when Kling v2.1 is selected.',
    'Prefer short runtimes by default (<=8s video).',
    '',
    'Available tools and models:',
    toolSections,
    '',
    'Constraints:',
    constraints,
    '',
    outputFormat,
  ].join('\n');
}

function coerceString(val: unknown): string {
  return typeof val === 'string' ? val : '';
}

function normalizeInputs(step: AssistantPlanStep): AssistantPlanStep {
  const spec = TOOL_SPECS[step.tool];
  const defaults = spec?.models.find((m) => m.id === step.model)?.defaultInputs || {};
  return {
    ...step,
    inputs: { ...defaults, ...step.inputs },
    modelOptions: step.modelOptions?.length ? step.modelOptions : spec?.models.map((m) => m.id) || [],
    fields: step.fields && step.fields.length ? step.fields : fieldsForTool(step.tool),
    outputType: step.outputType || spec?.outputType,
    validations: step.validations || spec?.validations || [],
  };
}

export function fallbackPlanFromMessages(messages: AssistantPlanMessage[], media: AssistantMedia[]): AssistantPlan {
  const lastUser = messages.slice().reverse().find((m) => m.role === 'user');
  const hasVideo = media.some((m) => m.type === 'video');
  const hasImage = media.some((m) => m.type === 'image');
  const summary = lastUser ? `Plan based on: ${lastUser.content.slice(0, 140)}` : 'Auto-generated assistant workflow';

  const steps: AssistantPlanStep[] = [];
  const baseImage: AssistantPlanStep = normalizeInputs({
    id: 'step-image',
    title: 'Generate key visual',
    tool: 'image',
    model: 'openai/gpt-image-1.5',
    inputs: {
      prompt: lastUser?.content || 'Hero shot of the product in good lighting',
      aspect_ratio: '16:9',
      number_of_images: 1,
    },
    suggestedParams: {},
  });
  steps.push(baseImage);

  const wantsVideo = hasVideo || /video|animate|motion|clip|kling|sora|veo/i.test(lastUser?.content || '');
  if (wantsVideo) {
    steps.push(
      normalizeInputs({
        id: 'step-video',
        title: 'Animate to video',
        tool: 'video',
        model: 'kwaivgi/kling-v2.5-turbo-pro',
        inputs: {
          prompt: lastUser?.content || 'Animate the hero shot with gentle camera push',
          start_image: hasImage ? media.find((m) => m.type === 'image')?.url : `{{steps.${baseImage.id}.output}}`,
          aspect_ratio: '16:9',
          duration: 5,
        },
        dependencies: [baseImage.id],
        suggestedParams: {},
      }),
    );
  }

  return {
    summary,
    steps,
  };
}

export function normalizePlannerOutput(raw: any, messages: AssistantPlanMessage[], media: AssistantMedia[]): AssistantPlan {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.steps)) {
    return fallbackPlanFromMessages(messages, media);
  }
  const steps = (raw.steps as AssistantPlanStep[]).map((s, idx) =>
    normalizeInputs({
      id: s.id || `step-${idx + 1}`,
      title: s.title || `Step ${idx + 1}`,
      description: s.description || '',
      tool: (s.tool as AssistantToolKind) || 'image',
      model: coerceString(s.model) || TOOL_SPECS.image.models[0].id,
      modelOptions: s.modelOptions,
      inputs: s.inputs || {},
      suggestedParams: s.suggestedParams || {},
      fields: s.fields,
      outputType: s.outputType,
      dependencies: s.dependencies || [],
      validations: s.validations,
    }),
  );
  return {
    summary: typeof raw.summary === 'string' ? raw.summary : 'Generated workflow',
    steps,
  };
}
