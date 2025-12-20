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

// Types for request analysis
export type AnalyzedRequest = {
  totalImageSteps: number;
  totalVideoSteps: number;
  totalTtsSteps: number;
  totalTranscriptionSteps: number;
  totalLipsyncSteps: number;
  totalEnhanceSteps: number;
  totalBackgroundRemoveSteps: number;
  contentVariations: string[];
  goals?: string;
  intents?: string[];
  styleCues?: string[];
  motionCues?: string[];
  tone?: string;
  risks?: string[];
  openQuestions?: string[];
  requiredAssets?: string[];
  missingInfo?: string[];
  imageModificationInstruction?: string;  // e.g., "Modify this image to change the text to"
  videoSceneDescription?: string;          // e.g., "A woman holds the card, showing it to camera, hands steady with subtle trembling"
  imageToVideoMapping: 'one-to-one' | 'one-to-many' | 'none';
  hasUploadedMedia: boolean;
  uploadedMediaUsage: 'as-start-frame' | 'as-reference' | 'to-modify' | 'none';
};

export function buildRequestAnalyzerPrompt(): string {
  return `You are a senior production strategist. Read the request and surface what matters without forcing templates.

- Separate intent, constraints, and missing info.
- Keep prompts OUT of this stage; just describe what must be built.
- Describe motion like a director would, not as keywords.
- Respect uploaded media usage (start frame, reference, or to modify).
- Identify risks and open questions.

OUTPUT (valid JSON only):
{
  "totalImageSteps": number,
  "totalVideoSteps": number,
  "totalTtsSteps": number,
  "totalTranscriptionSteps": number,
  "totalLipsyncSteps": number,
  "totalEnhanceSteps": number,
  "totalBackgroundRemoveSteps": number,
  "contentVariations": ["text1", "text2", ...],
  "goals": "short summary of the creative goal",
  "intents": ["concise bullets of what the user wants"],
  "styleCues": ["brand/look cues, if any"],
  "motionCues": ["camera/subject motion cues"],
  "tone": "voice/tone if relevant",
  "risks": ["potential failures or ambiguities"],
  "openQuestions": ["information not provided but relevant"],
  "requiredAssets": ["assets the model must use"],
  "missingInfo": ["gaps that could block execution"],
  "imageModificationInstruction": "action to perform on provided images" | null,
  "videoSceneDescription": "director-style scene description, no text content" | null,
  "imageToVideoMapping": "one-to-one" | "one-to-many" | "none",
  "hasUploadedMedia": boolean,
  "uploadedMediaUsage": "as-start-frame" | "as-reference" | "to-modify" | "none"
}`;
}

export function buildPlannerSystemPrompt(): string {
  const toolSections = Object.values(TOOL_SPECS)
    .map((tool) => {
      const models = tool.models.map((m) => `- ${m.label} (${m.id})`).join('\n');
      return `### ${tool.label}\n${tool.description}\nModels:\n${models}`;
    })
    .join('\n\n');

  const outputFormat = `
## OUTPUT FORMAT (JSON only, no markdown fences):
{
  "summary": "Brief description of full workflow",
  "steps": [
    {
      "id": "unique-step-id",
      "title": "Human-readable step title",
      "tool": "image|video|lipsync|background_remove|enhance|transcription|tts",
      "model": "exact model id from list above",
      "inputs": {
        "prompt": "outline of what the prompt should cover (not the final prompt)",
        ...other tool-specific inputs
      },
      "outputType": "image|video|audio|text",
      "dependencies": ["id-of-step-this-depends-on"]
    }
  ]
}`;

  return `You are a creative workflow architect. Break the request into atomic steps using the available tools. Do NOT write final prompts; instead give clear prompt outlines for each step. Avoid canned phrasing and keep space for nuanced prompt writing in a later pass.

Principles:
- Each generation call = one step; never batch variations.
- Reuse uploaded media according to intent (start frame, reference, to modify). Never chain image edits; modifications reference the original upload.
- Keep dependencies explicit. If a video animates an image, depend on that image step and note start_image linkage.
- Describe motion and visuals in natural language outlines; do not copy the user's raw text or feed template sentences.
- Represent each variation as its own step. Prefer concise IDs and titles.
- Stay within the listed tools/models (below), but choose the best fit freely.

${toolSections}

${outputFormat}`;
}

export function buildPromptAuthorSystemPrompt(): string {
  return `You are a prompt author. Given a user conversation, analysis context, and a draft step plan, write production-ready prompts for each step without using canned templates.

Guidelines:
- Keep the same step ids, tools, models, and dependencies.
- Turn each "prompt outline" into a rich, specific prompt that matches the tool (image, video, audio, etc.).
- For video, write director-style descriptions of action/camera/motion; do not paste the user's full message; keep text content out of motion prompts.
- For image modification, describe the desired change precisely; if text must change, state the new text directly but don't use stock phrasing.
- For new images, describe scene, subject, style, and quality in natural language.
- Avoid placeholders and boilerplate; every prompt should feel intentional and specific to the request.
- Output the final JSON plan with the same shape: { "summary": string, "steps": [...] }.`;
}

export function buildDecompositionUserPrompt(
  messages: AssistantPlanMessage[],
  media: AssistantMedia[],
  analysis: AnalyzedRequest | null,
): string {
  const mediaLines = media.map((m) => `- ${m.type}: ${m.url}${m.label ? ` (${m.label})` : ''}`).join('\n');
  const conversation = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

  const analysisBlock = analysis
    ? [
        '## ANALYSIS CONTEXT',
        analysis.goals ? `Goals: ${analysis.goals}` : null,
        analysis.intents?.length ? `Intents: ${analysis.intents.join(' | ')}` : null,
        analysis.styleCues?.length ? `Style cues: ${analysis.styleCues.join(' | ')}` : null,
        analysis.motionCues?.length ? `Motion cues: ${analysis.motionCues.join(' | ')}` : null,
        analysis.contentVariations?.length ? `Variations: ${analysis.contentVariations.join(' | ')}` : null,
        analysis.videoSceneDescription ? `Scene direction: ${analysis.videoSceneDescription}` : null,
        `Step counts -> images:${analysis.totalImageSteps}, videos:${analysis.totalVideoSteps}, tts:${analysis.totalTtsSteps}, transcription:${analysis.totalTranscriptionSteps}, lipsync:${analysis.totalLipsyncSteps}, enhance:${analysis.totalEnhanceSteps}, background_remove:${analysis.totalBackgroundRemoveSteps}`,
        analysis.hasUploadedMedia ? `Uploaded media usage: ${analysis.uploadedMediaUsage}` : null,
        analysis.risks?.length ? `Risks: ${analysis.risks.join(' | ')}` : null,
        analysis.openQuestions?.length ? `Open questions: ${analysis.openQuestions.join(' | ')}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : '## NO ANALYSIS PROVIDED';

  return [
    'Draft the step decomposition (not final prompts).',
    '## USER CONVERSATION',
    conversation || 'No conversation provided',
    mediaLines ? `\n## ATTACHED MEDIA\n${mediaLines}` : '\n## NO MEDIA ATTACHED',
    analysisBlock,
    '\nReturn only the JSON plan with prompt outlines.',
  ].join('\n');
}

export function buildAuthoringUserPrompt(
  messages: AssistantPlanMessage[],
  media: AssistantMedia[],
  analysis: AnalyzedRequest | null,
  draftPlan: any,
): string {
  const mediaLines = media.map((m) => `- ${m.type}: ${m.url}${m.label ? ` (${m.label})` : ''}`).join('\n');
  const conversation = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
  const draftJson = JSON.stringify(draftPlan || {}, null, 2);

  const analysisBlock = analysis
    ? [
        '## ANALYSIS CONTEXT',
        analysis.goals ? `Goals: ${analysis.goals}` : null,
        analysis.intents?.length ? `Intents: ${analysis.intents.join(' | ')}` : null,
        analysis.styleCues?.length ? `Style cues: ${analysis.styleCues.join(' | ')}` : null,
        analysis.motionCues?.length ? `Motion cues: ${analysis.motionCues.join(' | ')}` : null,
        analysis.tone ? `Tone: ${analysis.tone}` : null,
        analysis.videoSceneDescription ? `Scene direction: ${analysis.videoSceneDescription}` : null,
        analysis.contentVariations?.length ? `Variations: ${analysis.contentVariations.join(' | ')}` : null,
        analysis.hasUploadedMedia ? `Uploaded media usage: ${analysis.uploadedMediaUsage}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : '## NO ANALYSIS PROVIDED';

  return [
    'Elevate the draft into final prompts (no boilerplate).',
    '## USER CONVERSATION',
    conversation || 'No conversation provided',
    mediaLines ? `\n## ATTACHED MEDIA\n${mediaLines}` : '\n## NO MEDIA ATTACHED',
    analysisBlock,
    '\n## DRAFT PLAN (KEEP IDS/DEPENDENCIES/MODELS)',
    draftJson,
    '\nRewrite prompts with full fidelity. Output the finalized JSON plan.',
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
  const producedKinds: Record<string, 'image' | 'video' | 'audio' | null> = {};

  const ensureArrayField = (inputs: Record<string, any>, key: string, value: string | string[]) => {
    if (Array.isArray(value)) {
      inputs[key] = value;
    } else {
      inputs[key] = [value];
    }
  };

  const hasStepToken = (value: unknown): boolean => {
    if (typeof value === 'string') return /{{\s*steps\./i.test(value);
    if (Array.isArray(value)) return value.some((entry) => hasStepToken(entry));
    return false;
  };

  const shouldUsePriorDependency = (value: unknown): boolean => {
    if (value === undefined || value === null) return true;
    if (Array.isArray(value)) {
      if (value.length === 0) return true;
      return !value.some((entry) => hasStepToken(entry));
    }
    if (typeof value === 'string') return !hasStepToken(value);
    return true;
  };

  const outputKindForStep = (step: AssistantPlanStep): 'image' | 'video' | 'audio' | null => {
    if (step.outputType === 'image' || ['image', 'enhance'].includes(step.tool)) return 'image';
    if (step.outputType === 'video' || ['video', 'lipsync', 'background_remove'].includes(step.tool)) return 'video';
    if (step.outputType === 'audio' || ['tts'].includes(step.tool)) return 'audio';
    return null;
  };

  const findDependencyByKind = (step: AssistantPlanStep, kind: 'image' | 'video' | 'audio'): string | null => {
    if (!Array.isArray(step.dependencies)) return null;
    for (let i = step.dependencies.length - 1; i >= 0; i -= 1) {
      const depId = step.dependencies[i];
      if (producedKinds[depId] === kind) return depId;
    }
    return null;
  };

  const steps = plan.steps.map((step) => {
    const inputs = { ...(step.inputs || {}) };
    const deps = new Set(step.dependencies || []);
    const preferredImageSource = findDependencyByKind(step, 'image') || lastImageStep;
    const preferredVideoSource = findDependencyByKind(step, 'video') || lastVideoStep;
    const preferredAudioSource = findDependencyByKind(step, 'audio') || lastAudioStep;

    const linkFromPrevious = (
      priorId: string | null,
      attachmentUrls: string[],
      key: string,
      isArray?: boolean,
    ) => {
      if (priorId && shouldUsePriorDependency(inputs[key])) {
        const token = `{{steps.${priorId}.url}}`;
        if (isArray) ensureArrayField(inputs, key, token);
        else inputs[key] = token;
        deps.add(priorId);
        return;
      }
      if (attachmentUrls.length && (inputs[key] === undefined || inputs[key] === null)) {
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
        linkFromPrevious(preferredImageSource, imageUrls, key, true);
      }
      for (const key of imageScalarKeys) {
        linkFromPrevious(preferredImageSource, imageUrls, key, false);
      }
    }

    if (['background_remove', 'lipsync'].includes(step.tool)) {
      for (const key of videoKeys) {
        linkFromPrevious(preferredVideoSource, videoUrls, key, false);
      }
    }

    if (['lipsync'].includes(step.tool)) {
      for (const key of audioKeys) {
        linkFromPrevious(preferredAudioSource, audioUrls, key, false);
      }
    }

    const updatedStep: AssistantPlanStep = {
      ...step,
      inputs,
      dependencies: Array.from(deps),
    };

    const stepKind = outputKindForStep(step);
    producedKinds[step.id] = stepKind;
    if (stepKind === 'image') lastImageStep = step.id;
    if (stepKind === 'video') lastVideoStep = step.id;
    if (stepKind === 'audio') lastAudioStep = step.id;

    return updatedStep;
  });

  return { ...plan, steps };
}

// Helper to parse counts from user message
function parseRequestCounts(text: string): { images: number; videos: number; tts: number; contentItems: string[] } {
  const lowerText = text.toLowerCase();
  
  // Extract explicit numbers
  const imageMatch = lowerText.match(/(\d+)\s*(?:images?|cards?|pictures?|visuals?|graphics?|posters?)/);
  const videoMatch = lowerText.match(/(\d+)\s*(?:videos?|clips?|animations?)/);
  const ttsMatch = lowerText.match(/(\d+)\s*(?:voiceovers?|narrations?|audio)/);
  
  let images = imageMatch ? parseInt(imageMatch[1], 10) : 0;
  let videos = videoMatch ? parseInt(videoMatch[1], 10) : 0;
  let tts = ttsMatch ? parseInt(ttsMatch[1], 10) : 0;
  
  // Extract content variations (quoted strings, numbered items, or line-separated items)
  const contentItems: string[] = [];
  
  // Match quoted strings
  const quotedMatches = text.match(/["«»''""](.*?)["«»''""]/g);
  if (quotedMatches) {
    quotedMatches.forEach(match => {
      const cleaned = match.replace(/^["«»''""]+|["«»''""]+$/g, '').trim();
      if (cleaned.length > 0 && cleaned.length < 500) contentItems.push(cleaned);
    });
  }
  
  // Match line-separated content (often questions or text variations)
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 10 && !l.startsWith('-') && !l.startsWith('•'));
  if (lines.length > 2) {
    // Skip the first line if it looks like instructions
    const potentialContent = lines.filter(l => !l.toLowerCase().includes('create') && !l.toLowerCase().includes('generate') && !l.toLowerCase().includes('make'));
    potentialContent.forEach(line => {
      if (line.length > 10 && line.length < 500 && !contentItems.includes(line)) {
        contentItems.push(line);
      }
    });
  }
  
  // If we found content items but no explicit counts, use content item count
  if (contentItems.length > 1 && images === 0) {
    images = contentItems.length;
  }
  
  // Check for "for each" or "each one" patterns implying 1:1 video mapping
  const wantsVideoForEach = /(?:for each|each one|animate (?:each|them|all)|video(?:s)? (?:for|from) (?:each|them|all))/i.test(lowerText);
  if (wantsVideoForEach && images > 0 && videos === 0) {
    videos = images;
  }
  
  // Check for generic video request without count
  const wantsAnyVideo = /video|animate|motion|clip/i.test(lowerText);
  if (wantsAnyVideo && videos === 0) {
    videos = images > 0 ? images : 1;
  }
  
  // Default to at least 1 image if nothing parsed
  if (images === 0 && videos === 0 && tts === 0) {
    images = 1;
    if (wantsAnyVideo) videos = 1;
  }
  
  return { images, videos, tts, contentItems };
}

// Detect if user wants to modify an existing image
function detectImageModification(text: string): { isModification: boolean; instruction: string } {
  const modifyPatterns = [
    /modify\s+(?:this|the|my)?\s*image/i,
    /put\s+(?:this|these)?\s*text/i,
    /replace\s+(?:the)?\s*text/i,
    /change\s+(?:the)?\s*text/i,
    /add\s+(?:this|these)?\s*text/i,
    /edit\s+(?:this|the)?\s*image/i,
  ];
  
  const isModification = modifyPatterns.some(p => p.test(text));
  
  if (isModification) {
    return {
      isModification: true,
      instruction: 'Replace the text on this card with',
    };
  }
  
  return { isModification: false, instruction: '' };
}

// Extract scene description for video from user text
// This should describe WHAT IS HAPPENING in the video, not just motion keywords
function extractVideoSceneDescription(text: string): string {
  const defaultScene = 'Follow the described scene with stable framing and natural motion (around 4 seconds).';
  
  // Look for scene-describing phrases
  const lowerText = text.toLowerCase();
  
  // Build a scene description from what user described
  const sceneElements: string[] = [];
  
  // Check for subject descriptions
  if (/hands?\s+hold/i.test(text) || /holding/i.test(text)) {
    sceneElements.push('Hands holding the card');
  }
  if (/woman|femme/i.test(text)) {
    sceneElements.push('A woman holds the card');
  } else if (/man|homme/i.test(text)) {
    sceneElements.push('A man holds the card');
  } else if (/person|someone/i.test(text)) {
    sceneElements.push('A person holds the card');
  }
  
  // Check for camera instructions
  if (/facing\s+(?:the\s+)?camera|face\s+(?:the\s+)?camera|to\s+(?:the\s+)?camera/i.test(text)) {
    sceneElements.push('showing it directly to the camera');
  }
  if (/camera\s+stay|static\s+camera|still\s+camera/i.test(text)) {
    sceneElements.push('Static camera');
  }
  
  // Check for motion descriptions
  if (/trembl|shak/i.test(text)) {
    sceneElements.push('with subtle natural hand trembling');
  }
  if (/still|steady|stable/i.test(text)) {
    sceneElements.push('keeping the card steady and readable');
  }
  
  // If we found scene elements, build a proper prompt
  if (sceneElements.length >= 2) {
    return sceneElements.join(', ') + '. 4 seconds.';
  }
  
  // Try to extract a more complete description if user provided detailed instructions
  if (/video/i.test(text) && text.length > 100) {
    // Look for the video description part (usually after "video" keyword)
    const videoMatch = text.match(/video[s]?\s*[,:]?\s*([^.!?]{20,150})/i);
    if (videoMatch && videoMatch[1]) {
      let scene = videoMatch[1]
        .replace(/["«»''"""][^"«»''"""]*["«»''""]/g, '') // Remove quoted text content
        .replace(/(?:quel|qui|si tu|comment|pourquoi)[^,.]*/gi, '') // Remove French question words
        .replace(/\s+/g, ' ')
        .trim();
      
      if (scene.length > 20 && scene.length < 200) {
        return scene + '. 4 seconds.';
      }
    }
  }
  
  return defaultScene;
}

// Helper to create an image step with proper prompts
function createImageStep(
  id: string,
  title: string,
  contentText: string | null,
  isModification: boolean,
  originalMediaUrl: string | undefined,
): AssistantPlanStep {
  const promptParts: string[] = [];
  if (isModification) promptParts.push('Use the provided image as the base and integrate the new content cleanly.');
  if (contentText) promptParts.push(`Highlight the text "${contentText}" with clear, legible placement.`);
  if (!contentText) promptParts.push('Create a high-quality visual that fits the request and brand tone.');
  const prompt = promptParts.join(' ').trim();
  
  return normalizeInputs({
    id,
    title,
    tool: 'image',
    model: 'openai/gpt-image-1.5',
    inputs: {
      prompt,
      aspect_ratio: '1:1',
      number_of_images: 1,
      // ALWAYS use the original uploaded image for ALL modification steps
      // Never chain image outputs - each modification uses the original
      input_images: originalMediaUrl ? [originalMediaUrl] : undefined,
    },
    outputType: 'image',
    // NO dependencies for image modification - each uses original upload
    dependencies: [],
    suggestedParams: {},
  });
}

// Helper to create a video step with proper prompts (motion only, no visual design)
function createVideoStep(
  id: string,
  title: string,
  motionDescription: string,
  sourceImageStepId: string,
): AssistantPlanStep {
  return normalizeInputs({
    id,
    title,
        tool: 'video',
    model: 'kwaivgi/kling-v2.1',
        inputs: {
      prompt: motionDescription,
      start_image: `{{steps.${sourceImageStepId}.url}}`,
      aspect_ratio: '1:1',
      duration: 4,
      mode: 'default',
    },
    outputType: 'video',
    dependencies: [sourceImageStepId],
        suggestedParams: {},
  });
}

export function fallbackPlanFromMessages(messages: AssistantPlanMessage[], media: AssistantMedia[]): AssistantPlan {
  const lastUser = messages.slice().reverse().find((m) => m.role === 'user');
  const userContent = lastUser?.content || '';
  const hasUploadedImage = media.some((m) => m.type === 'image');
  const firstImage = media.find((m) => m.type === 'image');
  
  // Parse the request to understand what's needed
  const { images: imageCount, videos: videoCount, contentItems } = parseRequestCounts(userContent);
  
  // Detect if this is an image modification request
  const { isModification } = detectImageModification(userContent);
  
  // Extract proper video scene description
  const videoScenePrompt = extractVideoSceneDescription(userContent);
  
  const steps: AssistantPlanStep[] = [];
  const summary = `${isModification ? 'Modify' : 'Create'} ${imageCount} image(s)${videoCount > 0 ? ` and animate ${videoCount} video(s)` : ''}`;
  
  // Create image steps - ALL use the ORIGINAL uploaded image (no chaining!)
  for (let i = 0; i < imageCount; i++) {
    const stepId = imageCount > 1 ? `image-${i + 1}` : 'step-image';
    const contentText = contentItems[i] || null;
    const title = contentText 
      ? `${isModification ? 'Modify' : 'Create'} image ${i + 1}: "${contentText.slice(0, 25)}${contentText.length > 25 ? '...' : ''}"`
      : `${isModification ? 'Modify' : 'Create'} image ${i + 1}`;
    
    steps.push(createImageStep(
      stepId,
      title,
      contentText,
      isModification && hasUploadedImage,
      firstImage?.url, // ALWAYS the original uploaded image
    ));
  }
  
  // Create video steps (one for each image if we have matching counts)
  // Each video uses its corresponding image step output as start_image
  for (let i = 0; i < videoCount; i++) {
    const sourceImageIndex = Math.min(i, imageCount - 1);
    const sourceImageId = imageCount > 1 ? `image-${sourceImageIndex + 1}` : 'step-image';
    const stepId = videoCount > 1 ? `video-${i + 1}` : 'step-video';
    const title = `Animate video ${i + 1}`;
    
    // Only create video if we have a source image
    if (imageCount > 0 || hasUploadedImage) {
      steps.push(createVideoStep(
        stepId,
        title,
        videoScenePrompt, // Proper scene description, not motion keywords
        sourceImageId,
      ));
    }
  }
  
  // If no image steps but we want video and have uploaded image, create video from upload
  if (imageCount === 0 && videoCount > 0 && hasUploadedImage && firstImage) {
    for (let i = 0; i < videoCount; i++) {
      const stepId = videoCount > 1 ? `video-${i + 1}` : 'step-video';
      steps.push(normalizeInputs({
        id: stepId,
        title: `Animate video ${i + 1}`,
        tool: 'video',
        model: 'kwaivgi/kling-v2.1',
        inputs: {
          prompt: videoScenePrompt,
          start_image: firstImage.url,
          aspect_ratio: '1:1',
          duration: 4,
          mode: 'default',
        },
        outputType: 'video',
        dependencies: [],
        suggestedParams: {},
      }));
    }
  }
  
  return attachMediaToPlan({ summary, steps }, media);
}

// Validate and clean a prompt for tool-appropriateness
function validateAndCleanPrompt(prompt: string | undefined, tool: AssistantToolKind): string {
  if (!prompt || typeof prompt !== 'string') {
    return 'Follow the user request with high fidelity and clarity.';
  }

  return String(prompt).trim();
}

// Count steps by tool type
function countStepsByTool(steps: AssistantPlanStep[]): Record<AssistantToolKind, number> {
  const counts: Record<AssistantToolKind, number> = {
    image: 0,
    video: 0,
    tts: 0,
    transcription: 0,
    lipsync: 0,
    enhance: 0,
    background_remove: 0,
  };
  
  for (const step of steps) {
    if (step.tool in counts) {
      counts[step.tool]++;
    }
  }
  
  return counts;
}

export function normalizePlannerOutput(
  raw: any,
  messages: AssistantPlanMessage[],
  media: AssistantMedia[],
  analysis?: AnalyzedRequest | null,
): AssistantPlan {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.steps)) {
    return fallbackPlanFromMessages(messages, media);
  }
  
  const hasUploadedImage = media.some((m) => m.type === 'image');
  const firstImageUrl = media.find((m) => m.type === 'image')?.url;
  
  // Process and validate each step
  let steps = (raw.steps as AssistantPlanStep[]).map((s, idx) => {
    const tool = (s.tool as AssistantToolKind) || 'image';
    const promptOutline = (s.inputs as any)?.prompt_outline || s.inputs?.prompt || '';
    let prompt = promptOutline;

    if (!prompt && tool === 'video' && analysis?.videoSceneDescription) {
      prompt = analysis.videoSceneDescription.trim();
    }

    if (!prompt && tool === 'image' && analysis?.imageModificationInstruction) {
      const stepIndex = (raw.steps as any[]).filter((st: any) => st.tool === 'image').indexOf(s);
      const contentVariation = analysis.contentVariations[stepIndex];
      prompt = contentVariation
        ? `${analysis.imageModificationInstruction} "${contentVariation}"`
        : analysis.imageModificationInstruction;
    }
    
    prompt = validateAndCleanPrompt(prompt, tool);
    
    const inputs: Record<string, any> = { ...(s.inputs || {}) };
    if (prompt) inputs.prompt = prompt;
    
    // Ensure uploaded image is referenced for modification tasks
    if (tool === 'image' && hasUploadedImage && analysis?.uploadedMediaUsage === 'to-modify') {
      if (!inputs.input_images && firstImageUrl) {
        inputs.input_images = [firstImageUrl];
      }
    }
    
    return normalizeInputs({
      id: s.id || `step-${idx + 1}`,
      title: s.title || `Step ${idx + 1}`,
      description: s.description || '',
      tool,
      model: coerceString(s.model) || TOOL_SPECS[tool]?.models[0]?.id || TOOL_SPECS.image.models[0].id,
      modelOptions: s.modelOptions,
      inputs,
      suggestedParams: s.suggestedParams || {},
      fields: s.fields,
      outputType: s.outputType,
      dependencies: s.dependencies || [],
      validations: s.validations,
    });
  });

  // If we have analysis, validate step counts and add missing steps
  if (analysis) {
    const counts = countStepsByTool(steps);
    
    // Check if we need more image steps
    if (counts.image < analysis.totalImageSteps) {
      const missing = analysis.totalImageSteps - counts.image;
      const existingImageCount = steps.filter(s => s.tool === 'image').length;
      
      for (let i = 0; i < missing; i++) {
        const idx = existingImageCount + i + 1;
        const contentText = analysis.contentVariations[existingImageCount + i] || null;
        const newId = `image-${idx}`;
        
        const styleCue = analysis.styleCues?.length ? ` Style cues: ${analysis.styleCues.join(', ')}.` : '';
        const goalText = analysis.goals ? ` Goal: ${analysis.goals}.` : '';
        const prompt = contentText
          ? `Image for "${contentText}" that aligns with the request.${styleCue}${goalText}`
          : `Image that aligns with the request.${styleCue}${goalText}`;
        
        steps.push(normalizeInputs({
          id: newId,
          title: contentText ? `Image ${idx}: "${contentText.slice(0, 25)}..."` : `Create image ${idx}`,
          tool: 'image',
          model: 'openai/gpt-image-1.5',
          inputs: {
            prompt,
            aspect_ratio: '1:1',
            input_images: hasUploadedImage && firstImageUrl ? [firstImageUrl] : undefined,
          },
          outputType: 'image',
          dependencies: [],
          suggestedParams: {},
        }));
      }
    }
    
    // Check if we need more video steps
    if (counts.video < analysis.totalVideoSteps) {
      const missing = analysis.totalVideoSteps - counts.video;
      const imageSteps = steps.filter(s => s.tool === 'image');
      const existingVideoCount = steps.filter(s => s.tool === 'video').length;
      
      for (let i = 0; i < missing; i++) {
        const idx = existingVideoCount + i + 1;
        const sourceImageIdx = Math.min(existingVideoCount + i, imageSteps.length - 1);
        const sourceImageId = imageSteps[sourceImageIdx]?.id || imageSteps[0]?.id;
        const newId = `video-${idx}`;
        const motion = analysis.videoSceneDescription || 'Animate according to the described scene and motion.';
        
        steps.push(normalizeInputs({
          id: newId,
          title: `Animate video ${idx}`,
          tool: 'video',
          model: 'kwaivgi/kling-v2.1',
          inputs: {
            prompt: motion,
            start_image: sourceImageId ? `{{steps.${sourceImageId}.url}}` : undefined,
            duration: 4,
            aspect_ratio: '1:1',
          },
          outputType: 'video',
          dependencies: sourceImageId ? [sourceImageId] : [],
          suggestedParams: {},
        }));
      }
    }
  }
  
  return attachMediaToPlan(
    {
      summary: typeof raw.summary === 'string' ? raw.summary : 'Generated workflow',
      steps,
    },
    media,
  );
}
