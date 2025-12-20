import type {
  AssistantPlan,
  AssistantPlanMessage,
  AssistantMedia,
  AssistantPlanStep,
  AssistantToolKind,
  AssistantPlanField,
} from '@/types/assistant';

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

type ModelFieldConfig = {
  model: string;
  fields: AssistantPlanField[];
  defaults?: Record<string, any>;
};

const IMAGE_RATIOS_GPT15 = ['1:1', '3:2', '2:3'] as const;
const IMAGE_RATIOS_FLUX = ['match_input_image', '16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9', '9:21', '2:1', '1:2'] as const;
const IMAGE_RATIOS_SIMPLE = ['1:1', '16:9', '9:16'] as const;
const VIDEO_RATIOS = ['16:9', '9:16', '1:1'] as const;
const VIDEO_DURATIONS_SHORT = [4, 5, 6] as const;
const VIDEO_DURATIONS_KLING = [4, 6, 8] as const;

const MODEL_FIELDS: ModelFieldConfig[] = [
  {
    model: 'openai/gpt-image-1.5',
    defaults: {
      number_of_images: 1,
      aspect_ratio: '1:1',
      output_format: 'webp',
      input_fidelity: 'medium',
      quality: 'high',
      background: 'auto',
      moderation: 'low',
    },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'select', options: IMAGE_RATIOS_GPT15.map((r) => ({ value: r, label: r })), required: true },
      { key: 'input_images', label: 'Reference images (comma URLs)', type: 'text', helper: 'Up to 10 references' },
      { key: 'number_of_images', label: 'Outputs', type: 'number', min: 1, max: 10 },
      { key: 'input_fidelity', label: 'Input fidelity', type: 'select', options: ['low', 'medium', 'high'].map((v) => ({ value: v, label: v })) },
      { key: 'output_format', label: 'Format', type: 'select', options: ['webp', 'jpeg', 'png'].map((v) => ({ value: v, label: v.toUpperCase() })) },
      { key: 'quality', label: 'Quality', type: 'select', options: ['auto', 'low', 'medium', 'high'].map((v) => ({ value: v, label: v })) },
      { key: 'background', label: 'Background', type: 'select', options: ['auto', 'transparent', 'opaque'].map((v) => ({ value: v, label: v })) },
      { key: 'moderation', label: 'Moderation', type: 'select', options: [{ value: 'auto', label: 'Standard' }, { value: 'low', label: 'Lenient' }], helper: 'Use lenient to reduce sensitivity flags' },
    ],
  },
  {
    model: 'black-forest-labs/flux-kontext-max',
    defaults: { aspect_ratio: '16:9', output_format: 'png' },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'select', options: IMAGE_RATIOS_FLUX.map((r) => ({ value: r, label: r })) },
      { key: 'input_image', label: 'Start image URL', type: 'url' },
      { key: 'output_format', label: 'Format', type: 'select', options: ['png', 'jpg'].map((v) => ({ value: v, label: v.toUpperCase() })) },
      { key: 'seed', label: 'Seed', type: 'number' },
    ],
  },
  {
    model: 'black-forest-labs/flux-krea-dev',
    defaults: { aspect_ratio: '1:1', output_format: 'webp' },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'select', options: IMAGE_RATIOS_FLUX.map((r) => ({ value: r, label: r })) },
      { key: 'output_format', label: 'Format', type: 'select', options: ['webp', 'jpg', 'png'].map((v) => ({ value: v, label: v.toUpperCase() })) },
      { key: 'guidance', label: 'Guidance', type: 'number' },
      { key: 'num_outputs', label: 'Outputs', type: 'number', min: 1, max: 4 },
      { key: 'output_quality', label: 'Quality (0-100)', type: 'number', min: 0, max: 100 },
      { key: 'image_input', label: 'Start image URL', type: 'url' },
    ],
  },
  {
    model: 'google/nano-banana',
    defaults: { output_format: 'jpg' },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'output_format', label: 'Format', type: 'select', options: ['jpg', 'png'].map((v) => ({ value: v, label: v.toUpperCase() })) },
      { key: 'image_input', label: 'Reference images (comma URLs)', type: 'text' },
    ],
  },
  {
    model: 'google/nano-banana-pro',
    defaults: { output_format: 'png' },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'output_format', label: 'Format', type: 'select', options: ['png', 'jpg'].map((v) => ({ value: v, label: v.toUpperCase() })) },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'select', options: IMAGE_RATIOS_SIMPLE.map((r) => ({ value: r, label: r })) },
      { key: 'image_input', label: 'Reference images (comma URLs)', type: 'text' },
    ],
  },
  {
    model: 'google/veo-3-fast',
    defaults: { resolution: '720p' },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'resolution', label: 'Resolution', type: 'select', options: ['720p', '1080p'].map((r) => ({ value: r, label: r })) },
      { key: 'image', label: 'Start image URL', type: 'url' },
      { key: 'negative_prompt', label: 'Negative prompt', type: 'text' },
      { key: 'seed', label: 'Seed', type: 'number' },
    ],
  },
  {
    model: 'google/veo-3',
    defaults: { resolution: '720p' },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'resolution', label: 'Resolution', type: 'select', options: ['720p', '1080p'].map((r) => ({ value: r, label: r })) },
      { key: 'image', label: 'Start image URL', type: 'url' },
      { key: 'negative_prompt', label: 'Negative prompt', type: 'text' },
      { key: 'seed', label: 'Seed', type: 'number' },
    ],
  },
  {
    model: 'google/veo-3.1',
    defaults: { resolution: '1080p' },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'resolution', label: 'Resolution', type: 'select', options: ['720p', '1080p'].map((r) => ({ value: r, label: r })) },
      { key: 'image', label: 'Start image URL', type: 'url' },
      { key: 'negative_prompt', label: 'Negative prompt', type: 'text' },
      { key: 'seed', label: 'Seed', type: 'number' },
    ],
  },
  {
    model: 'google/veo-3.1-fast',
    defaults: { resolution: '720p' },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'resolution', label: 'Resolution', type: 'select', options: ['720p', '1080p'].map((r) => ({ value: r, label: r })) },
      { key: 'image', label: 'Start image URL', type: 'url' },
      { key: 'negative_prompt', label: 'Negative prompt', type: 'text' },
      { key: 'seed', label: 'Seed', type: 'number' },
    ],
  },
  {
    model: 'openai/sora-2',
    defaults: { resolution: '720p' },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'resolution', label: 'Resolution', type: 'select', options: ['720p', '1080p'].map((r) => ({ value: r, label: r })) },
      { key: 'negative_prompt', label: 'Negative prompt', type: 'text' },
      { key: 'seed', label: 'Seed', type: 'number' },
    ],
  },
  {
    model: 'openai/sora-2-pro',
    defaults: { resolution: '1080p' },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'resolution', label: 'Resolution', type: 'select', options: ['720p', '1080p'].map((r) => ({ value: r, label: r })) },
      { key: 'negative_prompt', label: 'Negative prompt', type: 'text' },
      { key: 'seed', label: 'Seed', type: 'number' },
    ],
  },
  {
    model: 'kwaivgi/kling-v2.5-turbo-pro',
    defaults: { duration: 5, aspect_ratio: '16:9' },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'start_image', label: 'Start image URL', type: 'url' },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'select', options: VIDEO_RATIOS.map((r) => ({ value: r, label: r })) },
      { key: 'duration', label: 'Duration (s)', type: 'select', options: VIDEO_DURATIONS_SHORT.map((d) => ({ value: String(d), label: `${d}s` })) },
    ],
  },
  {
    model: 'kwaivgi/kling-v2.1',
    defaults: { duration: 4, aspect_ratio: '16:9', mode: 'default' },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'start_image', label: 'Start image URL (required)', type: 'url', required: true },
      { key: 'end_image', label: 'End image URL', type: 'url' },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'select', options: VIDEO_RATIOS.map((r) => ({ value: r, label: r })) },
      { key: 'duration', label: 'Duration (s)', type: 'select', options: VIDEO_DURATIONS_KLING.map((d) => ({ value: String(d), label: `${d}s` })) },
      { key: 'mode', label: 'Mode', type: 'select', options: ['default', 'video2video', 'photo2video'].map((m) => ({ value: m, label: m })) },
    ],
  },
  {
    model: 'wan-video/wan-2.2-i2v-fast',
    defaults: { aspect_ratio: '16:9', duration: 5 },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'start_image', label: 'Start image URL (required)', type: 'url', required: true },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'select', options: VIDEO_RATIOS.map((r) => ({ value: r, label: r })) },
      { key: 'duration', label: 'Duration (s)', type: 'number', min: 2, max: 8 },
    ],
  },
  {
    model: 'bytedance/seedance-1-lite',
    defaults: { aspect_ratio: '16:9' },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'start_image', label: 'Start image URL', type: 'url' },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'select', options: VIDEO_RATIOS.map((r) => ({ value: r, label: r })) },
    ],
  },
  {
    model: 'bytedance/seedance-1-pro',
    defaults: { aspect_ratio: '16:9' },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'start_image', label: 'Start image URL', type: 'url' },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'select', options: VIDEO_RATIOS.map((r) => ({ value: r, label: r })) },
    ],
  },
  {
    model: 'minimax-speech-02-hd',
    fields: [
      { key: 'text', label: 'Text', type: 'textarea', required: true },
      { key: 'voice_id', label: 'Voice ID', type: 'text' },
    ],
  },
  {
    model: 'elevenlabs-tts',
    fields: [
      { key: 'text', label: 'Text', type: 'textarea', required: true },
      { key: 'voice_id', label: 'Voice ID', type: 'text' },
    ],
  },
  {
    model: 'dia-tts',
    fields: [
      { key: 'text', label: 'Text', type: 'textarea', required: true },
      { key: 'voice_id', label: 'Voice ID', type: 'text' },
    ],
  },
];

export const TOOL_SPECS: Record<AssistantToolKind, ToolSpec> = {
  image: {
    id: 'image',
    label: 'Image Generation',
    description: 'Create or edit still imagery.',
    outputType: 'image',
    validations: ['GPT Image 1.5 supports up to 10 references.', 'Use quoted text for typography fidelity.'],
    fields: [],
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
    fields: [],
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

export function fieldsForModel(model: string, tool: AssistantToolKind): AssistantPlanField[] {
  const config = MODEL_FIELDS.find((m) => m.model === model);
  if (config) return config.fields;
  return fieldsForTool(tool);
}

export function defaultsForModel(model: string): Record<string, any> {
  const config = MODEL_FIELDS.find((m) => m.model === model);
  return config?.defaults || {};
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
    'Every step must include a tool-specific prompt that is unique to that step and describes the exact intent (no shared generic prompts across steps).',
    'When a later step depends on media from a prior step, mention that media in the prompt (e.g., “Animate the hero image from step-image…”).',
    'For video steps, include camera movement/pace and aspect ratio. For image steps, include style/materials/text-in-quotes. For TTS, include the text to speak. For transcription, omit prompt.',
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
  const defaults = { ...(spec?.models.find((m) => m.id === step.model)?.defaultInputs || {}), ...defaultsForModel(step.model) };
  const modelFields = fieldsForModel(step.model, step.tool);
  return {
    ...step,
    inputs: { ...defaults, ...step.inputs },
    modelOptions: step.modelOptions?.length ? step.modelOptions : spec?.models.map((m) => m.id) || [],
    fields: step.fields && step.fields.length ? step.fields : modelFields.length ? modelFields : fieldsForTool(step.tool),
    outputType: step.outputType || spec?.outputType,
    validations: step.validations || spec?.validations || [],
  };
}

function attachMediaToPlan(plan: AssistantPlan, media: AssistantMedia[]): AssistantPlan {
  const imageUrls = media.filter((m) => m.type === 'image').map((m) => m.url).filter(Boolean);
  const videoUrls = media.filter((m) => m.type === 'video').map((m) => m.url).filter(Boolean);
  const audioUrls = media.filter((m) => m.type === 'audio').map((m) => m.url).filter(Boolean);

  let lastImageStep: string | null = null;
  let lastVideoStep: string | null = null;
  let lastAudioStep: string | null = null;

  const ensureArrayField = (inputs: Record<string, any>, key: string, value: string | string[]) => {
    if (Array.isArray(value)) {
      inputs[key] = value;
    } else {
      inputs[key] = [value];
    }
  };

  const steps = plan.steps.map((step, index) => {
    const inputs = { ...(step.inputs || {}) };
    const deps = new Set(step.dependencies || []);

    const linkFromPrevious = (
      priorId: string | null,
      attachmentUrls: string[],
      key: string,
      isArray?: boolean,
    ) => {
      if (inputs[key]) return;
      if (priorId) {
        const token = `{{steps.${priorId}.output}}`;
        if (isArray) ensureArrayField(inputs, key, token);
        else inputs[key] = token;
        deps.add(priorId);
      } else if (attachmentUrls.length) {
        if (isArray) ensureArrayField(inputs, key, attachmentUrls);
        else inputs[key] = attachmentUrls[0];
      }
    };

    const imageArrayKeys = ['input_images', 'image_input'];
    const imageScalarKeys = ['input_image', 'image', 'start_image', 'end_image'];
    const videoKeys = ['video', 'video_url', 'start_video', 'reference_video'];
    const audioKeys = ['audio', 'audio_url', 'voice'];

    if (['image', 'background_remove', 'enhance', 'video'].includes(step.tool)) {
      for (const key of imageArrayKeys) {
        linkFromPrevious(lastImageStep, imageUrls, key, true);
      }
      for (const key of imageScalarKeys) {
        linkFromPrevious(lastImageStep, imageUrls, key, false);
      }
    }

    if (['background_remove', 'lipsync'].includes(step.tool)) {
      for (const key of videoKeys) {
        linkFromPrevious(lastVideoStep, videoUrls, key, false);
      }
    }

    if (['lipsync'].includes(step.tool)) {
      for (const key of audioKeys) {
        linkFromPrevious(lastAudioStep, audioUrls, key, false);
      }
    }

    const updatedStep: AssistantPlanStep = {
      ...step,
      inputs,
      dependencies: Array.from(deps),
    };

    const isImageLike = step.outputType === 'image' || ['image', 'enhance'].includes(step.tool);
    const isVideoLike = step.outputType === 'video' || ['video', 'lipsync', 'background_remove'].includes(step.tool);
    const isAudioLike = step.outputType === 'audio' || ['tts'].includes(step.tool);

    if (isImageLike) lastImageStep = step.id;
    if (isVideoLike) lastVideoStep = step.id;
    if (isAudioLike) lastAudioStep = step.id;

    return updatedStep;
  });

  return { ...plan, steps };
}

export function fallbackPlanFromMessages(messages: AssistantPlanMessage[], media: AssistantMedia[]): AssistantPlan {
  const lastUser = messages.slice().reverse().find((m) => m.role === 'user');
  const hasVideo = media.some((m) => m.type === 'video');
  const hasImage = media.some((m) => m.type === 'image');
  const firstImage = media.find((m) => m.type === 'image');
  const summary = lastUser ? `Plan based on: ${lastUser.content.slice(0, 140)}` : 'Auto-generated assistant workflow';

  const steps: AssistantPlanStep[] = [];
  const baseImage: AssistantPlanStep = normalizeInputs({
    id: 'step-image',
    title: 'Generate key visual',
    tool: 'image',
    model: 'openai/gpt-image-1.5',
    inputs: {
      prompt: lastUser?.content
        ? `${lastUser.content}\nStyle: cinematic product hero, soft rim lighting, crisp typography in quotes if needed.`
        : 'Hero shot of the product in good lighting, cinematic aesthetic, 35mm lens, shallow depth of field.',
      aspect_ratio: '1:1',
      number_of_images: 1,
      input_images: firstImage ? [firstImage.url] : undefined,
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
          prompt:
            lastUser?.content
              ? `Animate the hero image from step-image with a subtle dolly-in, natural motion blur, and pacing for a ${wantsVideo ? 'short spot' : 'promo'}.`
              : 'Animate the hero image with a gentle dolly-in and smooth motion, 16:9 framing.',
          start_image: hasImage ? firstImage?.url : `{{steps.${baseImage.id}.output}}`,
          aspect_ratio: '16:9',
          duration: 5,
        },
        dependencies: [baseImage.id],
        suggestedParams: {},
      }),
    );
  }

  return attachMediaToPlan(
    {
      summary,
      steps,
    },
    media,
  );
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
  return attachMediaToPlan(
    {
      summary: typeof raw.summary === 'string' ? raw.summary : 'Generated workflow',
      steps,
    },
    media,
  );
}
