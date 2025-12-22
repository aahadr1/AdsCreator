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
    model: 'bytedance/seedream-4',
    defaults: { size: '2K', aspect_ratio: '1:1', sequential_image_generation: 'disabled', max_images: 1, enhance_prompt: false },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, helper: 'Text prompt for image generation' },
      { key: 'image_input', label: 'Input image(s) URLs (comma separated)', type: 'text', helper: 'List of 1-10 images for single or multi-reference generation' },
      { key: 'size', label: 'Image size', type: 'select', options: ['1K', '2K', '4K', 'custom'].map((s) => ({ value: s, label: s })), helper: '1K (1024px), 2K (2048px), 4K (4096px), or custom for specific dimensions' },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'select', options: ['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9', '9:21'].map((r) => ({ value: r, label: r })), helper: 'Use match_input_image to match input image aspect ratio' },
      { key: 'width', label: 'Custom width (px)', type: 'number', min: 1024, max: 4096, helper: 'Only used when size=custom. Range: 1024-4096 pixels' },
      { key: 'height', label: 'Custom height (px)', type: 'number', min: 1024, max: 4096, helper: 'Only used when size=custom. Range: 1024-4096 pixels' },
      { key: 'sequential_image_generation', label: 'Sequential generation', type: 'select', options: [{ value: 'disabled', label: 'Disabled' }, { value: 'auto', label: 'Auto' }], helper: 'Auto lets model decide whether to generate multiple related images' },
      { key: 'max_images', label: 'Max images', type: 'number', min: 1, max: 15, helper: 'Maximum number of images when sequential_image_generation=auto' },
      { key: 'enhance_prompt', label: 'Enhance prompt', type: 'select', options: [{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }], helper: 'Enable prompt enhancement for higher quality (takes longer)' },
    ],
  },
  {
    model: 'bytedance/seedream-4.5',
    defaults: { size: '2K', aspect_ratio: 'match_input_image', sequential_image_generation: 'disabled', max_images: 1 },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, helper: 'Text prompt for image generation' },
      { key: 'image_input', label: 'Input image(s) URLs (comma separated)', type: 'text', helper: 'List of 1-14 images for single or multi-reference generation' },
      { key: 'size', label: 'Image size', type: 'select', options: ['2K', '4K', 'custom'].map((s) => ({ value: s, label: s })), helper: '2K (2048px), 4K (4096px), or custom. Note: 1K not supported in 4.5' },
      { key: 'aspect_ratio', label: 'Aspect ratio', type: 'select', options: ['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9', '9:21'].map((r) => ({ value: r, label: r })), helper: 'Use match_input_image to match input image aspect ratio' },
      { key: 'width', label: 'Custom width (px)', type: 'number', min: 1024, max: 4096, helper: 'Only used when size=custom. Range: 1024-4096 pixels' },
      { key: 'height', label: 'Custom height (px)', type: 'number', min: 1024, max: 4096, helper: 'Only used when size=custom. Range: 1024-4096 pixels' },
      { key: 'sequential_image_generation', label: 'Sequential generation', type: 'select', options: [{ value: 'disabled', label: 'Disabled' }, { value: 'auto', label: 'Auto' }], helper: 'Auto lets model decide whether to generate multiple related images' },
      { key: 'max_images', label: 'Max images', type: 'number', min: 1, max: 15, helper: 'Maximum number of images when sequential_image_generation=auto' },
    ],
  },
  {
    model: 'bytedance/seededit-3.0',
    defaults: { guidance_scale: 5.5 },
    fields: [
      { key: 'image', label: 'Input image URL (required)', type: 'url', required: true, helper: 'Input image to edit' },
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, helper: 'Text prompt for image editing (e.g., "Change text to X", "Replace background")' },
      { key: 'guidance_scale', label: 'Guidance scale', type: 'number', helper: 'Prompt adherence. Higher = more literal interpretation' },
      { key: 'seed', label: 'Seed', type: 'number', helper: 'Random seed for reproducible generation' },
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
    model: 'wan-video/wan-2.5-i2v',
    defaults: { resolution: '720p', duration: 10, enable_prompt_expansion: true },
    fields: [
      { key: 'image', label: 'Input image URL (required)', type: 'url', required: true, helper: 'Input image for video generation' },
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, helper: 'Text prompt for video generation' },
      { key: 'negative_prompt', label: 'Negative prompt', type: 'textarea', helper: 'Negative prompt to avoid certain elements' },
      { key: 'audio', label: 'Audio file URL', type: 'url', helper: 'Audio file (wav/mp3, 3-30s, ≤15MB) for voice/music synchronization' },
      { key: 'resolution', label: 'Resolution', type: 'select', options: ['480p', '720p', '1080p'].map((r) => ({ value: r, label: r })) },
      { key: 'duration', label: 'Duration (s)', type: 'number', min: 1, max: 10, helper: 'Duration of the generated video in seconds' },
      { key: 'enable_prompt_expansion', label: 'Enable prompt expansion', type: 'select', options: [{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }], helper: 'Enable prompt optimizer for better results' },
      { key: 'seed', label: 'Seed', type: 'number', helper: 'Random seed for reproducible generation' },
    ],
  },
  {
    model: 'bytedance/omni-human-1.5',
    defaults: { fast_mode: true },
    fields: [
      { key: 'image', label: 'Image URL (required)', type: 'url', required: true, helper: 'Input image containing a human subject, face or character' },
      { key: 'audio', label: 'Audio URL (required)', type: 'url', required: true, helper: 'Input audio file (MP3, WAV, etc.). Duration must be less than 35 seconds' },
      { key: 'prompt', label: 'Prompt', type: 'textarea', helper: 'Optional prompt for precise control of scene, movements, camera movements. Supports multiple languages' },
      { key: 'fast_mode', label: 'Fast mode', type: 'select', options: [{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }], helper: 'Enable fast mode to speed up generation by sacrificing some effects' },
      { key: 'seed', label: 'Seed', type: 'number', helper: 'Random seed for reproducible generation' },
    ],
  },
  {
    model: 'lightricks/ltx-2-fast',
    defaults: { resolution: '1080p', duration: 6, generate_audio: false },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, helper: 'Text prompt describing the video to generate' },
      { key: 'image', label: 'First frame image URL', type: 'url', helper: 'Optional first frame image for image-to-video generation' },
      { key: 'resolution', label: 'Resolution', type: 'select', options: ['720p', '1080p'].map((r) => ({ value: r, label: r })), helper: 'Resolution quality of the generated video' },
      { key: 'duration', label: 'Duration (s)', type: 'select', options: [6, 8, 10].map((d) => ({ value: String(d), label: `${d}s` })), helper: 'Duration of video (6, 8, or 10 seconds). Durations > 10s only available with 1080p' },
      { key: 'generate_audio', label: 'Generate audio', type: 'select', options: [{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }], helper: 'Generate audio for the video' },
    ],
  },
  {
    model: 'lightricks/ltx-2-pro',
    defaults: { resolution: '1080p', duration: 6, generate_audio: false },
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, helper: 'Text prompt describing the video to generate' },
      { key: 'image', label: 'First frame image URL', type: 'url', helper: 'Optional first frame image for image-to-video generation' },
      { key: 'resolution', label: 'Resolution', type: 'select', options: ['720p', '1080p'].map((r) => ({ value: r, label: r })), helper: 'Resolution quality of the generated video' },
      { key: 'duration', label: 'Duration (s)', type: 'number', min: 6, max: 10, helper: 'Duration of the video in seconds' },
      { key: 'generate_audio', label: 'Generate audio', type: 'select', options: [{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }], helper: 'Generate audio for the video' },
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
  {
    model: 'jaaari/kokoro-82m',
    defaults: { voice: 'af_nicole', speed: 1 },
    fields: [
      { key: 'text', label: 'Text', type: 'textarea', required: true, helper: 'Text input (long text is automatically split)' },
      { key: 'voice', label: 'Voice', type: 'select', options: [
        { value: 'af_alloy', label: 'AF Alloy (Female US)' },
        { value: 'af_aoede', label: 'AF Aoede (Female US)' },
        { value: 'af_bella', label: 'AF Bella (Female US) - High Quality' },
        { value: 'af_jessica', label: 'AF Jessica (Female US)' },
        { value: 'af_kore', label: 'AF Kore (Female US)' },
        { value: 'af_nicole', label: 'AF Nicole (Female US) - Default' },
        { value: 'af_nova', label: 'AF Nova (Female US)' },
        { value: 'af_river', label: 'AF River (Female US)' },
        { value: 'af_sarah', label: 'AF Sarah (Female US)' },
        { value: 'af_sky', label: 'AF Sky (Female US)' },
        { value: 'am_adam', label: 'AM Adam (Male US)' },
        { value: 'am_echo', label: 'AM Echo (Male US)' },
        { value: 'am_eric', label: 'AM Eric (Male US)' },
        { value: 'am_fenrir', label: 'AM Fenrir (Male US)' },
        { value: 'am_liam', label: 'AM Liam (Male US)' },
        { value: 'am_michael', label: 'AM Michael (Male US)' },
        { value: 'am_onyx', label: 'AM Onyx (Male US)' },
        { value: 'am_puck', label: 'AM Puck (Male US)' },
        { value: 'bf_alice', label: 'BF Alice (Female UK)' },
        { value: 'bf_emma', label: 'BF Emma (Female UK)' },
        { value: 'bf_isabella', label: 'BF Isabella (Female UK)' },
        { value: 'bf_lily', label: 'BF Lily (Female UK)' },
        { value: 'bm_daniel', label: 'BM Daniel (Male UK)' },
        { value: 'bm_fable', label: 'BM Fable (Male UK)' },
        { value: 'bm_george', label: 'BM George (Male UK)' },
        { value: 'bm_lewis', label: 'BM Lewis (Male UK)' },
      ], helper: 'Voice to use for synthesis. Supports US English and UK English voices' },
      { key: 'speed', label: 'Speed', type: 'number', min: 0.5, max: 2.0, helper: 'Speech speed multiplier (0.5 = half speed, 2.0 = double speed)' },
    ],
  },
  {
    model: 'wavespeed-ai/infinitetalk',
    defaults: { resolution: '480p', seed: -1 },
    fields: [
      { key: 'image', label: 'Image URL', type: 'url', required: true, helper: 'Image of person to animate' },
      { key: 'audio', label: 'Audio URL', type: 'url', required: true, helper: 'Audio for lipsync' },
      { key: 'prompt', label: 'Prompt (optional)', type: 'textarea', required: false, helper: 'Describe expression, style, or pose' },
      { key: 'mask_image', label: 'Mask Image URL (optional)', type: 'url', required: false, helper: 'Specify which regions can move (do NOT use full image)' },
      { key: 'resolution', label: 'Resolution', type: 'select', options: [{ value: '480p', label: '480p' }, { value: '720p', label: '720p' }], required: false },
      { key: 'seed', label: 'Seed', type: 'number', required: false, helper: '-1 for random' },
    ],
  },
  {
    model: 'wavespeed-ai/infinitetalk/multi',
    defaults: { resolution: '480p', seed: -1, order: 'meanwhile' },
    fields: [
      { key: 'image', label: 'Image URL', type: 'url', required: true, helper: 'Image with two people clearly visible' },
      { key: 'left_audio', label: 'Left Audio URL', type: 'url', required: true, helper: 'Audio for person on the left' },
      { key: 'right_audio', label: 'Right Audio URL', type: 'url', required: true, helper: 'Audio for person on the right' },
      { key: 'order', label: 'Speaking Order', type: 'select', options: [
        { value: 'meanwhile', label: 'Meanwhile (both at same time)' },
        { value: 'left_right', label: 'Left to Right (left first, then right)' },
        { value: 'right_left', label: 'Right to Left (right first, then left)' },
      ], required: false },
      { key: 'prompt', label: 'Prompt (optional)', type: 'textarea', required: false, helper: 'Describe additional visual elements' },
      { key: 'resolution', label: 'Resolution', type: 'select', options: [{ value: '480p', label: '480p' }, { value: '720p', label: '720p' }], required: false },
      { key: 'seed', label: 'Seed', type: 'number', required: false, helper: '-1 for random' },
    ],
  },
  {
    model: 'wavespeed-ai/infinitetalk/video-to-video',
    defaults: { resolution: '480p', seed: -1 },
    fields: [
      { key: 'video', label: 'Video URL', type: 'url', required: true, helper: 'Base video for lipsync' },
      { key: 'audio', label: 'Audio URL', type: 'url', required: true, helper: 'Audio for lipsync' },
      { key: 'prompt', label: 'Prompt (optional)', type: 'textarea', required: false, helper: 'Describe style, pose, or expressions' },
      { key: 'mask_image', label: 'Mask Image URL (optional)', type: 'url', required: false, helper: 'Specify which regions can move (do NOT use full image)' },
      { key: 'resolution', label: 'Resolution', type: 'select', options: [{ value: '480p', label: '480p' }, { value: '720p', label: '720p' }], required: false },
      { key: 'seed', label: 'Seed', type: 'number', required: false, helper: '-1 for random' },
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
      { id: 'bytedance/seedream-4', label: 'Seedream 4', defaultInputs: { size: '2K', aspect_ratio: '1:1' } },
      { id: 'bytedance/seedream-4.5', label: 'Seedream 4.5', defaultInputs: { size: '2K', aspect_ratio: 'match_input_image' } },
      { id: 'bytedance/seededit-3.0', label: 'Seededit 3.0', defaultInputs: { guidance_scale: 5.5 } },
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
      { id: 'wan-video/wan-2.5-i2v', label: 'WAN 2.5 i2v', defaultInputs: { resolution: '720p', duration: 10 } },
      { id: 'bytedance/omni-human-1.5', label: 'Omni Human 1.5', defaultInputs: { fast_mode: true } },
      { id: 'lightricks/ltx-2-fast', label: 'LTX 2 Fast', defaultInputs: { resolution: '1080p', duration: 6 } },
      { id: 'lightricks/ltx-2-pro', label: 'LTX 2 Pro', defaultInputs: { resolution: '1080p', duration: 6 } },
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
        { value: 'wavespeed-ai/infinitetalk', label: 'InfiniteTalk (Image + Audio)' },
        { value: 'wavespeed-ai/infinitetalk/multi', label: 'InfiniteTalk Multi (2 Characters)' },
        { value: 'wavespeed-ai/infinitetalk/video-to-video', label: 'InfiniteTalk Video-to-Video' },
      ], required: true },
      { key: 'prompt', label: 'Prompt (optional)', type: 'textarea', required: false, helper: 'Describe video content (e.g., "woman speaking", "man singing") - for Wan S2V and InfiniteTalk models' },
      { key: 'num_frames_per_chunk', label: 'Frames per chunk (Wan S2V)', type: 'number', required: false, helper: 'Default: 81' },
      { key: 'interpolate', label: 'Interpolate to 25fps (Wan S2V)', type: 'text', required: false, helper: 'true/false' },
      { key: 'left_audio', label: 'Left Audio URL (InfiniteTalk Multi)', type: 'url', required: false, helper: 'Audio for the person on the left' },
      { key: 'right_audio', label: 'Right Audio URL (InfiniteTalk Multi)', type: 'url', required: false, helper: 'Audio for the person on the right' },
      { key: 'order', label: 'Speaking Order (InfiniteTalk Multi)', type: 'select', options: [
        { value: 'meanwhile', label: 'Meanwhile' },
        { value: 'left_right', label: 'Left to Right' },
        { value: 'right_left', label: 'Right to Left' },
      ], required: false, helper: 'Order of audio sources' },
      { key: 'resolution', label: 'Resolution (InfiniteTalk)', type: 'select', options: [
        { value: '480p', label: '480p' },
        { value: '720p', label: '720p' },
      ], required: false, helper: 'Output video resolution' },
      { key: 'seed', label: 'Seed (InfiniteTalk)', type: 'number', required: false, helper: '-1 for random' },
      { key: 'mask_image', label: 'Mask Image (InfiniteTalk)', type: 'url', required: false, helper: 'Optional mask image to specify regions to animate' },
    ],
    models: [
      { id: 'sievesync-1.1', label: 'Sieve Sync 1.1' },
      { id: 'bytedance/latentsync', label: 'LatentSync' },
      { id: 'wan-video/wan-2.2-s2v', label: 'Wan 2.2 S2V (Cinematic)' },
      { id: 'wavespeed-ai/infinitetalk', label: 'InfiniteTalk (Image + Audio)' },
      { id: 'wavespeed-ai/infinitetalk/multi', label: 'InfiniteTalk Multi (2 Characters)' },
      { id: 'wavespeed-ai/infinitetalk/video-to-video', label: 'InfiniteTalk Video-to-Video' },
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
      { id: 'jaaari/kokoro-82m', label: 'Kokoro 82M', defaultInputs: { voice: 'af_nicole', speed: 1 } },
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
          useCases = '      Use cases: Product cards with text, marketing visuals, social media posts, high-quality brand imagery. Best for: Typography fidelity, reference image support (up to 10). CRITICAL: Only accepts aspect ratios: "1:1", "3:2", "2:3" (default: "2:3").';
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
        } else if (model.id.includes('infinitetalk/multi')) {
          useCases = '      Use cases: Multi-character talking videos, conversations, duets, interviews. Best for: Two people in one image with separate audio tracks, up to 10 minutes, 480p/720p. Requires: image with two people, left_audio, right_audio, order (meanwhile/left_right/right_left).';
        } else if (model.id.includes('infinitetalk/video-to-video')) {
          useCases = '      Use cases: Lipsync existing videos with new audio, video redubbing. Best for: Replacing audio in existing videos, up to 10 minutes, 480p/720p. Requires: video, audio. Optional: mask_image (do NOT use full image), prompt for style control.';
        } else if (model.id.includes('infinitetalk')) {
          useCases = '      Use cases: Image-to-video talking avatars, single character lipsync from photos. Best for: Creating talking videos from static photos, up to 10 minutes, 480p/720p. Requires: image, audio. Optional: mask_image (do NOT use full image), prompt for expression/style/pose control.';
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
- openai/gpt-image-1.5: Best overall quality, typography fidelity, reference image support (up to 10). CRITICAL: Only accepts aspect ratios: "1:1", "3:2", "2:3" (default: "2:3"). Use for: Product cards, marketing visuals, text-heavy images.
- black-forest-labs/flux-kontext-max: Wide format specialist, contextual understanding. Use for: Banners, landscape visuals, wide compositions (16:9, 21:9, etc.).
- black-forest-labs/flux-krea-dev: Square format optimized, multiple outputs (1-4). Use for: Instagram posts, square social media, balanced compositions.
- google/nano-banana: Fast generation, lightweight. Use for: Quick iterations, simple images, speed priority.
- google/nano-banana-pro: Enhanced Nano Banana with aspect ratio control. Use for: Fast generation with format control.
- bytedance/seedream-4: Unified text-to-image and image editing, multi-reference support (1-10 images), up to 4K. Use for: Complex compositions, image editing, batch generation, style transfer.
- bytedance/seedream-4.5: Upgraded Seedream with stronger spatial understanding, cinematic aesthetics, up to 4K (no 1K). Use for: High-quality professional content, e-commerce, film/advertising, architectural design.
- bytedance/seededit-3.0: Text-guided image editing, preserves original details while making targeted modifications. Use for: Lighting changes, object removal, style conversion, text replacement in existing images.

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
- wan-video/wan-2.5-i2v: Alibaba Wan 2.5 image-to-video with background audio, up to 10s, 480p/720p/1080p. Use for: Audio-synchronized video from images, voice/music sync, requires image + prompt, optional audio input.
- bytedance/omni-human-1.5: Film-grade digital human from image + audio (<35s). Use for: Realistic talking head videos, character-driven content, portrait animation with audio lip-sync.
- lightricks/ltx-2-fast: Lightning-fast video generation (6-10s) with auto-synced audio, 720p/1080p. Use for: Instant ideation, rapid prototyping, mobile workflows, storyboarding, text-to-video with audio.
- lightricks/ltx-2-pro: High visual fidelity with fast turnaround (6-10s), 720p/1080p. Use for: Daily content creation, marketing teams, iterative creative workflows, professional quality.
- bytedance/seedance-1-pro: Character motion specialist. Use for: High-energy ads, character animation.
- bytedance/seedance-1-lite: Fast character motion. Use for: Quick character animation, budget-friendly.

Text-to-Speech (TTS):
- minimax-speech-02-hd: Fast, cost-effective. Use for: Quick voiceovers, general purpose, provider: "replicate".
- elevenlabs-tts: Premium quality voices. Use for: High-quality narrations, professional content, provider: "elevenlabs".
- dia-tts: Customizable, emotion control. Use for: Custom voices, emotion/speed/pitch control, provider: "dia".
- jaaari/kokoro-82m: Lightweight 82M param model, 46 voices (US/UK English, French, Hindi, Italian, Japanese, Chinese), Apache-licensed. Use for: Fast TTS, cost-effective voiceovers, multilingual content, mobile workflows. Speed control: 0.5-2.0x.

Lip Sync:
- sievesync-1.1: Fast lipsync. Use for: Quick lipsync on existing videos, backend: "sievesync-1.1".
- bytedance/latentsync: High-quality lipsync. Use for: Professional lipsync, backend: "latentsync".
- wan-video/wan-2.2-s2v: Cinematic audio-driven video. Use for: Creating talking videos from images + audio, backend: "wan-2.2-s2v", requires prompt field.
- wavespeed-ai/infinitetalk: Image-to-video talking avatars. Use for: Single character talking videos from static photos, up to 10 minutes, 480p/720p, backend: "wavespeed-ai/infinitetalk", requires: image, audio. Optional: prompt, mask_image (do NOT use full image), resolution, seed.
- wavespeed-ai/infinitetalk/multi: Multi-character talking videos. Use for: Two people in one image with separate audio tracks, conversations, duets, up to 10 minutes, 480p/720p, backend: "wavespeed-ai/infinitetalk/multi", requires: image (with two people), left_audio, right_audio. Optional: order (meanwhile/left_right/right_left), prompt, resolution, seed.
- wavespeed-ai/infinitetalk/video-to-video: Video-to-video lipsync. Use for: Lipsyncing existing videos with new audio, video redubbing, up to 10 minutes, 480p/720p, backend: "wavespeed-ai/infinitetalk/video-to-video", requires: video, audio. Optional: prompt, mask_image (do NOT use full image), resolution, seed.

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
   - If user says "create a text to speech" or "generate voiceover" → you MUST include a TTS step
   - If user mentions multiple audio files → create one TTS step per audio file
   - TTS steps use "text" field in inputs, NOT "prompt"
2. One-to-One Mapping: If user wants to animate each image separately, create one video step per image step with matching dependencies
3. Text Content: TTS text should be EXACTLY the content to speak, nothing more - extract from user's request or create appropriate script
4. Media Usage: Use uploaded media intelligently - as start frames, references, or for modification based on user intent
5. Model Selection: Choose models based on quality needs, speed requirements, and format constraints
6. Dependencies: Always set dependencies correctly - if step uses output from another step, reference it in dependencies array
7. Aspect Ratios: Auto-detect from user prompt or default to mobile (2:3 or 9:16) for social media content
8. Complete Workflows: If user requests multiple steps (e.g., image + TTS + lipsync), you MUST include ALL steps in your response

JSON FORMAT REQUIREMENTS (CRITICAL):
- Return ONLY valid JSON - no markdown code fences, no code blocks, no explanations
- Start with { and end with }
- The "steps" array MUST contain ALL steps the user requested
- Each step MUST have: id, title, tool, model, inputs, outputType, dependencies
- For TTS steps: inputs must contain "text" (not "prompt") and "provider": "replicate"
- For image/video steps: inputs must contain "prompt" with detailed description
- For lipsync steps: inputs must contain "video", "audio", "backend", and optionally "prompt"
- Dependencies array must be an array (even if empty: [])
- All string values must be properly escaped (use \\" for quotes inside strings)

VALIDATION CHECKLIST BEFORE RETURNING:
✓ Does the JSON parse correctly?
✓ Are ALL requested steps included? (Check: images, videos, TTS, lipsync, etc.)
✓ Do TTS steps have "text" field (not "prompt")?
✓ Do image/video steps have "prompt" field?
✓ Are dependencies correctly set?
✓ Is the JSON valid (no trailing commas, proper escaping)?

Return ONLY valid JSON. No markdown, no explanation, no code fences.

================================================================================
DETAILED MODEL REFERENCE GUIDE - VALIDATION RULES AND INPUT SPECIFICATIONS
================================================================================

CRITICAL: The assistant must validate all inputs before creating steps. Never guess inputs; validate that every required field is provided and within allowed ranges/enumerations. Use sensible defaults for optional fields. Select aspect ratios/resolutions that match the intended output medium.

IMAGE GENERATION MODELS:

1. openai/gpt-image-1.5 – GPT Image 1.5
   Required: prompt (string) – describe the image. Use descriptive phrases; avoid banned content.
   Aspect ratio: MUST be one of: "1:1", "3:2", "2:3". Default: "2:3" (mobile-friendly).
   Quality: enum "low" | "medium" | "high" | "auto" (default: "auto").
   Background: enum "auto" | "transparent" | "opaque" (default: "auto").
   Moderation: enum "auto" | "low" (default: "auto").
   Image editing: If input_images array provided, input_fidelity must be "low" or "high" (default: "low"), aspect ratio inherited from first image.
   Output format: enum "png" | "jpeg" | "webp" (default: "webp").
   Number of images: integer 1–10 (default: 1).
   Output compression: integer 0–100 (default: 90).
   Optional: openai_api_key (string) for higher rate limits.

2. black-forest-labs/flux-kontext-max – Flux Kontext Max
   Required: prompt (string).
   Optional: input_image (URI). If provided, aspect_ratio MUST be "match_input_image".
   Aspect ratio: enum "match_input_image" | "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3" | "4:5" | "5:4" | "21:9" | "9:21" | "2:1" | "1:2" (default: "match_input_image").
   Output format: enum "jpg" | "png" (default: "png").
   Safety tolerance: integer 0–6 (default: 2, strict). If input_image provided, MUST NOT exceed 2.
   Prompt upsampling: boolean (default: false) – enriches prompts but increases time.
   Optional: seed (integer).

3. black-forest-labs/flux-krea-dev – Flux Krea Dev
   Required: prompt (string).
   Optional: image (URI) for image-to-image; output aspect ratio matches this image.
   Guidance: float 0–10 (default: 4.5) – lower = more realistic.
   Go fast: boolean (default: true) – faster but lower fidelity.
   Outputs: num_outputs integer 1–4 (default: 1), num_inference_steps integer 1–50 (default: 28).
   Aspect ratio: enum "1:1" | "16:9" | "21:9" | "3:2" | "2:3" | "4:3" | "3:4" | "4:5" | "5:4" | "9:16" | "9:21" (default: "1:1").
   Output format: enum "webp" | "jpg" | "png" (default: "webp").
   Output quality: integer 0–100 (default: 80).
   Prompt strength: float 0–1 (default: 0.8) – controls blending with input image.
   Safety checker: disable_safety_checker boolean (default: false).

4. google/nano-banana – Nano Banana
   Required: prompt (string).
   Image inputs: image_input (array of URIs) – multiple images to blend (default: empty array).
   Aspect ratio: enum "match_input_image" | "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "5:4" | "9:16" | "16:9" | "21:9" (if images provided, use "match_input_image").
   Output format: enum "jpg" | "png" (default: "jpg").

5. google/nano-banana-pro – Nano Banana Pro
   Required: prompt (string).
   Resolution: enum "1K" | "2K" | "4K" (default: "2K").
   Image inputs: image_input (array of up to 14 URIs) – multi-image blending.
   Aspect ratio: enum "match_input_image" | "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "5:4" | "9:16" | "16:9" | "21:9" (default: "match_input_image").
   Output format: enum "jpg" | "png" (default: "jpg").
   Safety filter: enum "block_low_and_above" | "block_medium_and_above" | "block_only_high" (default: "block_only_high").

6. bytedance/seedream-4 – Seedream 4
   Required: prompt (string).
   Optional: image_input (array of 1-10 URIs) – for single or multi-reference generation.
   Size: enum "1K" | "2K" | "4K" | "custom" (default: "2K"). If custom: width (integer 1024-4096), height (integer 1024-4096).
   Aspect ratio: enum "match_input_image" | "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3" | "4:5" | "5:4" | "21:9" | "9:21" (default: "1:1").
   Sequential image generation: enum "disabled" | "auto" (default: "disabled"). When "auto", model decides whether to generate multiple related images.
   Max images: integer 1-15 (default: 1) – used when sequential_image_generation is "auto". Total images (input + generated) cannot exceed 15.
   Enhance prompt: boolean (default: false) – enables prompt enhancement for higher quality (takes longer).
   Use for: Unified text-to-image generation and image editing, multi-reference support, batch workflows, style transfer.

7. bytedance/seedream-4.5 – Seedream 4.5
   Required: prompt (string).
   Optional: image_input (array of 1-14 URIs) – for single or multi-reference generation.
   Size: enum "2K" | "4K" | "custom" (default: "2K"). Note: 1K resolution NOT supported in Seedream 4.5. If custom: width (integer 1024-4096), height (integer 1024-4096).
   Aspect ratio: enum "match_input_image" | "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3" | "4:5" | "5:4" | "21:9" | "9:21" (default: "match_input_image").
   Sequential image generation: enum "disabled" | "auto" (default: "disabled"). When "auto", model decides whether to generate multiple related images.
   Max images: integer 1-15 (default: 1) – used when sequential_image_generation is "auto". Total images (input + generated) cannot exceed 15.
   Use for: Upgraded version with stronger spatial understanding, world knowledge, cinematic aesthetics, professional workflows, e-commerce, film/advertising.

8. bytedance/seededit-3.0 – Seededit 3.0
   Required: image (URI), prompt (string) – text-guided editing instructions (e.g., "Change text to X", "Remove object Y", "Replace background").
   Guidance scale: number (default: 5.5) – prompt adherence, higher = more literal interpretation.
   Optional: seed (integer) – for reproducible generation.
   Use for: Text-guided image editing, preserving original details while making targeted modifications, lighting changes, object removal, style conversion, text replacement.

VIDEO GENERATION MODELS:

6-9. google/veo-3.1-fast, google/veo-3-fast, google/veo-3.1, google/veo-3
   Required: prompt (string).
   Optional: negative_prompt (string), seed (integer), image (URI) – first frame (overrides aspect ratio).
   Duration: enum 4 | 6 | 8 seconds (default: 8).
   Resolution: enum "720p" | "1080p" (default: "1080p").
   Aspect ratio: enum "16:9" | "9:16" (default: "16:9").
   Audio: generate_audio boolean (default: true) – context-aware soundtrack.

10. openai/sora-2 – Sora 2
   Required: prompt (string).
   Duration: enum 4 | 8 | 12 seconds (default: 4).
   Aspect ratio: enum "portrait" (720×1280) | "landscape" (1280×720) (default: "portrait").
   Optional: input_reference (URI) – starting image, openai_api_key (string).

11. openai/sora-2-pro – Sora 2 Pro
   Required: prompt (string).
   Duration: enum 4 | 8 | 12 seconds (default: 4).
   Resolution: enum "standard" (720p) | "high" (1024p) (default: "standard").
   Aspect ratio: enum "portrait" | "landscape" (default: "portrait").
   Optional: input_reference (URI), openai_api_key (string).

12. kwaivgi/kling-v2.5-turbo-pro – Kling v2.5 Turbo Pro
   Required: prompt (string).
   Duration: enum 5 | 10 seconds (default: 5).
   Aspect ratio: enum "16:9" | "9:16" | "1:1" (default: "16:9").
   Optional: start_image (URI) – if provided, aspect ratio inherited, negative_prompt (string).

13. kwaivgi/kling-v2.1 – Kling v2.1
   Required: start_image (URI) – seeds the video.
   Mode: enum "default" (720p) | "photo2video" | "video2video" (default: "default"). Use "photo2video" for image-to-video.
   Duration: enum 4 | 6 | 8 seconds (default: 4).
   Optional: end_image (URI) – final frame (only valid when mode is "video2video"), negative_prompt (string).

14. wan-video/wan-2.2-i2v-fast – WAN 2.2 i2v Fast
   Required: image (URI), prompt (string).
   Resolution: enum "480p" | "720p" (default: "480p").
   Frames: num_frames integer 81–121 (default: 81).
   Sample shift: number 1–20 (default: 12).
   Frame rate: frames_per_second integer 5–30 (default: 16).
   Optional: last_image (URI), seed (integer), interpolate_output (boolean), lora parameters, disable_safety_checker (boolean, default: false).

15. wan-video/wan-2.2-animate-replace – WAN 2.2 Animate Replace
   Required: video (URI), character_image (URI) – replaces character in video.
   Resolution: enum "720" | "480" (default: "720").
   Referent frames: referent_num enum 1 | 5 (default: 1).
   Frame rate: frames_per_second integer 5–60 (default: 24).
   Optional: seed (integer), go_fast (boolean, default: true), merge_audio (boolean, default: true).

16. bytedance/seedance-1-lite – Seedance 1 Lite
   Required: prompt (string).
   Optional: image (URI) – switches to image-to-video mode.
   Duration: integer 2–12 seconds (default: 5).
   FPS: enum [24] (only 24 fps).
   Resolution: enum "480p" | "720p" | "1080p" (default: "720p").
   Aspect ratio: enum "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "9:21" (default: "16:9").
   Optional: camera_fixed (boolean, default: false), last_frame_image (URI), reference_images (array of 1–4 URIs).

17. bytedance/seedance-1-pro – Seedance 1 Pro
   Same as Lite, but default resolution is "1080p" and reference_images field is not present.

18. wan-video/wan-2.5-i2v – WAN 2.5 i2v
   Required: image (URI) – input image for video generation, prompt (string) – text prompt for video generation.
   Optional: negative_prompt (string) – negative prompt to avoid certain elements.
   Audio: audio (URI) – optional audio file (wav/mp3, 3-30s, ≤15MB) for voice/music synchronization.
   Resolution: enum "480p" | "720p" | "1080p" (default: "720p").
   Duration: integer 1-10 seconds (default: 10) – duration of the generated video.
   Enable prompt expansion: boolean (default: true) – enables prompt optimizer for better results.
   Seed: integer (optional) – random seed for reproducible generation.
   Use for: Alibaba Wan 2.5 image-to-video with background audio support, audio-synchronized video generation, one-pass A/V sync.

19. bytedance/omni-human-1.5 – Omni Human 1.5
   Required: image (URI) – input image containing human subject/face/character, audio (URI) – input audio file (MP3, WAV, etc.). Audio duration MUST be less than 35 seconds or generation will fail.
   Optional: prompt (string) – optional prompt for precise control of scene, movements, camera movements. Supports Chinese, English, Japanese, Korean, Spanish, and Indonesian.
   Fast mode: boolean (default: true) – enable fast mode to speed up generation by sacrificing some effects.
   Seed: integer (optional) – random seed for reproducible generation.
   Use for: Film-grade digital human videos from single image + audio, realistic talking head videos, character-driven content, portrait animation with audio lip-sync.

20. lightricks/ltx-2-fast – LTX 2 Fast
   Required: prompt (string) – text prompt describing the video to generate. Write as one vivid paragraph in present tense with camera moves, lighting, and actions.
   Optional: image (URI) – first frame image for optional image-to-video generation.
   Resolution: enum "720p" | "1080p" (default: "1080p") – resolution quality of the generated video.
   Duration: enum 6 | 8 | 10 seconds (default: 6) – duration of video. Durations longer than 10 seconds only available with 1080p resolution.
   Generate audio: boolean (default: false) – generate audio for the video with perfectly synced SFX/dialogue/music.
   Use for: Lightning-fast video generation (renders faster than playback), instant ideation, storyboarding, mobile workflows, high-throughput production. Ideal for rapid prototyping and iterative workflows.

21. lightricks/ltx-2-pro – LTX 2 Pro
   Required: prompt (string) – text prompt describing the video to generate. Write as one flowing paragraph with camera behavior, lighting, physical details.
   Optional: image (URI) – first frame image for optional image-to-video generation.
   Resolution: enum "720p" | "1080p" (default: "1080p") – resolution quality of the generated video.
   Duration: integer 6-10 seconds (default: 6) – duration of the video in seconds.
   Generate audio: boolean (default: false) – generate audio for the video.
   Use for: High visual fidelity with fast turnaround, daily content creation, marketing teams, iterative creative workflows. Delivers superior quality vs Fast mode.

22. wan-video/wan-2.2-s2v – WAN 2.2 S2V (Cinematic)
   Required: audio (URI), image (URI) – audio drives lip-sync, image is first frame.
   Optional: prompt (string) – describe additional visual elements.
   Frames per chunk: num_frames_per_chunk integer 1–121 (default: 81).
   Interpolation: interpolate boolean (default: false) – converts to 25 fps if true.
   Optional: seed (integer).

TEXT-TO-SPEECH MODELS:

23. minimax-speech-02-hd – Minimax Speech 02 HD
   Required: text (string) – up to 10,000 characters. Use markers like <#0.5#> for pauses.
   Pitch: integer -12 to +12 semitones (default: 0).
   Speed: float 0.5–2.0 (default: 1).
   Volume: float 0–10 (default: 1).
   Bitrate: enum 32000 | 64000 | 128000 | 256000 (default: 128000) – applies only when audio_format is "mp3".
   Channel: enum "mono" | "stereo" (default: "mono").
   Emotion: enum "auto" | "happy" | "sad" | "angry" | "fearful" | "disgusted" | "surprised" | "calm" | "fluent" | "neutral" (default: "auto").
   Voice ID: string (default: "Wise_Woman").
   Sample rate: enum 8000 | 16000 | 22050 | 24000 | 32000 | 44100 Hz (default: 32000).
   Audio format: enum "mp3" | "wav" | "flac" | "pcm" (default: "mp3").
   Language boost: enum with language names or "Automatic" | "None" (default: "None").
   Subtitle enable: boolean (default: false).
   English normalization: boolean (default: false).

24. elevenlabs-tts – ElevenLabs TTS
   Required: text (string), voice_id (string).
   Optional: model_id (string, e.g., "eleven_turbo_v2", "eleven_multilingual_v2"), voice_settings (object with stability, similarity_boost, style, use_speaker_boost).

25. dia-tts (zsxkib/dia) – Dia 1.6B
   Required: text (string) – use markers like [S1], [S2] for speaker changes, parentheses for non-verbal actions (e.g., "(laughs)").
   Top P: float 0.1–1 (default: 0.95).
   CFG scale: float 1–5 (default: 3).
   Temperature: float 1–2.5 (default: 1.8).
   Optional: audio_prompt (URI to .wav/.mp3/.flac) – voice cloning, audio_prompt_text (string), max_audio_prompt_seconds (int 1–120, default: 10).
   Speed factor: float 0.5–1.5 (default: 1).
   Pause factor: float 0.5–2 (default: 1).
   Max new tokens: integer 500–6144 (default: 3072) – approx. 86 tokens per second.
   CFG filter top K: integer 10–100 (default: 45).
   Optional: seed (integer).

26. jaaari/kokoro-82m – Kokoro 82M
   Required: text (string) – text input (long text is automatically split).
   Voice: string (default: "af_nicole") – voice to use for synthesis. Supports 46 voices across multiple languages:
     American English (US): af_alloy, af_aoede, af_bella (high quality), af_jessica, af_kore, af_nicole, af_nova, af_river, af_sarah, af_sky, am_adam, am_echo, am_eric, am_fenrir, am_liam, am_michael, am_onyx, am_puck
     British English (UK): bf_alice, bf_emma, bf_isabella, bf_lily, bm_daniel, bm_fable, bm_george, bm_lewis
     French (FR): ff_siwis
     Hindi (IN): hf_alpha, hf_beta, hm_omega, hm_psi
     Italian (IT): if_sara, im_nicola
     Japanese (JP): jf_alpha, jf_gongitsune, jf_nezumi, jf_tebukuro, jm_kumo
     Mandarin Chinese (CN): zf_xiaobei, zf_xiaoni, zf_xiaoxiao, zf_xiaoyi, zm_yunjian, zm_yunxi, zm_yunxia, zm_yunyang
   Speed: float 0.5–2.0 (default: 1) – speech speed multiplier (0.5 = half speed, 2.0 = double speed).
   Use for: Lightweight 82M param TTS model, fast generation, cost-effective voiceovers, multilingual content, mobile workflows. Apache-licensed, ideal for production environments and personal projects.

LIP SYNC MODELS:

27. sievesync-1.1 – Sieve Sync 1.1
   Required: video (URI), audio (URI).
   Backend: string "sievesync-1.1" (default).
   Optional: enable_multispeaker (boolean), enhance (boolean), check_quality (boolean), downsample (boolean), cut_by (string).

28. bytedance/latentsync – LatentSync
   Required: audio (URI), video (URI).
   Guidance scale: number (default: 1, max: 10).
   Optional: seed (integer, 0 for random).

29. wan-video/wan-2.2-s2v – Wan 2.2 S2V (see section 22 above)

30. wavespeed-ai/infinitetalk – InfiniteTalk (Image-to-Video)
   Required: image (URI), audio (URI).
   Optional: prompt (string) – describe expression, style, or pose.
   Optional: mask_image (URI) – specify which regions can move (CRITICAL: do NOT upload full image, only the regions to animate).
   Resolution: enum "480p" | "720p" (default: "480p"). Pricing: $0.15/5s (480p), $0.30/5s (720p).
   Seed: integer -1 to 2147483647 (default: -1, random).
   Max length: 10 minutes (600 seconds). Processing: ~10-30 seconds wall time per 1 second of video.
   Use for: Single character talking videos from static photos, image-to-video lipsync.

31. wavespeed-ai/infinitetalk/multi – InfiniteTalk Multi (Two Characters)
   Required: image (URI) – must clearly show two people, left_audio (URI), right_audio (URI).
   Optional: prompt (string) – describe additional visual elements.
   Order: enum "meanwhile" | "left_right" | "right_left" (default: "meanwhile").
     - "meanwhile": Both audio sources play simultaneously.
     - "left_right": Left audio plays first, then right audio.
     - "right_left": Right audio plays first, then left audio.
   Resolution: enum "480p" | "720p" (default: "480p"). Pricing: $0.15/5s (480p), $0.30/5s (720p).
   Seed: integer -1 to 2147483647 (default: -1, random).
   Max length: 10 minutes (600 seconds). Processing: ~10-30 seconds wall time per 1 second of video.
   Use for: Multi-character talking videos, conversations, duets, interviews with two people.

32. wavespeed-ai/infinitetalk/video-to-video – InfiniteTalk Video-to-Video
   Required: video (URI), audio (URI).
   Optional: prompt (string) – describe style, pose, or expressions.
   Optional: mask_image (URI) – specify which regions can move (CRITICAL: do NOT upload full image, only the regions to animate).
   Resolution: enum "480p" | "720p" (default: "480p"). Pricing: $0.15/5s (480p), $0.30/5s (720p).
   Seed: integer -1 to 2147483647 (default: -1, random).
   Max length: 10 minutes (600 seconds). Processing: ~10-30 seconds wall time per 1 second of video.
   Use for: Lipsyncing existing videos with new audio, video redubbing, replacing audio tracks.

OTHER TOOLS:

33. background-remover (851-labs/background-remover)
   Required: image (URI) or video_url (URI for videos).
   Output format: enum "png" | "jpg" (default: "png").
   Optional: reverse (boolean), threshold (float 0.0–1.0), background_type (string: "rgba" | "map" | "green" | "white" | [R,G,B] | "blur" | "overlay" | image path, default: "rgba").

34. topazlabs/image-upscale – Topaz Upscale (Enhance)
   Required: image (URI).
   Enhance model: enum "Standard V2" | "Low Resolution V2" | "CGI" | "High Fidelity V2" | "Text Refine" (default: "Standard V2").
   Output format: enum "jpg" | "png" (default: "jpg").
   Upscale factor: enum "None" | "2x" | "4x" | "6x" (default: "None").
   Face enhancement: boolean (default: false). If true: subject_detection enum "None" | "ALL" | "Foreground" | "Background" (default: "None"), face_enhancement_strength float 0–1 (default: 0.8), face_enhancement_creativity float 0–1 (default: 0).

35. openai/gpt-4o-transcribe – GPT-4o Transcribe
   Required: audio_file (URI) – formats: mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm.
   Optional: prompt (string) – guide transcription, language (ISO-639-1 code), temperature (float 0–1, default: 0).

VALIDATION RULES FOR THE ASSISTANT:

1. Validate inputs: Ensure required fields are present. Use enumerated values from the lists above. Never guess or invent values.
2. Clamp ranges: For integers/floats, clamp user input to allowed ranges (e.g., duration 2–12 for Seedance, speed 0.5–2.0 for TTS).
3. Match aspect ratios: Choose aspect ratios compatible with the model AND intended output medium:
   - Mobile/Stories: "9:16" or "2:3"
   - Landscape/YouTube: "16:9"
   - Square/Social: "1:1"
   - For GPT Image 1.5: ONLY "1:1", "3:2", "2:3" (default: "2:3")
4. Respect limits: Do not exceed maximums (e.g., max 10 images for GPT-Image 1.5, max 14 for Nano Banana Pro/Seedream 4.5, max 15 for Seedream 4, max 121 frames for WAN models, max 10,000 chars for Minimax TTS, max 35s audio for Omni Human 1.5).
5. Use defaults: When user doesn't specify, use the default values listed above.
6. Plan sequential workflows: For complex tasks (image → video, image + audio → lipsync), ensure intermediate outputs are generated before feeding to next model. Match file formats to next model's requirements.
7. Safety: Leave moderation/safety controls at defaults unless user explicitly requests otherwise.

By following these validation rules and referencing the detailed schema above, construct accurate workflow plans with valid inputs for all 35 models.`;
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
  claudeOriginal?: any, // Claude's original output for comparison
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

    // LENIENT VALIDATION: Fix missing fields instead of throwing errors
    // We want to preserve ALL of Claude's steps, just fill in missing required fields
    if (tool === 'tts') {
      // TTS requires 'text', not 'prompt'
      const text = inputsFromStep.text || '';
      if (!text || (typeof text === 'string' && text.trim().length === 0)) {
        console.warn(`[Normalize] ⚠️  TTS step ${s.id} missing text - using title as fallback`);
        // Use title or a default instead of throwing
        inputsFromStep.text = s.title || 'Text to speech';
        console.log(`[Normalize] ✓ Fixed TTS step ${s.id} with text: "${inputsFromStep.text}"`);
      }
    } else if (!prompt && TOOLS_REQUIRING_PROMPTS.includes(tool)) {
      // Other tools require 'prompt' - use title or create a basic prompt
      console.warn(`[Normalize] ⚠️  Step ${s.id} (${tool}) missing prompt - using title as fallback`);
      prompt = s.title || s.description || `Generate ${tool} content`;
      inputsFromStep.prompt = prompt;
      console.log(`[Normalize] ✓ Fixed step ${s.id} with prompt: "${prompt.slice(0, 100)}..."`);
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
    const model = coerceString(s.model) || TOOL_SPECS[tool]?.models[0]?.id || '';
    if ((tool === 'image' || tool === 'video')) {
      const availableRatios = getAvailableAspectRatios(model, tool);
      
      // For GPT Image 1.5, validate and correct aspect ratio
      if (tool === 'image' && model === 'openai/gpt-image-1.5') {
        const validRatios = ['1:1', '3:2', '2:3'] as const;
        if (inputs.aspect_ratio) {
          // Validate existing aspect_ratio
          if (!validRatios.includes(inputs.aspect_ratio as any)) {
            console.warn(`[Normalize] ⚠️  Invalid aspect_ratio "${inputs.aspect_ratio}" for GPT Image 1.5. Valid options: ${validRatios.join(', ')}. Defaulting to "2:3".`);
            inputs.aspect_ratio = '2:3';
          }
        } else {
          // No aspect_ratio provided - default to "2:3" for GPT Image 1.5
          inputs.aspect_ratio = '2:3';
          console.log(`[Normalize] ✓ Set default aspect_ratio "2:3" for GPT Image 1.5 step ${s.id}`);
        }
      } else if (!inputs.aspect_ratio) {
        // For other models, detect aspect ratio if not provided
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
    }
    
    // Preserve ALL fields from Claude's original step
    const normalizedStep = normalizeInputs({
      id: s.id || `step-${idx + 1}`,
      title: s.title || `Step ${idx + 1}`,
      description: s.description || '',
      tool,
      model: coerceString(s.model) || TOOL_SPECS[tool]?.models[0]?.id || TOOL_SPECS.image.models[0].id,
      modelOptions: s.modelOptions,
      inputs,
      suggestedParams: s.suggestedParams || {},
      fields: s.fields,
      outputType: s.outputType || (s as any).outputType,
      dependencies: s.dependencies || [],
      validations: s.validations,
    });
    
    // Preserve any additional fields Claude might have included
    const originalKeys = Object.keys(s as any);
    const normalizedKeys = Object.keys(normalizedStep);
    const missingKeys = originalKeys.filter((key: string) => !normalizedKeys.includes(key) && key !== 'inputs' && key !== 'prompt');
    if (missingKeys.length > 0) {
      console.log(`[Normalize] Preserving additional fields from Claude: ${missingKeys.join(', ')}`);
      missingKeys.forEach((key: string) => {
        (normalizedStep as any)[key] = (s as any)[key];
      });
    }
    
    return normalizedStep;
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

  // CRITICAL: We must preserve ALL of Claude's steps
  if (steps.length === 0) {
    throw new Error(`All ${planObj.steps.length} steps failed normalization. Errors: ${errors.join('; ')}`);
  }

  if (steps.length < planObj.steps.length) {
    console.error(`[Normalize] ❌ CRITICAL: Lost ${planObj.steps.length - steps.length} steps from Claude's output!`);
    console.error(`[Normalize] Claude's step IDs:`, planObj.steps.map((s: any) => s.id));
    console.error(`[Normalize] Normalized step IDs:`, steps.map((s: any) => s.id));
    const missingIds = planObj.steps
      .map((s: any) => s.id)
      .filter((id: string) => !steps.find((ns) => ns.id === id));
    console.error(`[Normalize] Missing step IDs:`, missingIds);
    throw new Error(`Lost ${planObj.steps.length - steps.length} steps from Claude's output. This should never happen.`);
  }

  // Verify we have all of Claude's steps
  if (claudeOriginal && claudeOriginal.steps) {
    const claudeStepIds = new Set<string>(claudeOriginal.steps.map((s: any) => String(s.id || '')));
    const normalizedStepIds = new Set<string>(steps.map((s) => s.id));
    const missing: string[] = [];
    claudeStepIds.forEach((id: string) => {
      if (!normalizedStepIds.has(id)) {
        missing.push(id);
      }
    });
    if (missing.length > 0) {
      console.error(`[Normalize] ❌ CRITICAL: Missing Claude steps:`, missing);
      throw new Error(`Lost Claude steps during normalization: ${missing.join(', ')}`);
    }
    console.log(`[Normalize] ✓ Verified: All ${claudeOriginal.steps.length} Claude steps preserved`);
  }

  // NO FALLBACKS: We only use Claude's output. If Claude didn't create TTS steps, we don't create them.
  // Log if analysis expected more steps than Claude provided, but don't create fallback steps
  if (analysis && analysis.totalTtsSteps > 0) {
    const existingTtsSteps = steps.filter(s => s.tool === 'tts');
    if (existingTtsSteps.length < analysis.totalTtsSteps) {
      console.warn(`[Normalize] ⚠️  Analysis expected ${analysis.totalTtsSteps} TTS steps but Claude only provided ${existingTtsSteps.length}. Using Claude's output as-is (no fallbacks).`);
    }
  }
  
  let finalPlan: AssistantPlan = {
      summary: typeof raw.summary === 'string' ? raw.summary : (claudeOriginal?.summary || 'Generated workflow'),
      steps,
  };
  
  // Preserve Claude's step order - don't reorder
  // Auto-correct image→video dependencies (but preserve all steps)
  const stepCountBefore = finalPlan.steps.length;
  finalPlan = correctImageToVideoDependencies(finalPlan);
  if (finalPlan.steps.length !== stepCountBefore) {
    console.error(`[Normalize] ❌ CRITICAL: correctImageToVideoDependencies changed step count!`);
    throw new Error(`Step count changed in correctImageToVideoDependencies`);
  }
  
  // Attach uploaded media (but preserve all steps)
  finalPlan = attachMediaToPlan(finalPlan, media);
  if (finalPlan.steps.length !== stepCountBefore) {
    console.error(`[Normalize] ❌ CRITICAL: attachMediaToPlan changed step count!`);
    throw new Error(`Step count changed in attachMediaToPlan`);
  }
  
  // Final verification
  if (finalPlan.steps.length !== planObj.steps.length) {
    console.error(`[Normalize] ❌ CRITICAL: Step count changed after post-processing!`);
    console.error(`[Normalize] Before post-processing: ${planObj.steps.length}, After: ${finalPlan.steps.length}`);
    throw new Error(`Step count mismatch after post-processing. This should never happen.`);
  }
  
  console.log(`[Normalize] ✓ Final plan has ${finalPlan.steps.length} steps (matching Claude's ${planObj.steps.length} steps)`);
  
  return finalPlan;
}
