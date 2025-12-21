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
      aspect_ratio: '2:3', // Default to mobile (will be auto-detected)
      output_format: 'webp',
      input_fidelity: 'high',
      quality: 'high',
      background: 'auto',
      moderation: 'low',
    },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'select', options: IMAGE_RATIOS_GPT15.map((r) => ({ value: r, label: r })), required: true },
      { key: 'input_images', label: 'Reference images (comma URLs)', type: 'text', helper: 'Up to 10 references' },
      { key: 'number_of_images', label: 'Outputs', type: 'number', min: 1, max: 10 },
      { key: 'input_fidelity', label: 'Input fidelity', type: 'select', options: ['low', 'high'].map((v) => ({ value: v, label: v })) },
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
    model: 'wan-video/wan-2.2-animate-replace',
    defaults: { aspect_ratio: '16:9', refert_num: 1 },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { key: 'video', label: 'Video URL (required)', type: 'url', required: true, helper: 'Source video to replace character in' },
      { key: 'character_image', label: 'Character image URL (required)', type: 'url', required: true, helper: 'Image of character to insert' },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'select', options: VIDEO_RATIOS.map((r) => ({ value: r, label: r })) },
      { key: 'refert_num', label: 'Reference number', type: 'select', options: [{ value: '1', label: '1' }, { value: '5', label: '5' }], helper: 'Number of reference frames (1 or 5)' },
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
      { id: 'openai/gpt-image-1.5', label: 'GPT Image 1.5', defaultInputs: { number_of_images: 1, aspect_ratio: '2:3' } },
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
      { id: 'google/veo-3', label: 'VEO 3', defaultInputs: { resolution: '720p' } },
      { id: 'openai/sora-2', label: 'Sora 2', defaultInputs: { resolution: '720p' } },
      { id: 'openai/sora-2-pro', label: 'Sora 2 Pro', defaultInputs: { resolution: '1080p' } },
      { id: 'kwaivgi/kling-v2.5-turbo-pro', label: 'Kling v2.5 Turbo Pro', defaultInputs: { duration: 5, aspect_ratio: '16:9' } },
      { id: 'kwaivgi/kling-v2.1', label: 'Kling v2.1', defaultInputs: { duration: 4, aspect_ratio: '16:9', mode: 'default' } },
      { id: 'wan-video/wan-2.2-i2v-fast', label: 'WAN 2.2 i2v Fast', defaultInputs: { aspect_ratio: '16:9' } },
      { id: 'wan-video/wan-2.2-animate-replace', label: 'WAN 2.2 Animate Replace', defaultInputs: { aspect_ratio: '16:9' } },
      { id: 'bytedance/seedance-1-lite', label: 'Seedance 1 Lite', defaultInputs: { aspect_ratio: '16:9' } },
      { id: 'bytedance/seedance-1-pro', label: 'Seedance 1 Pro', defaultInputs: { aspect_ratio: '16:9' } },
    ],
  },
  lipsync: {
    id: 'lipsync',
    label: 'Lip Sync',
    description: 'Match audio to mouth movements or generate audio-driven cinematic video.',
    outputType: 'video',
    fields: [
      { key: 'video', label: 'Video/Image URL', type: 'url', required: true, helper: 'Can be an image (first frame) or video' },
      { key: 'audio', label: 'Audio URL', type: 'url', required: true },
      { key: 'backend', label: 'Backend', type: 'select', options: [
        { value: 'sievesync-1.1', label: 'Sieve Sync 1.1 (fast lipsync)' },
        { value: 'latentsync', label: 'LatentSync (high quality)' },
        { value: 'wan-2.2-s2v', label: 'Wan 2.2 S2V (cinematic audio-driven video)' },
      ], required: true },
      { key: 'prompt', label: 'Prompt (for Wan S2V)', type: 'textarea', required: false, helper: 'Describe video content (e.g., "woman speaking", "man singing") - only for Wan 2.2 S2V' },
      { key: 'num_frames_per_chunk', label: 'Frames per chunk (Wan S2V)', type: 'number', required: false, helper: 'Default: 81' },
      { key: 'interpolate', label: 'Interpolate to 25fps (Wan S2V)', type: 'text', required: false, helper: 'true/false' },
    ],
    models: [
      { id: 'sievesync-1.1', label: 'Sieve Sync 1.1' },
      { id: 'bytedance/latentsync', label: 'LatentSync' },
      { id: 'wan-video/wan-2.2-s2v', label: 'Wan 2.2 S2V (Cinematic)' },
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
    description: 'Synthesize speech from text scripts. Generate voiceovers, narrations, and spoken audio.',
    outputType: 'audio',
    fields: [
      { key: 'text', label: 'Text', type: 'textarea', required: true, helper: 'The text to convert to speech' },
      { key: 'provider', label: 'Provider', type: 'select', options: [
        { value: 'replicate', label: 'Replicate (Minimax)' },
        { value: 'elevenlabs', label: 'ElevenLabs' },
        { value: 'dia', label: 'Dia TTS' },
      ], required: false, helper: 'TTS provider to use' },
      { key: 'voice_id', label: 'Voice ID', type: 'text', required: false, helper: 'Voice identifier (varies by provider)' },
      { key: 'speed', label: 'Speed', type: 'number', required: false, helper: 'Speech speed (0.5-2.0)' },
      { key: 'pitch', label: 'Pitch', type: 'number', required: false, helper: 'Voice pitch adjustment' },
      { key: 'volume', label: 'Volume', type: 'number', required: false, helper: 'Volume level' },
      { key: 'emotion', label: 'Emotion', type: 'select', options: [
        { value: 'auto', label: 'Auto' },
        { value: 'neutral', label: 'Neutral' },
        { value: 'happy', label: 'Happy' },
        { value: 'sad', label: 'Sad' },
        { value: 'angry', label: 'Angry' },
        { value: 'fearful', label: 'Fearful' },
        { value: 'disgusted', label: 'Disgusted' },
        { value: 'surprised', label: 'Surprised' },
      ], required: false, helper: 'Emotional tone' },
    ],
    models: [
      { id: 'minimax-speech-02-hd', label: 'Minimax Speech 02 HD', defaultInputs: { provider: 'replicate' } },
      { id: 'elevenlabs-tts', label: 'ElevenLabs TTS', defaultInputs: { provider: 'elevenlabs' } },
      { id: 'dia-tts', label: 'Dia TTS', defaultInputs: { provider: 'dia' } },
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

// Comprehensive system prompt for Sonnet 4.5 - includes all tools, models, use cases, and technical details
export function buildUnifiedPlannerSystemPrompt(): string {
  // Build detailed tool sections with all models, use cases, and technical details
  const buildToolSection = (tool: ToolSpec): string => {
    const modelDetails = tool.models.map((model) => {
      const modelConfig = MODEL_FIELDS.find((m) => m.model === model.id);
      const fields = modelConfig?.fields || [];
      const defaults = modelConfig?.defaults || model.defaultInputs || {};
      
      // Build field descriptions
      const fieldDescriptions = fields.map((f) => {
        let desc = `    - ${f.key} (${f.type}${f.required ? ', required' : ', optional'})`;
        if (f.helper) desc += `: ${f.helper}`;
        if (f.options) desc += ` - Options: ${f.options.map((o) => o.value).join(', ')}`;
        if (f.min !== undefined) desc += ` - Min: ${f.min}`;
        if (f.max !== undefined) desc += ` - Max: ${f.max}`;
        return desc;
      }).join('\n');
      
      // Build use case examples
      let useCases = '';
      if (tool.id === 'image') {
        if (model.id === 'openai/gpt-image-1.5') {
          useCases = '      Use cases: Product cards with text, marketing visuals, social media posts, high-quality brand imagery. Best for: Typography fidelity, reference image support (up to 10), aspect ratios 1:1, 3:2, 2:3.';
        } else if (model.id.includes('flux-kontext')) {
          useCases = '      Use cases: Wide format images, banners, landscape visuals, cinematic compositions. Best for: 16:9, 21:9, wide aspect ratios, contextual understanding.';
        } else if (model.id.includes('flux-krea')) {
          useCases = '      Use cases: Square social media posts, Instagram content, balanced compositions. Best for: 1:1 aspect ratio, multiple outputs (1-4), webp format.';
        } else if (model.id.includes('nano-banana')) {
          useCases = '      Use cases: Fast image generation, quick iterations, lightweight outputs. Best for: Speed over quality, simple prompts, jpg format.';
        }
      } else if (tool.id === 'video') {
        if (model.id.includes('veo-3.1')) {
          useCases = model.id.includes('fast') 
            ? '      Use cases: Balanced quality and speed, social media videos, quick iterations. Best for: 720p/1080p, prompt following, start image support.'
            : '      Use cases: Premium video quality, cinematic content, high-fidelity motion. Best for: 1080p, longer durations, complex scenes.';
        } else if (model.id.includes('sora-2')) {
          useCases = model.id.includes('pro')
            ? '      Use cases: Extended duration videos, fine-grained control, complex scenes. Best for: 1080p, professional content, consistency.'
            : '      Use cases: Cinematic shots, audio-synced content, precise lighting. Best for: 720p/1080p, lighting control, audio sync.';
        } else if (model.id.includes('kling')) {
          useCases = '      Use cases: Short-form videos, social media clips, image-to-video animation. Best for: 4-8 second clips, start image required, aspect ratios 16:9, 9:16, 1:1.';
        } else if (model.id.includes('wan-2.2-i2v')) {
          useCases = '      Use cases: Image-to-video animation, quick video generation from stills. Best for: 2-8 second videos, start image required, fast processing.';
        } else if (model.id.includes('seedance')) {
          useCases = '      Use cases: Character motion, high-energy ads, short-form content. Best for: Character animation, dynamic motion, ad content.';
        } else if (model.id.includes('animate-replace')) {
          useCases = '      Use cases: Character replacement in videos, swapping actors/characters. Best for: Video + character image input, maintaining video motion.';
        }
      } else if (tool.id === 'tts') {
        if (model.id.includes('minimax')) {
          useCases = '      Use cases: Fast voiceover generation, quick audio creation, cost-effective TTS. Best for: Speed, general purpose, provider: "replicate".';
        } else if (model.id.includes('elevenlabs')) {
          useCases = '      Use cases: Premium voice quality, natural-sounding speech, professional narrations. Best for: High quality, premium voices, provider: "elevenlabs".';
        } else if (model.id.includes('dia')) {
          useCases = '      Use cases: Customizable voices, emotion control, pitch/speed adjustment. Best for: Customization, emotion control, provider: "dia".';
        }
      } else if (tool.id === 'lipsync') {
        if (model.id.includes('sievesync')) {
          useCases = '      Use cases: Fast lipsync on existing videos, quick turnaround. Best for: Speed, existing videos, backend: "sievesync-1.1".';
        } else if (model.id.includes('latentsync')) {
          useCases = '      Use cases: High-quality lipsync, professional results. Best for: Quality, existing videos, backend: "latentsync".';
        } else if (model.id.includes('wan-2.2-s2v')) {
          useCases = '      Use cases: Cinematic talking videos from images, audio-driven video generation. Best for: Images + audio, cinematic results, backend: "wan-2.2-s2v", requires prompt field.';
        }
      } else if (tool.id === 'enhance') {
        useCases = '      Use cases: Image upscaling, face enhancement, quality improvement. Best for: Upscaling (2x/4x/6x), face enhancement, quality improvement.';
      } else if (tool.id === 'background_remove') {
        useCases = '      Use cases: Remove backgrounds from videos, isolate subjects. Best for: Video background removal, subject isolation.';
      } else if (tool.id === 'transcription') {
        useCases = '      Use cases: Convert speech to text, transcribe audio files. Best for: Audio transcription, language detection, text extraction.';
      }
      
      return `    Model: ${model.label} (${model.id})
      Default inputs: ${JSON.stringify(defaults)}
${fieldDescriptions ? `      Fields:\n${fieldDescriptions}` : ''}
${useCases}`;
    }).join('\n\n');
    
    return `## ${tool.label} (tool: "${tool.id}")
${tool.description}
Output type: ${tool.outputType}
${tool.validations && tool.validations.length > 0 ? `Validations: ${tool.validations.join('; ')}\n` : ''}
Available models:
${modelDetails}`;
  };

  const toolSections = Object.values(TOOL_SPECS).map(buildToolSection).join('\n\n');

  return `You are the intelligent assistant of the Adz Creator app - a powerful creative workflow platform that enables users to generate images, videos, audio, and complete multimedia content through AI-powered tools.

YOUR ROLE:
- Understand user requests completely and break them down into actionable generation steps
- Choose the best models for each task based on use cases, quality requirements, and technical constraints
- Create detailed, production-ready prompts that are specific to the user's exact request
- Intelligently handle media dependencies, aspect ratios, and workflow orchestration
- Access and use ANY tool or model available in the platform when it makes sense

YOU HAVE FULL TECHNICAL ACCESS TO ALL TOOLS AND MODELS:

${toolSections}

MODEL SELECTION GUIDELINES:

Image Generation:
- openai/gpt-image-1.5: Best overall quality, typography fidelity, reference image support (up to 10), aspect ratios: 1:1, 3:2, 2:3. Use for: Product cards, marketing visuals, text-heavy images.
- black-forest-labs/flux-kontext-max: Wide format specialist, contextual understanding. Use for: Banners, landscape visuals, wide compositions (16:9, 21:9, etc.).
- black-forest-labs/flux-krea-dev: Square format optimized, multiple outputs (1-4). Use for: Instagram posts, square social media, balanced compositions.
- google/nano-banana: Fast generation, lightweight. Use for: Quick iterations, simple images, speed priority.
- google/nano-banana-pro: Enhanced Nano Banana with aspect ratio control. Use for: Fast generation with format control.

Video Generation:
- google/veo-3.1-fast: Balanced quality/speed, strong prompt following. Use for: Social media videos, quick iterations, 720p/1080p.
- google/veo-3.1: Premium quality, cinematic depth. Use for: High-fidelity videos, professional content, 1080p.
- google/veo-3-fast: Fast VEO 3 variant. Use for: Speed priority, 720p.
- google/veo-3: Standard VEO 3 quality. Use for: General video generation, 720p/1080p.
- openai/sora-2: Audio-synced, lighting control. Use for: Cinematic shots, audio sync, 720p/1080p.
- openai/sora-2-pro: Extended duration, fine control. Use for: Professional content, complex scenes, 1080p.
- kwaivgi/kling-v2.5-turbo-pro: Short clips, image-to-video. Use for: 4-6 second clips, social media, requires start_image.
- kwaivgi/kling-v2.1: Image-to-video with modes. Use for: Photo-to-video, video2video, requires start_image, 4-8 seconds.
- wan-video/wan-2.2-i2v-fast: Fast image-to-video. Use for: Quick animation from stills, 2-8 seconds, requires start_image.
- wan-video/wan-2.2-animate-replace: Character replacement. Use for: Swapping characters in videos, requires video + character_image.
- bytedance/seedance-1-pro: Character motion specialist. Use for: High-energy ads, character animation.
- bytedance/seedance-1-lite: Fast character motion. Use for: Quick character animation, budget-friendly.

Text-to-Speech (TTS):
- minimax-speech-02-hd: Fast, cost-effective. Use for: Quick voiceovers, general purpose, provider: "replicate".
- elevenlabs-tts: Premium quality voices. Use for: High-quality narrations, professional content, provider: "elevenlabs".
- dia-tts: Customizable, emotion control. Use for: Custom voices, emotion/speed/pitch control, provider: "dia".

Lip Sync:
- sievesync-1.1: Fast lipsync. Use for: Quick lipsync on existing videos, backend: "sievesync-1.1".
- bytedance/latentsync: High-quality lipsync. Use for: Professional lipsync, backend: "latentsync".
- wan-video/wan-2.2-s2v: Cinematic audio-driven video. Use for: Creating talking videos from images + audio, backend: "wan-2.2-s2v", requires prompt field.

Other Tools:
- enhance (topazlabs/image-upscale): Image upscaling, face enhancement. Use for: Quality improvement, upscaling (2x/4x/6x).
- background_remove: Remove backgrounds from videos. Use for: Video background removal.
- transcription (openai/gpt-4o-transcribe): Speech to text. Use for: Audio transcription, language detection.

MEDIA HANDLING:
- Uploaded images can be used as: reference images (input_images), start frames (start_image/image), or for modification
- Uploaded videos can be used as: source for lipsync, background removal, or character replacement
- Uploaded audio can be used as: source for lipsync or transcription
- Step outputs are referenced using: {{steps.STEP_ID.url}} for URLs, {{steps.STEP_ID.text}} for text
- Dependencies: If step B uses output from step A, set dependencies: ["step_a_id"]

ASPECT RATIO GUIDELINES:
- Mobile/Portrait: 9:16 (Instagram Stories, TikTok, Reels), 2:3 (mobile cards)
- Landscape: 16:9 (YouTube, widescreen), 21:9 (cinematic)
- Square: 1:1 (Instagram posts, social media)
- Auto-detect from user prompt keywords: "portrait", "vertical", "mobile" → 9:16 or 2:3; "landscape", "wide", "banner" → 16:9; "square" → 1:1

OUTPUT FORMAT (JSON only, no markdown):
{
  "summary": "Brief workflow description",
  "steps": [
    {
      "id": "unique-step-id",
      "title": "Human-readable step title",
      "tool": "image|video|tts|lipsync|enhance|background_remove|transcription",
      "model": "exact-model-id-from-list-above",
      "inputs": {
        "prompt": "DETAILED, SPECIFIC prompt ready to use - include exact text, composition, style, colors",
        ...other model-specific inputs (see model details above)
      },
      "outputType": "image|video|audio|text",
      "dependencies": ["previous-step-id-if-any"]
    }
  ]
}

PROMPT CREATION RULES:
✅ DO include:
- Exact text content if user specified: "featuring bold text 'SALE 50% OFF' in red Helvetica 72pt"
- Composition details: "product left side, text right side, white background, blue CTA button centered bottom"
- Style cues: "modern minimalist, soft shadows, clean typography"
- For video: motion description only (visuals come from start_image): "static camera, hands hold card facing viewer, subtle natural hand tremor, 4 seconds"
- For image modifications: "replace headline text with 'NEW TEXT' keeping same font and style"
- Hyper-specific details: colors, fonts, layouts, lighting, camera angles

❌ NEVER use generic phrases:
- "Use the provided image as the base"
- "Create a high-quality visual"
- "Professional image"
- "fits the request and brand tone"
- "integrate content cleanly"
- "Generate a stunning"

WORKFLOW EXAMPLES:

Example 1: Multiple Image Variations
User: "Create 3 product cards with Summer Sale 20% OFF, Winter Clearance, and New Arrivals"
{
  "summary": "Generate 3 product cards with different sale messages",
  "steps": [
    {
      "id": "img1",
      "title": "Summer Sale Card",
      "tool": "image",
      "model": "openai/gpt-image-1.5",
      "inputs": {
        "prompt": "Product card with clean white background, large bold text 'SUMMER SALE 20% OFF' in red Helvetica Bold 72pt centered top, product image below centered, blue CTA button at bottom with white text 'Shop Now'",
        "aspect_ratio": "2:3",
        "number_of_images": 1
      },
      "outputType": "image",
      "dependencies": []
    },
    {
      "id": "img2",
      "title": "Winter Clearance Card",
      "tool": "image",
      "model": "openai/gpt-image-1.5",
      "inputs": {
        "prompt": "Product card with clean white background, large bold text 'WINTER CLEARANCE' in navy blue Helvetica Bold 72pt centered top, product image below centered, orange CTA button at bottom with white text 'Shop Now'",
        "aspect_ratio": "2:3",
        "number_of_images": 1
      },
      "outputType": "image",
      "dependencies": []
    },
    {
      "id": "img3",
      "title": "New Arrivals Card",
      "tool": "image",
      "model": "openai/gpt-image-1.5",
      "inputs": {
        "prompt": "Product card with clean white background, large bold text 'NEW ARRIVALS' in black Helvetica Bold 72pt centered top, product image below centered, green CTA button at bottom with white text 'Shop Now'",
        "aspect_ratio": "2:3",
        "number_of_images": 1
      },
      "outputType": "image",
      "dependencies": []
    }
  ]
}

Example 2: Complete Workflow - Images + Videos + TTS
User: "Create 2 cards with texts, animate each into video, and create 2 audio files of a woman speaking the card content"
{
  "summary": "Generate 2 cards, animate them, and create voiceovers",
  "steps": [
    {
      "id": "img1",
      "title": "Card 1 with Text",
      "tool": "image",
      "model": "openai/gpt-image-1.5",
      "inputs": {
        "prompt": "Product card with white background, large text 'Question 1' in black centered",
        "aspect_ratio": "2:3",
        "number_of_images": 1
      },
      "outputType": "image",
      "dependencies": []
    },
    {
      "id": "img2",
      "title": "Card 2 with Text",
      "tool": "image",
      "model": "openai/gpt-image-1.5",
      "inputs": {
        "prompt": "Product card with white background, large text 'Question 2' in black centered",
        "aspect_ratio": "2:3",
        "number_of_images": 1
      },
      "outputType": "image",
      "dependencies": []
    },
    {
      "id": "vid1",
      "title": "Animate Card 1",
      "tool": "video",
      "model": "kwaivgi/kling-v2.1",
      "inputs": {
        "prompt": "Static camera, hands hold card still facing viewer, subtle natural hand tremor, card remains centered, 4 seconds",
        "start_image": "{{steps.img1.url}}",
        "aspect_ratio": "2:3",
        "duration": 4,
        "mode": "photo2video"
      },
      "outputType": "video",
      "dependencies": ["img1"]
    },
    {
      "id": "vid2",
      "title": "Animate Card 2",
      "tool": "video",
      "model": "kwaivgi/kling-v2.1",
      "inputs": {
        "prompt": "Static camera, hands hold card still facing viewer, subtle natural hand tremor, card remains centered, 4 seconds",
        "start_image": "{{steps.img2.url}}",
        "aspect_ratio": "2:3",
        "duration": 4,
        "mode": "photo2video"
      },
      "outputType": "video",
      "dependencies": ["img2"]
    },
    {
      "id": "tts1",
      "title": "Voiceover for Card 1",
      "tool": "tts",
      "model": "minimax-speech-02-hd",
      "inputs": {
        "text": "Question 1",
        "provider": "replicate"
      },
      "outputType": "audio",
      "dependencies": []
    },
    {
      "id": "tts2",
      "title": "Voiceover for Card 2",
      "tool": "tts",
      "model": "minimax-speech-02-hd",
      "inputs": {
        "text": "Question 2",
        "provider": "replicate"
      },
      "outputType": "audio",
      "dependencies": []
    }
  ]
}

Example 3: Lipsync from Image + Audio
User: "Create an image of a person, generate voiceover, then make them speak it"
{
  "summary": "Generate portrait, voiceover, and lipsync video",
  "steps": [
    {
      "id": "img1",
      "title": "Person Portrait",
      "tool": "image",
      "model": "openai/gpt-image-1.5",
      "inputs": {
        "prompt": "Professional portrait of a business person, front-facing, clear face, neutral expression, studio lighting, white background",
        "aspect_ratio": "1:1",
        "number_of_images": 1
      },
      "outputType": "image",
      "dependencies": []
    },
    {
      "id": "tts1",
      "title": "Voiceover",
      "tool": "tts",
      "model": "minimax-speech-02-hd",
      "inputs": {
        "text": "Welcome to our company. We offer the best solutions.",
        "provider": "replicate"
      },
      "outputType": "audio",
      "dependencies": []
    },
    {
      "id": "lipsync1",
      "title": "Talking Video",
      "tool": "lipsync",
      "model": "wan-video/wan-2.2-s2v",
      "inputs": {
        "video": "{{steps.img1.url}}",
        "audio": "{{steps.tts1.url}}",
        "backend": "wan-2.2-s2v",
        "prompt": "person speaking professionally, clear mouth movements"
      },
      "outputType": "video",
      "dependencies": ["img1", "tts1"]
    }
  ]
}

CRITICAL RULES:
1. TTS Detection: ALWAYS create TTS steps when user mentions: "audio files", "voiceover", "narration", "speaking", "text to speech", "generate voice", "woman/man speaking", "create audio"
2. One-to-One Mapping: If user wants to animate each image separately, create one video step per image step with matching dependencies
3. Text Content: TTS text should be EXACTLY the content to speak, nothing more - extract from user's request
4. Media Usage: Use uploaded media intelligently - as start frames, references, or for modification based on user intent
5. Model Selection: Choose models based on quality needs, speed requirements, and format constraints
6. Dependencies: Always set dependencies correctly - if step uses output from another step, reference it in dependencies array
7. Aspect Ratios: Auto-detect from user prompt or default to mobile (2:3 or 9:16) for social media content

Return ONLY valid JSON. No markdown, no explanation, no code fences.`;
}


export function buildRequestAnalyzerPrompt(): string {
  return `You are a senior production strategist. Read the request and surface what matters without forcing templates.

- Separate intent, constraints, and missing info.
- Keep prompts OUT of this stage; just describe what must be built.
- Describe motion like a director would, not as keywords.
- Respect uploaded media usage (start frame, reference, or to modify).
- Identify risks and open questions.
- CRITICAL: Detect if user wants to animate EACH image individually (one-to-one mapping)
- CRITICAL: Detect ALL audio/voice needs - if user mentions "audio", "speaking", "voiceover", "narration", "TTS", "text to speech", "woman/man speaking", "create audio files", "generate voice" → set totalTtsSteps accordingly

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
}

TTS DETECTION RULES:
- If user says "create X audio files" → totalTtsSteps = X
- If user says "woman/man speaking" or "generate voice" → totalTtsSteps = number of texts/content items
- If user says "voiceover", "narration", "TTS", "text to speech" → totalTtsSteps = number of content items or 1
- If user provides multiple text contents and mentions audio → totalTtsSteps = number of text contents
- Examples:
  * "create 2 audio files of a woman speaking" → totalTtsSteps = 2
  * "generate voiceover for each card" → totalTtsSteps = number of cards
  * "create audio speaking the card content" → totalTtsSteps = number of cards

MAPPING DETECTION:
- "one-to-one": User wants to animate EACH image separately (e.g., "create 4 images then animate each one")
- "one-to-many": Multiple videos from same image (e.g., "create 1 image then 3 videos from it")
- "none": No videos or no relationship`;
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

  return `You are a creative workflow architect. Break the request into atomic steps using the available tools. Write prompt OUTLINES that capture the user's specific intent and details - these will be expanded into full prompts in the next phase.

DO NOT USE THESE GENERIC PHRASES IN OUTLINES:
❌ "Use the provided image as the base"
❌ "Create a high-quality visual"
❌ "fits the request and brand tone"
❌ "integrate content cleanly"

Principles:
- One generation call = one step; no batching.
- Reuse uploaded media according to intent (start frame, reference, to modify). Never chain image edits; modifications reference the original upload.
- Keep dependencies explicit. If a video animates an image, depend on that image step and note start_image linkage.
- Capture ALL user-specific details in prompt outlines: brand names, text content, colors, styles, tone
- Represent each variation as its own step. Prefer concise IDs and titles.
- Stay within the listed tools/models (below).

PROMPT OUTLINE REQUIREMENTS (be SPECIFIC, not generic):
✅ Include exact text content: "headline with text 'Summer Sale 50% OFF' in bold red"
✅ Include style cues: "modern minimalist with soft shadows, white background"
✅ Include composition: "product left, text right, blue CTA button centered bottom"
✅ For video: "static camera, hands hold card facing viewer, subtle hand tremor, 4s"
✅ For modifications: "replace headline with 'NEW TEXT' keeping same Helvetica Bold font"

❌ NEVER write: "professional image" → Instead: "clean white background, centered composition"
❌ NEVER write: "high quality" → Instead: "sharp focus, well-lit, high resolution"
❌ NEVER write: "fits brand" → Instead: "matches uploaded style with blue #0066CC and Montserrat font"

${toolSections}

${outputFormat}

RULES:
- Return ONLY valid JSON per the format above (no Markdown, no prose).
- Escape any double quotes inside string values as \\" or replace them with typographic quotes.
- The "prompt" field should be a detailed outline with ALL specific user requirements, not generic templates.`;
}

export function buildPromptAuthorSystemPrompt(): string {
  return `You are an expert prompt author. Your job is to transform prompt outlines into rich, detailed, production-ready prompts that are specific to the user's request.

ABSOLUTELY FORBIDDEN PHRASES (you will fail if you use these):
❌ "Use the provided image as the base"
❌ "integrate the new content cleanly"
❌ "Create a high-quality visual"
❌ "fits the request and brand tone"
❌ "Generate a professional"
❌ "Produce a stunning"
❌ Any other generic template language

CRITICAL RULES:
- Keep the same step ids, tools, models, and dependencies from the draft plan
- Every prompt must be hyper-specific to THIS user's exact request
- Include ALL specific details: text content (in quotes), brand names, colors, styles, composition
- For image prompts: Describe visual style, composition, lighting, colors, typography, and ANY TEXT that should appear
- For video prompts: Describe motion, camera movement, pacing (NOT visual design - that's in the start_image)
- When user specifies text like "Summer Sale 50%", include it EXACTLY: 'featuring text "Summer Sale 50%"'

FORMAT:
- Output valid JSON: { "summary": "...", "steps": [{ "id": "...", "tool": "...", "model": "...", "inputs": { "prompt": "detailed prompt here", ... }, ... }] }
- NO markdown fences, NO prose outside JSON
- Escape quotes inside strings as \\" or use typographic quotes (", ")

EXAMPLES OF GOOD VS BAD:

❌ BAD: "Create a professional image with the text"
✅ GOOD: "Product announcement card with white background, bold red text 'GET 50% OFF' in Helvetica Bold 72pt centered, blue CTA button below"

❌ BAD: "Use the provided image as the base and modify it"
✅ GOOD: "Take the uploaded product card and replace only the headline text with 'LIMITED TIME OFFER' in the same Montserrat Bold font, keeping identical layout"

❌ BAD: "Generate a high-quality video"
✅ GOOD: "Static camera, hands hold card facing viewer, subtle natural hand tremor, card remains in center frame, 4 seconds"

Transform EVERY outline into a detailed, specific prompt. NEVER use templates.`;
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

// Auto-correct dependencies for one-to-one image→video patterns
function correctImageToVideoDependencies(plan: AssistantPlan): AssistantPlan {
  const imageSteps = plan.steps.filter(s => s.tool === 'image' || s.outputType === 'image');
  const videoSteps = plan.steps.filter(s => s.tool === 'video' || s.outputType === 'video');
  
  // Detect pattern: multiple images followed by multiple videos (equal count)
  if (imageSteps.length > 1 && videoSteps.length === imageSteps.length) {
    console.log(`[Dependencies] 🔗 Detected ${imageSteps.length} images → ${videoSteps.length} videos pattern`);
    console.log('[Dependencies] Applying one-to-one mapping...');
    
    // Map each video to its corresponding image
    const correctedSteps = plan.steps.map(step => {
      if (step.tool === 'video') {
        const videoIndex = videoSteps.indexOf(step);
        if (videoIndex >= 0 && videoIndex < imageSteps.length) {
          const correspondingImage = imageSteps[videoIndex];
          
          // Update dependencies
          const newDependencies = [correspondingImage.id];
          
          // Update start_image input
          const newInputs = {
            ...step.inputs,
            start_image: `{{steps.${correspondingImage.id}.url}}`,
          };
          
          console.log(`[Dependencies] ✓ Video "${step.title}" → Image "${correspondingImage.title}"`);
          
          return {
            ...step,
            dependencies: newDependencies,
            inputs: newInputs,
          };
        }
      }
      return step;
    });
    
    return { ...plan, steps: correctedSteps };
  }
  
  // Pattern: single image, multiple videos - all videos use the same image
  if (imageSteps.length === 1 && videoSteps.length > 1) {
    console.log(`[Dependencies] 🔗 Detected 1 image → ${videoSteps.length} videos pattern (shared source)`);
    const sourceImage = imageSteps[0];
    
    const correctedSteps = plan.steps.map(step => {
      if (step.tool === 'video') {
        console.log(`[Dependencies] ✓ Video "${step.title}" → Image "${sourceImage.title}"`);
        return {
          ...step,
          dependencies: [sourceImage.id],
          inputs: {
            ...step.inputs,
            start_image: `{{steps.${sourceImage.id}.url}}`,
          },
        };
      }
      return step;
    });
    
    return { ...plan, steps: correctedSteps };
  }
  
  return plan;
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
    // Avoid chaining image modifications: for image steps, only use uploads (not prior steps)
    const preferredImageSource = step.tool === 'image' ? null : (findDependencyByKind(step, 'image') || lastImageStep);
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
  const ttsMatch = lowerText.match(/(\d+)\s*(?:voiceovers?|narrations?|audio\s*files?|tts|text\s*to\s*speech)/);
  
  let images = imageMatch ? parseInt(imageMatch[1], 10) : 0;
  let videos = videoMatch ? parseInt(videoMatch[1], 10) : 0;
  let tts = ttsMatch ? parseInt(ttsMatch[1], 10) : 0;
  
  // Enhanced TTS detection - look for keywords even without explicit numbers
  if (tts === 0) {
    const ttsKeywords = [
      /create\s+\d*\s*audio\s*files?/i,
      /generate\s+\d*\s*voice/i,
      /woman\s+speaking/i,
      /man\s+speaking/i,
      /person\s+speaking/i,
      /speaking\s+the\s*(?:card|content|text)/i,
      /text\s*to\s*speech/i,
      /voiceover/i,
      /narration/i,
      /generate\s+voice/i,
    ];
    
    const hasTtsRequest = ttsKeywords.some(pattern => pattern.test(text));
    if (hasTtsRequest) {
      // Try to extract number from context
      const audioFilesMatch = text.match(/create\s+(\d+)\s*audio\s*files?/i);
      if (audioFilesMatch) {
        tts = parseInt(audioFilesMatch[1], 10);
      } else {
        // If user mentions speaking card content and has multiple cards, match TTS to card count
        const cardCountMatch = text.match(/(\d+)\s*(?:cards?|images?)/i);
        if (cardCountMatch && /speaking|audio|voice/i.test(text)) {
          tts = parseInt(cardCountMatch[1], 10);
        } else {
          // Default to 1 if TTS is mentioned but no count
          tts = 1;
        }
      }
    }
  }
  
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
      aspect_ratio: '2:3', // Default to mobile (will be auto-detected)
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
      aspect_ratio: '2:3', // Default to mobile (will be auto-detected)
      duration: 4,
      mode: 'default',
    },
    outputType: 'video',
    dependencies: [sourceImageStepId],
        suggestedParams: {},
  });
}

// Tools that require a 'prompt' field (TTS uses 'text' instead)
const TOOLS_REQUIRING_PROMPTS: AssistantToolKind[] = ['image', 'video', 'lipsync', 'enhance', 'background_remove'];

// Aspect ratio detection and selection functions

/**
 * Detects aspect ratio from user prompt text
 * Returns: '9:16' | '16:9' | '1:1' | '2:3' | '3:2' | null
 */
function detectAspectRatioFromPrompt(prompt: string): string | null {
  if (!prompt || typeof prompt !== 'string') return null;
  const text = prompt.toLowerCase();

  // Explicit aspect ratio mentions (e.g., "16:9", "9:16", "1:1")
  const explicitMatch = text.match(/\b(\d+:\d+)\b/);
  if (explicitMatch) {
    const ratio = explicitMatch[1];
    // Validate common ratios
    if (['1:1', '16:9', '9:16', '2:3', '3:2', '4:3', '3:4', '4:5', '5:4', '21:9', '9:21', '2:1', '1:2'].includes(ratio)) {
      return ratio;
    }
  }

  // Portrait/vertical indicators → prefer 9:16 or 2:3
  if (/\b(portrait|vertical|upright|tall|height|mobile|instagram|story|reel|tiktok|snapchat|phone|smartphone)\b/i.test(text)) {
    return '9:16'; // Prefer 9:16 for mobile/portrait
  }

  // Landscape/horizontal indicators → prefer 16:9
  if (/\b(landscape|horizontal|wide|widescreen|cinematic|cinema|film|movie|tv|television|banner|header|hero)\b/i.test(text)) {
    return '16:9';
  }

  // Square indicators → 1:1
  if (/\b(square|1:1|equal|same width and height)\b/i.test(text)) {
    return '1:1';
  }

  return null;
}

/**
 * Analyzes image aspect ratio from URL (server-side compatible)
 * Returns aspect ratio string or null if cannot determine
 */
async function analyzeImageAspectRatio(imageUrl: string): Promise<string | null> {
  try {
    // For server-side, we need to fetch image metadata
    // Use a lightweight approach: fetch first few bytes to get dimensions from headers/metadata
    // Or use a library, but for now we'll try to get dimensions from image metadata
    
    // Try to fetch image and read dimensions from response headers or image data
    const response = await fetch(imageUrl, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');
    
    if (!contentType?.startsWith('image/')) {
      return null;
    }

    // For most image formats, we need to read actual image data to get dimensions
    // This is a simplified approach - in production you might want to use a library like 'image-size'
    // For now, we'll return null and rely on prompt detection
    // The user can specify aspect ratio explicitly or we'll use defaults
    
    // Alternative: Try to fetch a small chunk and parse if it's a format we can read
    // For now, return null to fall back to prompt detection and defaults
    return null;
  } catch {
    return null;
  }
}

/**
 * Finds the closest available aspect ratio from model options
 * Returns the best match or default mobile ratio (9:16 or 2:3)
 */
function findClosestAspectRatio(
  desiredRatio: string | null,
  availableRatios: readonly string[],
  defaultToMobile: boolean = true
): string {
  if (!desiredRatio) {
    // Default to mobile (9:16 or 2:3)
    if (defaultToMobile) {
      if (availableRatios.includes('9:16')) return '9:16';
      if (availableRatios.includes('2:3')) return '2:3';
      if (availableRatios.includes('3:4')) return '3:4';
    }
    // Fallback to first available
    return availableRatios[0] || '1:1';
  }

  // Exact match
  if (availableRatios.includes(desiredRatio)) {
    return desiredRatio;
  }

  // Parse ratio to numeric value
  const parseRatio = (ratio: string): number => {
    if (ratio === 'match_input_image') return -1; // Special case
    const [w, h] = ratio.split(':').map(Number);
    return w && h ? w / h : 1;
  };

  const desiredValue = parseRatio(desiredRatio);
  if (desiredValue < 0) {
    // match_input_image - return it if available, otherwise default
    if (availableRatios.includes('match_input_image')) return 'match_input_image';
    // Default to mobile ratios
    if (defaultToMobile) {
      if (availableRatios.includes('9:16')) return '9:16';
      if (availableRatios.includes('2:3')) return '2:3'; // For GPT Image 1.5
      if (availableRatios.includes('3:4')) return '3:4';
    }
    return availableRatios[0] || '1:1';
  }

  // Find closest ratio by numeric value
  let closest = availableRatios[0];
  let minDiff = Infinity;

  for (const ratio of availableRatios) {
    if (ratio === 'match_input_image') continue;
    const ratioValue = parseRatio(ratio);
    const diff = Math.abs(ratioValue - desiredValue);
    if (diff < minDiff) {
      minDiff = diff;
      closest = ratio;
    }
  }

  // Final fallback: prefer mobile ratios if available
  if (defaultToMobile) {
    if (availableRatios.includes('9:16')) return '9:16';
    if (availableRatios.includes('2:3')) return '2:3'; // For GPT Image 1.5 (9:16 not available)
    if (availableRatios.includes('3:4')) return '3:4';
  }
  return closest || availableRatios[0] || '1:1';
}

/**
 * Gets available aspect ratios for a model
 */
function getAvailableAspectRatios(model: string, tool: AssistantToolKind): readonly string[] {
  if (tool === 'image') {
    if (model === 'openai/gpt-image-1.5') return IMAGE_RATIOS_GPT15;
    if (model.includes('flux') || model.includes('kontext') || model.includes('krea')) return IMAGE_RATIOS_FLUX;
    return IMAGE_RATIOS_SIMPLE;
  }
  if (tool === 'video') {
    return VIDEO_RATIOS;
  }
  return ['1:1', '16:9', '9:16'];
}

/**
 * Intelligently determines aspect ratio for a step
 */
async function determineAspectRatio(
  step: AssistantPlanStep,
  prompt: string,
  referenceImageUrl: string | undefined,
  availableRatios: readonly string[]
): Promise<string> {
  // 1. Check if user explicitly specified in prompt
  const promptRatio = detectAspectRatioFromPrompt(prompt);
  if (promptRatio) {
    return findClosestAspectRatio(promptRatio, availableRatios, true);
  }

  // 2. If reference image exists, analyze it
  if (referenceImageUrl) {
    const imageRatio = await analyzeImageAspectRatio(referenceImageUrl);
    if (imageRatio) {
      return findClosestAspectRatio(imageRatio, availableRatios, true);
    }
  }

  // 3. Default to mobile (9:16 or 2:3)
  return findClosestAspectRatio(null, availableRatios, true);
}

export async function normalizePlannerOutput(
  raw: any,
  messages: AssistantPlanMessage[],
  media: AssistantMedia[],
  analysis?: AnalyzedRequest | null,
): Promise<AssistantPlan> {
  // Coerce common malformed shapes into a plan-like object
  const coercePlan = (val: any): any | null => {
    if (!val) return null;

    // If it's already a valid plan, return it
    if (typeof val === 'object' && Array.isArray((val as any).steps)) {
      return val;
    }

    if (Array.isArray(val)) {
      // Look for plan objects in array
      const firstWithSteps = val.find(
        (item) => item && typeof item === 'object' && Array.isArray((item as any).steps),
      );
      if (firstWithSteps) return firstWithSteps;
      
      // Try to parse as JSON string array
      if (val.length > 0 && typeof val[0] === 'string') {
        const joined = val.join('');
        try {
          const parsed = JSON.parse(joined);
          const coerced = coercePlan(parsed);
          if (coerced) return coerced;
        } catch {
          // Not JSON, continue
        }
      }
    }

    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return coercePlan(parsed);
      } catch {
        return null;
      }
    }

    if (typeof val === 'object') {
      // Check for nested wrappers - extended list
      const nestedKeys = ['plan', 'output', 'result', 'data', 'response', 'body', 'content', 'message'];
      for (const key of nestedKeys) {
        if (val[key] !== undefined && val[key] !== null) {
          const nested = coercePlan(val[key]);
          if (nested) return nested;
        }
      }
      
      // Check if any property is a plan
      for (const key in val) {
        if (val.hasOwnProperty(key)) {
          const nested = coercePlan(val[key]);
          if (nested) return nested;
        }
      }
    }

    return null;
  };

  const planObj = coercePlan(raw);

  if (!planObj || !Array.isArray(planObj.steps)) {
    throw new Error('Planner output missing steps array');
  }

  const hasUploadedImage = media.some((m) => m.type === 'image');
  const firstImageUrl = media.find((m) => m.type === 'image')?.url;
  
  // Process and validate each step (async for aspect ratio detection)
  // Use Promise.allSettled to handle errors per-step instead of failing all steps
  const stepResults = await Promise.allSettled((planObj.steps as AssistantPlanStep[]).map(async (s, idx) => {
    const tool = (s.tool as AssistantToolKind) || 'image';
    console.log(`[Normalize] Processing step ${idx + 1}/${planObj.steps.length}: ${s.id} (${tool})`);
    
    // Extract prompt from various possible locations
    const rawPrompt = (s as any)?.prompt;
    const inputsFromStep = { ...(s.inputs || {}) };
    
    // Merge prompt from step level into inputs if not already there
    if (rawPrompt && typeof rawPrompt === 'string' && rawPrompt.trim() && !inputsFromStep.prompt) {
      inputsFromStep.prompt = rawPrompt.trim();
    }
    
    // Look for prompt in inputs (prefer 'prompt' over 'prompt_outline')
    // For TTS, we need 'text' instead of 'prompt'
    let prompt = inputsFromStep.prompt || inputsFromStep.prompt_outline || '';
    
    // TTS uses 'text' field, not 'prompt'
    if (tool === 'tts') {
      const text = inputsFromStep.text || '';
      if (text && !prompt) {
        // TTS doesn't need a prompt, it needs text - skip prompt validation
        prompt = text; // Use text as prompt for logging purposes, but validation will check text separately
      }
    }
    
    // Clean up the prompt
    if (typeof prompt === 'string') {
      prompt = prompt.trim();
    }

    // Fallback to analysis-based prompts only if truly missing
    if (!prompt && tool === 'video' && analysis?.videoSceneDescription) {
      console.warn(`[Normalize] Using fallback video prompt for step ${s.id}`);
      prompt = analysis.videoSceneDescription.trim();
    }

    if (!prompt && tool === 'image' && analysis?.imageModificationInstruction) {
      console.warn(`[Normalize] Using fallback image prompt for step ${s.id}`);
      const stepIndex = (planObj.steps as any[]).filter((st: any) => st.tool === 'image').indexOf(s);
      const contentVariation = analysis.contentVariations[stepIndex];
      prompt = contentVariation
        ? `${analysis.imageModificationInstruction} "${contentVariation}"`
        : analysis.imageModificationInstruction;
    }

    // Validate that we have required input based on tool type
    if (tool === 'tts') {
      // TTS requires 'text', not 'prompt'
      const text = inputsFromStep.text || '';
      if (!text || (typeof text === 'string' && text.trim().length === 0)) {
        console.error(`[Normalize] Missing text for TTS step ${s.id} (${s.title})`);
        throw new Error(`Missing text for TTS step ${s.id}`);
      }
    } else if (!prompt && TOOLS_REQUIRING_PROMPTS.includes(tool)) {
      // Other tools require 'prompt'
      console.error(`[Normalize] Missing prompt for step ${s.id} (${s.title})`);
      throw new Error(`Missing prompt for step ${s.id}`);
    }
    
    // Detect generic prompts and try to improve them (but don't fail)
    if (prompt && typeof prompt === 'string') {
      const genericPatterns = [
        /^Use the provided (image|video|media)/i,
        /^Create a (high-quality|professional|stunning)/i,
        /^Generate (a|an|the)/i,
        /^Produce (a|an|the)/i,
        /as the base and integrate/i,
        /fits the request and brand tone/i
      ];
      
      const isGeneric = genericPatterns.some(pattern => pattern.test(prompt));
      
      if (isGeneric) {
        console.warn(`[Normalize] ⚠️  Step ${s.id} has generic prompt: "${prompt.slice(0, 100)}..."`);
        
        // Try to build a better prompt from analysis if available
        if (tool === 'image' && analysis?.imageModificationInstruction) {
          const stepIndex = (planObj.steps as any[]).filter((st: any) => st.tool === 'image').indexOf(s);
          const contentVariation = analysis.contentVariations[stepIndex];
          if (contentVariation) {
            prompt = `${analysis.imageModificationInstruction} "${contentVariation}"`;
            console.log(`[Normalize] ✓ Replaced with analysis-based prompt: "${prompt.slice(0, 100)}..."`);
          }
        }
        
        // If still generic but we have content, at least it's something
        // Don't throw error - let it through but warn
        if (isGeneric) {
          console.warn(`[Normalize] ⚠️  Using potentially generic prompt for step ${s.id} - consider manual review`);
        }
      } else {
        console.log(`[Normalize] ✓ Step ${s.id} has specific prompt`);
      }
    }
    
    const inputs: Record<string, any> = { ...inputsFromStep };
    if (prompt) inputs.prompt = prompt;
    
    // Ensure uploaded image is referenced for modification tasks
    if (tool === 'image' && hasUploadedImage && analysis?.uploadedMediaUsage === 'to-modify') {
      if (!inputs.input_images && firstImageUrl) {
        inputs.input_images = [firstImageUrl];
      }
    }

    // Intelligently detect and set aspect ratio for image/video steps
    if ((tool === 'image' || tool === 'video') && !inputs.aspect_ratio) {
      const model = coerceString(s.model) || TOOL_SPECS[tool]?.models[0]?.id || '';
      const availableRatios = getAvailableAspectRatios(model, tool);
      
      // Find reference image: uploaded image or from dependency
      let referenceImageUrl: string | undefined = firstImageUrl;
      if (tool === 'video' && s.dependencies && s.dependencies.length > 0) {
        // For video, check if dependency is an image step
        const depStep = (planObj.steps as AssistantPlanStep[]).find(st => s.dependencies?.includes(st.id));
        if (depStep && depStep.tool === 'image') {
          // Will be resolved at runtime, but we can use uploaded image as fallback
          referenceImageUrl = firstImageUrl;
        }
      }
      
      // Combine prompt with user messages for better detection
      const allText = [
        prompt,
        ...messages.filter(m => m.role === 'user').map(m => m.content),
      ].filter(Boolean).join(' ');

      const detectedRatio = await determineAspectRatio(s, allText, referenceImageUrl, availableRatios);
      inputs.aspect_ratio = detectedRatio;
      console.log(`[Normalize] ✓ Detected aspect ratio for ${s.id}: ${detectedRatio} (from prompt analysis${referenceImageUrl ? ' and image analysis' : ''})`);
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
  }));

  // Process results - keep successful steps, log errors for failed ones
  const steps: AssistantPlanStep[] = [];
  const errors: string[] = [];
  
  stepResults.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      steps.push(result.value);
      console.log(`[Normalize] ✓ Step ${idx + 1} processed successfully: ${result.value.id}`);
    } else {
      const step = planObj.steps[idx];
      const errorMsg = result.reason?.message || 'Unknown error';
      errors.push(`Step ${step?.id || idx + 1} (${step?.tool || 'unknown'}): ${errorMsg}`);
      console.error(`[Normalize] ❌ Step ${idx + 1} failed: ${step?.id} - ${errorMsg}`);
      console.error(`[Normalize] Step data:`, JSON.stringify(step, null, 2).slice(0, 500));
    }
  });

  if (errors.length > 0) {
    console.warn(`[Normalize] ⚠️  ${errors.length} step(s) failed during normalization:`);
    errors.forEach(err => console.warn(`  - ${err}`));
  }

  if (steps.length === 0) {
    throw new Error(`All ${planObj.steps.length} steps failed normalization. Errors: ${errors.join('; ')}`);
  }

  if (steps.length < planObj.steps.length) {
    console.warn(`[Normalize] ⚠️  Only ${steps.length}/${planObj.steps.length} steps succeeded. Some steps were dropped due to errors.`);
  }

  // VALIDATION: Ensure TTS steps are created if analysis says they're needed
  if (analysis && analysis.totalTtsSteps > 0) {
    const existingTtsSteps = steps.filter(s => s.tool === 'tts');
    const missingTtsCount = analysis.totalTtsSteps - existingTtsSteps.length;
    
    if (missingTtsCount > 0) {
      console.warn(`[Normalize] ⚠️  Analysis requires ${analysis.totalTtsSteps} TTS steps but only ${existingTtsSteps.length} found. Creating ${missingTtsCount} missing TTS step(s)...`);
      
      // Find image steps to match TTS to content
      const imageSteps = steps.filter(s => s.tool === 'image');
      
      for (let i = 0; i < missingTtsCount; i++) {
        const ttsIndex = existingTtsSteps.length + i;
        const contentText = analysis.contentVariations?.[ttsIndex] || analysis.contentVariations?.[i] || '';
        
        if (contentText) {
          const ttsStep: AssistantPlanStep = normalizeInputs({
            id: `tts-${ttsIndex + 1}`,
            title: `Generate Audio ${ttsIndex + 1}`,
            tool: 'tts',
            model: 'minimax-speech-02-hd',
            inputs: {
              text: contentText,
              provider: 'replicate',
            },
            outputType: 'audio',
            dependencies: [],
          });
          
          steps.push(ttsStep);
          console.log(`[Normalize] ✓ Created TTS step ${ttsStep.id} with text: "${contentText.slice(0, 50)}..."`);
        } else {
          console.warn(`[Normalize] ⚠️  Cannot create TTS step ${ttsIndex + 1}: no content text available`);
        }
      }
    }
  }
  
  let finalPlan: AssistantPlan = {
      summary: typeof raw.summary === 'string' ? raw.summary : 'Generated workflow',
      steps,
  };
  
  // Auto-correct image→video dependencies
  finalPlan = correctImageToVideoDependencies(finalPlan);
  
  // Attach uploaded media
  finalPlan = attachMediaToPlan(finalPlan, media);
  
  return finalPlan;
}
