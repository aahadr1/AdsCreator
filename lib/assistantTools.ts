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

// NEW: Unified single-phase planner (combines decomposition + authoring)
export function buildUnifiedPlannerSystemPrompt(): string {
  const toolSections = Object.values(TOOL_SPECS)
    .map((tool) => {
      const models = tool.models.map((m) => `  - ${m.label} (${m.id})`).join('\n');
      return `### ${tool.label}\n${tool.description}\nModels:\n${models}`;
    })
    .join('\n\n');

  return `You are an expert workflow planner. Create executable plans with detailed, specific prompts ready for immediate use.

AVAILABLE TOOLS:
${toolSections}

OUTPUT FORMAT (JSON only, no markdown):
{
  "summary": "Brief workflow description",
  "steps": [
    {
      "id": "unique-id",
      "title": "Step title",
      "tool": "image|video|tts|lipsync|enhance|background_remove|transcription",
      "model": "exact-model-id-from-list",
      "inputs": {
        "prompt": "DETAILED, SPECIFIC prompt ready to use (NOT an outline)",
        ...other model-specific inputs
      },
      "outputType": "image|video|audio|text",
      "dependencies": ["previous-step-id"]
    }
  ]
}

PROMPT REQUIREMENTS:
✅ Include EXACT text if user specified it: "featuring bold text 'SALE 50% OFF' in red"
✅ Describe composition: "product left side, text right side, white background"
✅ For video: describe motion only (visuals are in start_image): "static camera, hands hold card, subtle tremor, 4s"
✅ Be hyper-specific to THIS request

❌ NEVER use: "Use the provided image", "high-quality", "professional", "fits brand tone"

EXAMPLES:

Example 1: Multiple variations
User: "Create 3 product cards with Summer Sale 20% OFF, Winter Clearance, and New Arrivals"
✅ Step 1 prompt: "Product card with clean white background, large bold text 'SUMMER SALE 20% OFF' in red Helvetica 72pt centered top, product image below, blue CTA button at bottom"
✅ Step 2 prompt: "Product card with clean white background, large bold text 'WINTER CLEARANCE' in navy blue Helvetica 72pt centered top, product image below, orange CTA button at bottom"

Example 2: Images + Videos (CRITICAL PATTERN)
User: "Create 4 cards with different texts, then animate each one into a video"
Plan:
{
  "steps": [
    {"id": "img1", "tool": "image", "inputs": {"prompt": "Card with text 'Question 1'"}},
    {"id": "img2", "tool": "image", "inputs": {"prompt": "Card with text 'Question 2'"}},
    {"id": "img3", "tool": "image", "inputs": {"prompt": "Card with text 'Question 3'"}},
    {"id": "img4", "tool": "image", "inputs": {"prompt": "Card with text 'Question 4'"}},
    {"id": "vid1", "tool": "video", "inputs": {"prompt": "Static camera, hands hold card", "start_image": "{{steps.img1.url}}"}, "dependencies": ["img1"]},
    {"id": "vid2", "tool": "video", "inputs": {"prompt": "Static camera, hands hold card", "start_image": "{{steps.img2.url}}"}, "dependencies": ["img2"]},
    {"id": "vid3", "tool": "video", "inputs": {"prompt": "Static camera, hands hold card", "start_image": "{{steps.img3.url}}"}, "dependencies": ["img3"]},
    {"id": "vid4", "tool": "video", "inputs": {"prompt": "Static camera, hands hold card", "start_image": "{{steps.img4.url}}"}, "dependencies": ["img4"]}
  ]
}
NOTE: Each video uses its corresponding image! Video 1→Image 1, Video 2→Image 2, etc.

Example 3: Lipsync with Wan 2.2 S2V (Cinematic Audio-Driven Video)
User: "Create an image of a person, generate voiceover, then make them speak it"
Plan:
{
  "steps": [
    {"id": "img1", "tool": "image", "inputs": {"prompt": "Professional portrait of a business person, front-facing, clear face"}},
    {"id": "tts1", "tool": "tts", "inputs": {"text": "Welcome to our company. We offer the best solutions."}},
    {
      "id": "lipsync1", 
      "tool": "lipsync", 
      "model": "wan-video/wan-2.2-s2v",
      "inputs": {
        "video": "{{steps.img1.url}}",
        "audio": "{{steps.tts1.url}}",
        "backend": "wan-2.2-s2v",
        "prompt": "person speaking professionally"
      },
      "dependencies": ["img1", "tts1"]
    }
  ]
}

LIPSYNC MODEL SELECTION GUIDE:
- Use "sievesync-1.1" for: Fast lipsync on existing videos
- Use "latentsync" for: High-quality lipsync on existing videos  
- Use "wan-2.2-s2v" for: Creating cinematic talking videos from images + audio (like "Infinite Talk")
  → Best when user wants to animate a static image to speak
  → Requires "prompt" field describing the video (e.g., "woman speaking", "man presenting")
  → Accepts images (first frame) OR videos as input

Return ONLY valid JSON. No markdown, no explanation.`;
}

export function buildUnifiedPlannerUserPrompt(
  messages: AssistantPlanMessage[],
  media: AssistantMedia[],
  analysis: AnalyzedRequest | null,
): string {
  const conversation = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const mediaLines = media.length > 0
    ? `\n\nATTACHED MEDIA:\n${media.map((m) => `- ${m.type}: ${m.url}${m.label ? ` (${m.label})` : ''}`).join('\n')}`
    : '';

  const analysisBlock = analysis
    ? [
        '\n\nANALYSIS:',
        analysis.goals ? `Goals: ${analysis.goals}` : null,
        analysis.contentVariations?.length ? `Content variations: ${analysis.contentVariations.join(' | ')}` : null,
        analysis.styleCues?.length ? `Style: ${analysis.styleCues.join(', ')}` : null,
        analysis.videoSceneDescription ? `Video motion: ${analysis.videoSceneDescription}` : null,
        `Expected: ${analysis.totalImageSteps} images, ${analysis.totalVideoSteps} videos`,
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return `${conversation}${mediaLines}${analysisBlock}

Generate the complete workflow plan with detailed, ready-to-use prompts. Return only valid JSON.`;
}

export function buildRequestAnalyzerPrompt(): string {
  return `You are a senior production strategist. Read the request and surface what matters without forcing templates.

- Separate intent, constraints, and missing info.
- Keep prompts OUT of this stage; just describe what must be built.
- Describe motion like a director would, not as keywords.
- Respect uploaded media usage (start frame, reference, or to modify).
- Identify risks and open questions.
- CRITICAL: Detect if user wants to animate EACH image individually (one-to-one mapping)

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

const TOOLS_REQUIRING_PROMPTS: AssistantToolKind[] = ['image', 'video', 'tts', 'lipsync', 'enhance', 'background_remove'];

export function normalizePlannerOutput(
  raw: any,
  messages: AssistantPlanMessage[],
  media: AssistantMedia[],
  analysis?: AnalyzedRequest | null,
): AssistantPlan {
  // Coerce common malformed shapes into a plan-like object
  const coercePlan = (val: any): any | null => {
    if (!val) return null;
    if (Array.isArray(val)) {
      const firstWithSteps = val.find((item) => item && typeof item === 'object' && Array.isArray((item as any).steps));
      if (firstWithSteps) return firstWithSteps;
    }
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return coercePlan(parsed);
      } catch {
        return null;
      }
    }
    if (typeof val === 'object' && Array.isArray((val as any).steps)) return val;
    return null;
  };

  const planObj = coercePlan(raw);

  if (!planObj || !Array.isArray(planObj.steps)) {
    throw new Error('Planner output missing steps array');
  }

  const hasUploadedImage = media.some((m) => m.type === 'image');
  const firstImageUrl = media.find((m) => m.type === 'image')?.url;
  
  // Process and validate each step
  let steps = (planObj.steps as AssistantPlanStep[]).map((s, idx) => {
    const tool = (s.tool as AssistantToolKind) || 'image';
    
    // Extract prompt from various possible locations
    const rawPrompt = (s as any)?.prompt;
    const inputsFromStep = { ...(s.inputs || {}) };
    
    // Merge prompt from step level into inputs if not already there
    if (rawPrompt && typeof rawPrompt === 'string' && rawPrompt.trim() && !inputsFromStep.prompt) {
      inputsFromStep.prompt = rawPrompt.trim();
    }
    
    // Look for prompt in inputs (prefer 'prompt' over 'prompt_outline')
    let prompt = inputsFromStep.prompt || inputsFromStep.prompt_outline || '';
    
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

    // Validate that we have a prompt
    if (!prompt && TOOLS_REQUIRING_PROMPTS.includes(tool)) {
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
