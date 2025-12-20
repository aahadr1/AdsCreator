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
  imageModificationInstruction?: string;  // e.g., "Replace the text on this card with"
  motionDescription?: string;              // e.g., "Hands holding card steady, facing camera"
  imageToVideoMapping: 'one-to-one' | 'one-to-many' | 'none';
  hasUploadedMedia: boolean;
  uploadedMediaUsage: 'as-start-frame' | 'as-reference' | 'to-modify' | 'none';
};

export function buildRequestAnalyzerPrompt(): string {
  return `You are an expert at analyzing creative production requests. Your job is to extract STRUCTURED information to build proper generation prompts.

## CRITICAL: SEPARATE CONCERNS
You MUST separate the user's request into distinct components:
1. **imageModificationInstruction** - What to do to images (e.g., "replace the text", "change the background", "add a logo")
2. **contentVariations** - The actual text/content items that vary per image (e.g., different questions, different names)
3. **motionDescription** - How things should MOVE in videos (camera, hands, subject motion) - NO visual/text content here
4. **counts** - How many of each output type

## RULES FOR MOTION DESCRIPTION (CRITICAL)
The motionDescription should contain ONLY movement/action words:
- Camera: "static", "dolly in", "pan left", "zoom"
- Subject motion: "hands trembling slightly", "holding steady", "walking"
- Pacing: "slow", "4 seconds", "gentle movement"

NEVER include in motionDescription:
- Text content ("Quel membre...", "Hello", etc.)
- Visual design ("white card", "blue background")
- What the image shows (that's in the start_image already)

## RULES FOR IMAGE MODIFICATION
When user says "modify this image" or "put text on", extract:
- imageModificationInstruction: The action (e.g., "Replace the text on this card with")
- contentVariations: Each unique text/content to apply

## OUTPUT FORMAT (JSON only):
{
  "totalImageSteps": number,
  "totalVideoSteps": number,
  "totalTtsSteps": number,
  "totalTranscriptionSteps": number,
  "totalLipsyncSteps": number,
  "totalEnhanceSteps": number,
  "totalBackgroundRemoveSteps": number,
  "contentVariations": ["text1", "text2", ...],
  "imageModificationInstruction": "what to do to each image" | null,
  "motionDescription": "ONLY camera/subject movement, NO text/visuals" | null,
  "imageToVideoMapping": "one-to-one" | "one-to-many" | "none",
  "hasUploadedMedia": boolean,
  "uploadedMediaUsage": "as-start-frame" | "as-reference" | "to-modify" | "none"
}

## EXAMPLE 1
User: "modify this image to put these texts on them, create 4 cards with each text, then animate each into videos where hands hold the card still facing camera with slight trembling. Texts: Hello, World, Foo, Bar"

Output:
{
  "totalImageSteps": 4,
  "totalVideoSteps": 4,
  "totalTtsSteps": 0,
  "totalTranscriptionSteps": 0,
  "totalLipsyncSteps": 0,
  "totalEnhanceSteps": 0,
  "totalBackgroundRemoveSteps": 0,
  "contentVariations": ["Hello", "World", "Foo", "Bar"],
  "imageModificationInstruction": "Replace the text on this card with",
  "motionDescription": "Hands holding card steady, facing camera, slight natural trembling, card stays still and readable, static camera",
  "imageToVideoMapping": "one-to-one",
  "hasUploadedMedia": true,
  "uploadedMediaUsage": "to-modify"
}

## EXAMPLE 2
User: "Create a product video with dolly-in motion"

Output:
{
  "totalImageSteps": 1,
  "totalVideoSteps": 1,
  "totalTtsSteps": 0,
  "totalTranscriptionSteps": 0,
  "totalLipsyncSteps": 0,
  "totalEnhanceSteps": 0,
  "totalBackgroundRemoveSteps": 0,
  "contentVariations": [],
  "imageModificationInstruction": null,
  "motionDescription": "Smooth dolly-in motion toward subject, professional pacing",
  "imageToVideoMapping": "one-to-one",
  "hasUploadedMedia": false,
  "uploadedMediaUsage": "none"
}

Now analyze the user's request. Extract motion description carefully - it should NEVER contain text content or visual descriptions.`;
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
        "prompt": "TOOL-SPECIFIC prompt (see rules below)",
        ...other tool-specific inputs
      },
      "outputType": "image|video|audio|text",
      "dependencies": ["id-of-step-this-depends-on"]
    }
  ]
}`;

  return `You are an expert workflow planner for a creative AI assistant. Your job is to decompose user requests into ATOMIC generation steps with PERFECT prompts.

## CRITICAL RULES - READ CAREFULLY

### RULE 1: ATOMIC DECOMPOSITION
Each generation call = ONE step. Never batch multiple outputs into one step.
- User asks for "4 images" → Create 4 separate image steps
- User asks for "4 images then 4 videos from them" → Create 8 steps (4 image + 4 video)

### RULE 2: IMAGE PROMPTS (CRITICAL)
When user wants to MODIFY an existing image (uploaded or referenced):
- Prompt format: "[modification instruction]: '[specific content for this variant]'"
- Example: "Replace the text on this card with: 'Hello World'"
- Example: "Change the background color to blue, keep the subject"

When user wants to CREATE a new image:
- Describe visuals: subject, composition, style, lighting, text to display
- Example: "Professional product photo of sneakers on white background, soft lighting"

NEVER include in image prompts: motion, animation, camera movement, video concepts

### RULE 3: VIDEO PROMPTS (CRITICAL - MOST IMPORTANT)
Video prompts describe ONLY motion and camera. The visual content is ALREADY in the start_image.

CORRECT video prompt: "Static camera, hands holding object steady, subtle natural trembling, subject stays still, 4 seconds"
WRONG video prompt: "White card with text Hello, hands holding..." (NO! Don't describe visuals)
WRONG video prompt: "Create a card showing..." (NO! The card already exists in start_image)

Video prompts should contain:
- Camera movement: static, dolly-in, pan, zoom, tracking
- Subject motion: hands trembling, walking, staying still
- Pacing: slow, fast, 4 seconds
- NOTHING about visual design, text content, colors, or what the image shows

### RULE 4: DEPENDENCY CHAINING
When a video animates an image:
1. Add image step id to "dependencies" array
2. Set start_image to "{{steps.IMAGE_STEP_ID.url}}"
3. Video prompt = motion ONLY

### RULE 5: USING PRE-ANALYSIS
When you receive a PRE-ANALYSIS section, use these fields:
- imageModificationInstruction: Use this as the base for image prompts
- contentVariations: Each image gets ONE of these in its prompt
- motionDescription: Use this EXACTLY for ALL video prompts (it's already cleaned)

## AVAILABLE TOOLS AND MODELS

${toolSections}

## EXAMPLE 1 - MODIFYING UPLOADED IMAGE WITH TEXT VARIATIONS

User request: "modify this image to put different texts: Hello, World, Bye"
Pre-analysis provides: imageModificationInstruction="Replace the text on this card with", contentVariations=["Hello","World","Bye"]

Correct output:
{
  "summary": "Modify uploaded image with 3 text variations",
  "steps": [
    {
      "id": "image-1",
      "tool": "image",
      "model": "openai/gpt-image-1.5",
      "inputs": { "prompt": "Replace the text on this card with: 'Hello'" },
      "dependencies": []
    },
    {
      "id": "image-2",
      "tool": "image", 
      "model": "openai/gpt-image-1.5",
      "inputs": { "prompt": "Replace the text on this card with: 'World'" },
      "dependencies": []
    },
    {
      "id": "image-3",
      "tool": "image",
      "model": "openai/gpt-image-1.5",
      "inputs": { "prompt": "Replace the text on this card with: 'Bye'" },
      "dependencies": []
    }
  ]
}

## EXAMPLE 2 - IMAGES THEN VIDEOS

User: "Create 2 cards, then animate each with hands holding them still"
Pre-analysis: motionDescription="Hands holding card steady, facing camera, subtle trembling, static camera"

Correct output:
{
  "summary": "Create 2 card images then animate each",
  "steps": [
    {
      "id": "card-1",
      "tool": "image",
      "inputs": { "prompt": "Card design with text 'Card 1', clean white background, professional lighting" },
      "dependencies": []
    },
    {
      "id": "card-2",
      "tool": "image",
      "inputs": { "prompt": "Card design with text 'Card 2', clean white background, professional lighting" },
      "dependencies": []
    },
    {
      "id": "video-1",
      "tool": "video",
      "inputs": {
        "prompt": "Hands holding card steady, facing camera, subtle trembling, static camera",
        "start_image": "{{steps.card-1.url}}",
        "duration": 4
      },
      "dependencies": ["card-1"]
    },
    {
      "id": "video-2",
      "tool": "video",
      "inputs": {
        "prompt": "Hands holding card steady, facing camera, subtle trembling, static camera",
        "start_image": "{{steps.card-2.url}}",
        "duration": 4
      },
      "dependencies": ["card-2"]
    }
  ]
}

Notice: ALL video prompts are IDENTICAL because they describe the same motion. Only the start_image differs.

${outputFormat}

Now analyze the user's request and create a properly decomposed plan with PERFECT prompts.`;
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

// Extract clean motion description from user text (NO text content, NO visual descriptions)
function extractMotionDescription(text: string): string {
  const defaultMotion = 'Static camera, subject in frame, subtle natural motion, smooth and stable, 4 seconds';
  
  // Look for motion-related phrases
  const motionKeywords = [
    'camera',
    'hands',
    'holding',
    'still',
    'trembling',
    'shaking',
    'steady',
    'motion',
    'movement',
    'facing',
    'dolly',
    'pan',
    'zoom',
    'static',
    'stable',
  ];
  
  // Find sentences containing motion keywords
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
  const motionSentences: string[] = [];
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    const hasMotionKeyword = motionKeywords.some(k => lowerSentence.includes(k));
    
    // Skip if it contains text content (quoted strings or looks like content)
    const hasQuotedContent = /["«»''""]/g.test(sentence);
    const hasTextInstruction = /(?:text|avec|with)\s*[:=]/i.test(sentence);
    
    if (hasMotionKeyword && !hasQuotedContent && !hasTextInstruction) {
      // Clean the sentence - remove visual/text-related words
      let cleaned = sentence
        .replace(/(?:card|image|text|showing|displaying|with text|create|generate|make|modify|put|replace)/gi, '')
        .replace(/["«»''"""][^"«»''"""]*["«»''""]/g, '') // Remove quoted content
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleaned.length > 10) {
        motionSentences.push(cleaned);
      }
    }
  }
  
  if (motionSentences.length > 0) {
    // Combine and clean
    let result = motionSentences.join(', ');
    // Final cleanup - remove any remaining problematic patterns
    result = result
      .replace(/,\s*,/g, ',')
      .replace(/^\s*,\s*/, '')
      .replace(/\s*,\s*$/, '')
      .trim();
    
    if (result.length > 15) {
      return result;
    }
  }
  
  return defaultMotion;
}

// Helper to create an image step with proper prompts
function createImageStep(
  id: string,
  title: string,
  contentText: string | null,
  modificationInstruction: string | null,
  mediaUrl: string | undefined,
): AssistantPlanStep {
  let prompt: string;
  
  if (modificationInstruction && contentText) {
    // User wants to modify image with specific text
    prompt = `${modificationInstruction}: "${contentText}"`;
  } else if (contentText) {
    // Create new image with specific text
    prompt = `Create an image displaying the text: "${contentText}"`;
  } else {
    // Generic image creation
    prompt = 'Professional product photography, clean composition, soft lighting';
  }
  
  return normalizeInputs({
    id,
    title,
    tool: 'image',
    model: 'openai/gpt-image-1.5',
    inputs: {
      prompt,
      aspect_ratio: '1:1',
      number_of_images: 1,
      input_images: mediaUrl ? [mediaUrl] : undefined,
    },
    outputType: 'image',
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
  const { isModification, instruction: modificationInstruction } = detectImageModification(userContent);
  
  // Extract clean motion description (no text content, no visuals)
  const motionDescription = extractMotionDescription(userContent);
  
  const steps: AssistantPlanStep[] = [];
  const summary = `${isModification ? 'Modify' : 'Create'} ${imageCount} image(s)${videoCount > 0 ? ` and animate ${videoCount} video(s)` : ''}`;
  
  // Create image steps
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
      isModification && hasUploadedImage ? modificationInstruction : null,
      firstImage?.url,
    ));
  }
  
  // Create video steps (one for each image if we have matching counts)
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
        motionDescription,
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
          prompt: motionDescription,
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
    // Return sensible defaults based on tool
    switch (tool) {
      case 'video':
        return 'Static camera, subject in frame, subtle natural motion, smooth and stable, 4 seconds duration.';
      case 'image':
        return 'Professional quality image, clean composition, soft lighting.';
      case 'tts':
        return 'Generate natural speech.';
      case 'lipsync':
        return 'Natural lip synchronization.';
      case 'enhance':
        return 'Enhance image quality.';
      case 'background_remove':
        return 'Remove background, preserve subject.';
      case 'transcription':
        return '';
      default:
        return 'Generate output.';
    }
  }

  let cleaned = prompt;

  // VIDEO prompts: Remove visual design language, keep only motion
  if (tool === 'video') {
    // Remove image creation language
    cleaned = cleaned.replace(/(?:create|generate|design|make|produce|render)\s+(?:a|an|the)?\s*(?:image|visual|picture|graphic|still|card|poster|photo)/gi, '');
    // Remove style descriptions that belong in image prompts
    cleaned = cleaned.replace(/(?:in|with)\s+(?:a\s+)?(?:cinematic|professional|modern|clean|minimal|elegant|beautiful)\s+(?:style|aesthetic|look)/gi, '');
    // Remove color/lighting descriptions that belong in image prompts
    cleaned = cleaned.replace(/(?:with|featuring)\s+(?:soft|warm|cool|bright|dark|dramatic)\s+(?:lighting|colors?|tones?)/gi, '');
    // Remove typography/text styling
    cleaned = cleaned.replace(/(?:with|showing|displaying)\s+(?:text|typography|lettering|words?)/gi, '');
    
    // If prompt is now too short or empty, provide a sensible default
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 20) {
      cleaned = 'Static camera, subject in frame, subtle natural motion, smooth and stable footage.';
    }
  }

  // IMAGE prompts: Remove motion/animation language
  if (tool === 'image') {
    cleaned = cleaned.replace(/(?:animate|animation|animating|motion|moving|movement|dolly|pan|zoom|tilt|camera\s+movement|video|clip)/gi, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
  }

  return cleaned;
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
    let prompt = s.inputs?.prompt || '';
    
    // For video steps, ensure the prompt is motion-only
    if (tool === 'video') {
      // If we have analysis with a clean motion description, prefer it
      if (analysis?.motionDescription) {
        prompt = analysis.motionDescription;
      } else {
        // Clean the existing prompt
        prompt = validateAndCleanPrompt(prompt, tool);
      }
    }
    
    // For image steps with modification instruction
    if (tool === 'image' && analysis?.imageModificationInstruction) {
      const stepIndex = (raw.steps as any[]).filter((st: any) => st.tool === 'image').indexOf(s);
      const contentVariation = analysis.contentVariations[stepIndex];
      if (contentVariation && !prompt.includes(contentVariation)) {
        prompt = `${analysis.imageModificationInstruction}: "${contentVariation}"`;
      }
    }
    
    const inputs: Record<string, any> = { ...s.inputs, prompt };
    
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
        
        let prompt: string;
        if (analysis.imageModificationInstruction && contentText) {
          prompt = `${analysis.imageModificationInstruction}: "${contentText}"`;
        } else if (contentText) {
          prompt = `Create an image displaying: "${contentText}"`;
        } else {
          prompt = 'Professional quality image, clean composition, soft lighting.';
        }
        
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
        
        steps.push(normalizeInputs({
          id: newId,
          title: `Animate video ${idx}`,
          tool: 'video',
          model: 'kwaivgi/kling-v2.1',
          inputs: {
            prompt: analysis.motionDescription || 'Static camera, subject in frame, subtle natural motion, smooth and stable, 4 seconds.',
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
