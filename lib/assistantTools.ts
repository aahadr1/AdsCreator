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
  sharedImageStyle?: string;
  sharedVideoMotion?: string;
  imageToVideoMapping: 'one-to-one' | 'one-to-many' | 'none';
  hasUploadedMedia: boolean;
  uploadedMediaUsage: 'as-start-frame' | 'as-reference' | 'to-modify' | 'none';
};

export function buildRequestAnalyzerPrompt(): string {
  return `You are an expert at analyzing creative production requests. Your job is to extract structured information about what the user wants to create.

## YOUR TASK
Analyze the user's message and extract:
1. EXACT counts of each output type requested
2. The specific content/text variations (if any)
3. How outputs relate to each other (e.g., videos from images)
4. Whether uploaded media should be used and how

## RULES FOR COUNTING
- "Create 4 images" → totalImageSteps: 4
- "Make a video" → totalVideoSteps: 1
- "4 cards then animate each" → totalImageSteps: 4, totalVideoSteps: 4
- "Generate 10 variations" → count based on context (images or videos)
- If no explicit count, assume 1
- "for each" or "each one" means 1:1 mapping between types

## RULES FOR CONTENT VARIATIONS
Extract EACH unique text/content that should appear in separate outputs.
Example: "cards with texts: Hello, World, Bye" → contentVariations: ["Hello", "World", "Bye"]

## RULES FOR UPLOADED MEDIA
- If user mentions "this image" or "my image" or attaches media → hasUploadedMedia: true
- "modify this image" → uploadedMediaUsage: "to-modify"
- "use as starting frame" → uploadedMediaUsage: "as-start-frame"
- "use as reference" → uploadedMediaUsage: "as-reference"

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
  "sharedImageStyle": "style description if all images share same style" | null,
  "sharedVideoMotion": "motion description if all videos share same motion" | null,
  "imageToVideoMapping": "one-to-one" | "one-to-many" | "none",
  "hasUploadedMedia": boolean,
  "uploadedMediaUsage": "as-start-frame" | "as-reference" | "to-modify" | "none"
}

## EXAMPLES

User: "Create 4 cards with different questions, then make a video for each"
Output:
{
  "totalImageSteps": 4,
  "totalVideoSteps": 4,
  "totalTtsSteps": 0,
  "totalTranscriptionSteps": 0,
  "totalLipsyncSteps": 0,
  "totalEnhanceSteps": 0,
  "totalBackgroundRemoveSteps": 0,
  "contentVariations": [],
  "sharedImageStyle": null,
  "sharedVideoMotion": null,
  "imageToVideoMapping": "one-to-one",
  "hasUploadedMedia": false,
  "uploadedMediaUsage": "none"
}

User: "Modify this image to add text 'A', 'B', 'C' on three versions"
Output:
{
  "totalImageSteps": 3,
  "totalVideoSteps": 0,
  "totalTtsSteps": 0,
  "totalTranscriptionSteps": 0,
  "totalLipsyncSteps": 0,
  "totalEnhanceSteps": 0,
  "totalBackgroundRemoveSteps": 0,
  "contentVariations": ["A", "B", "C"],
  "sharedImageStyle": null,
  "sharedVideoMotion": null,
  "imageToVideoMapping": "none",
  "hasUploadedMedia": true,
  "uploadedMediaUsage": "to-modify"
}

Now analyze the user's request.`;
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

  return `You are an expert workflow planner for a creative AI assistant. Your job is to decompose user requests into ATOMIC generation steps.

## CRITICAL RULES - READ CAREFULLY

### RULE 1: ATOMIC DECOMPOSITION
Each generation call = ONE step. Never batch multiple outputs into one step.
- User asks for "4 images" → Create 4 separate image steps
- User asks for "3 videos" → Create 3 separate video steps  
- User asks for "4 images then 4 videos from them" → Create 8 steps (4 image + 4 video)

### RULE 2: TOOL-SPECIFIC PROMPTS (CRITICAL)
Each tool type requires a DIFFERENT kind of prompt. NEVER mix concepts.

**IMAGE prompts must contain ONLY:**
- Visual description (subject, composition, framing)
- Style/aesthetic (lighting, colors, mood)
- Text to render ON the image (in "quotes")
- Materials, textures, background
- NEVER include: motion, animation, camera movement, video concepts

**VIDEO prompts must contain ONLY:**
- Motion description (how things move)
- Camera movement (dolly, pan, static, etc.)
- Pacing and timing
- Reference to start_image via dependency
- NEVER include: visual design, what to create, style descriptions (the start_image already has the visuals)

**TTS prompts:** The exact text to be spoken, nothing else.
**Transcription:** No prompt needed, just audio_file input.

### RULE 3: DEPENDENCY CHAINING
When a video animates an image, the video step MUST:
1. List the image step id in "dependencies" array
2. Set start_image to "{{steps.IMAGE_STEP_ID.url}}"
3. The video prompt describes ONLY motion, not visuals

### RULE 4: VARIABLE CONTENT
When user provides multiple text variations or content items:
- Create separate steps for each variation
- Each step gets its unique content in the prompt
- Use clear step IDs like "card-1", "card-2", "video-1", "video-2"

### RULE 5: MODEL CONSTRAINTS
- Kling v2.1: REQUIRES start_image, duration (4/6/8s), aspect_ratio
- GPT Image 1.5: max 10 reference images, supports text rendering
- Video models: prefer 4-6 second durations

## AVAILABLE TOOLS AND MODELS

${toolSections}

## EXAMPLE - CORRECT DECOMPOSITION

User: "Create 2 cards with text 'Hello' and 'World', then animate each"

Correct output (4 steps):
{
  "summary": "Create 2 card images with different text, then animate each into video",
  "steps": [
    {
      "id": "card-1",
      "title": "Card with Hello text",
      "tool": "image",
      "model": "openai/gpt-image-1.5",
      "inputs": {
        "prompt": "White card held by hands, clean modern typography showing \\"Hello\\" centered on the card, soft studio lighting, shallow depth of field",
        "aspect_ratio": "1:1"
      },
      "outputType": "image",
      "dependencies": []
    },
    {
      "id": "card-2", 
      "title": "Card with World text",
      "tool": "image",
      "model": "openai/gpt-image-1.5",
      "inputs": {
        "prompt": "White card held by hands, clean modern typography showing \\"World\\" centered on the card, soft studio lighting, shallow depth of field",
        "aspect_ratio": "1:1"
      },
      "outputType": "image",
      "dependencies": []
    },
    {
      "id": "video-1",
      "title": "Animate Hello card",
      "tool": "video",
      "model": "kwaivgi/kling-v2.1",
      "inputs": {
        "prompt": "Static camera, hands holding card steady facing camera, subtle natural hand trembling, card remains still and readable, 4 seconds",
        "start_image": "{{steps.card-1.url}}",
        "duration": 4,
        "aspect_ratio": "1:1"
      },
      "outputType": "video",
      "dependencies": ["card-1"]
    },
    {
      "id": "video-2",
      "title": "Animate World card",
      "tool": "video",
      "model": "kwaivgi/kling-v2.1",
      "inputs": {
        "prompt": "Static camera, hands holding card steady facing camera, subtle natural hand trembling, card remains still and readable, 4 seconds",
        "start_image": "{{steps.card-2.url}}",
        "duration": 4,
        "aspect_ratio": "1:1"
      },
      "outputType": "video",
      "dependencies": ["card-2"]
    }
  ]
}

${outputFormat}

Now analyze the user's request and create a properly decomposed plan.`;
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

// Helper to create an image step with proper prompts
function createImageStep(
  id: string,
  title: string,
  contentText: string | null,
  baseStyle: string,
  mediaUrl: string | undefined,
): AssistantPlanStep {
  let prompt = baseStyle;
  if (contentText) {
    prompt = `${baseStyle}, with text "${contentText}" displayed prominently on the card/image`;
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
  
  // Extract motion description from user request
  let motionDescription = 'Static camera, subject in frame, subtle natural motion, smooth and stable, 4 seconds';
  const motionMatch = userContent.match(/(?:camera|motion|movement|animate)[^.!?]*[.!?]/gi);
  if (motionMatch && motionMatch.length > 0) {
    // Clean up the motion description to remove visual/image concepts
    motionDescription = motionMatch.join(' ')
      .replace(/(?:create|generate|make|with text|showing|displaying|card|image)/gi, '')
      .trim() || motionDescription;
  }
  
  // Extract style from user request or use default
  let imageStyle = 'Clean white card design, professional product photography, soft studio lighting, shallow depth of field';
  if (hasUploadedImage) {
    imageStyle = 'Modify the provided image, maintaining the original style and composition';
  }
  
  const steps: AssistantPlanStep[] = [];
  const summary = `Create ${imageCount} image(s)${videoCount > 0 ? ` and ${videoCount} video(s)` : ''} based on user request`;
  
  // Create image steps
  for (let i = 0; i < imageCount; i++) {
    const stepId = imageCount > 1 ? `image-${i + 1}` : 'step-image';
    const contentText = contentItems[i] || null;
    const title = contentText 
      ? `Create image ${i + 1}: "${contentText.slice(0, 30)}${contentText.length > 30 ? '...' : ''}"`
      : `Create image ${i + 1}`;
    
    steps.push(createImageStep(
      stepId,
      title,
      contentText,
      imageStyle,
      firstImage?.url,
    ));
  }
  
  // Create video steps (one for each image if we have matching counts, or based on dependencies)
  for (let i = 0; i < videoCount; i++) {
    const sourceImageIndex = Math.min(i, imageCount - 1);
    const sourceImageId = imageCount > 1 ? `image-${sourceImageIndex + 1}` : 'step-image';
    const stepId = videoCount > 1 ? `video-${i + 1}` : 'step-video';
    const title = `Animate ${videoCount > 1 ? `video ${i + 1}` : 'to video'}`;
    
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
  
  // Process and validate each step
  let steps = (raw.steps as AssistantPlanStep[]).map((s, idx) => {
    const tool = (s.tool as AssistantToolKind) || 'image';
    const originalPrompt = s.inputs?.prompt;
    const cleanedPrompt = validateAndCleanPrompt(originalPrompt, tool);
    
    return normalizeInputs({
      id: s.id || `step-${idx + 1}`,
      title: s.title || `Step ${idx + 1}`,
      description: s.description || '',
      tool,
      model: coerceString(s.model) || TOOL_SPECS[tool]?.models[0]?.id || TOOL_SPECS.image.models[0].id,
      modelOptions: s.modelOptions,
      inputs: {
        ...s.inputs,
        prompt: cleanedPrompt,
      },
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
    const lastUser = messages.slice().reverse().find((m) => m.role === 'user');
    
    // Check if we need more image steps
    if (counts.image < analysis.totalImageSteps) {
      const missing = analysis.totalImageSteps - counts.image;
      const existingImageIds = steps.filter(s => s.tool === 'image').map(s => s.id);
      
      for (let i = 0; i < missing; i++) {
        const idx = counts.image + i + 1;
        const contentText = analysis.contentVariations[existingImageIds.length + i] || null;
        const newId = `image-${idx}`;
        
        steps.push(normalizeInputs({
          id: newId,
          title: contentText ? `Create image ${idx}: "${contentText.slice(0, 30)}..."` : `Create image ${idx}`,
          tool: 'image',
          model: 'openai/gpt-image-1.5',
          inputs: {
            prompt: contentText 
              ? `Professional image with text "${contentText}" displayed prominently, clean composition, soft lighting.`
              : 'Professional quality image, clean composition, soft lighting.',
            aspect_ratio: '1:1',
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
      
      for (let i = 0; i < missing; i++) {
        const idx = counts.video + i + 1;
        const sourceImageIdx = Math.min(counts.video + i, imageSteps.length - 1);
        const sourceImageId = imageSteps[sourceImageIdx]?.id || imageSteps[0]?.id;
        const newId = `video-${idx}`;
        
        steps.push(normalizeInputs({
          id: newId,
          title: `Animate video ${idx}`,
          tool: 'video',
          model: 'kwaivgi/kling-v2.1',
          inputs: {
            prompt: analysis.sharedVideoMotion || 'Static camera, subject in frame, subtle natural motion, smooth and stable, 4 seconds.',
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
