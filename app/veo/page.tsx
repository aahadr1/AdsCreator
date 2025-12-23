'use client';

import '../globals.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';

type VideoModelValue =
  | 'google/veo-3.1-fast'
  | 'google/veo-3.1'
  | 'kwaivgi/kling-v2.5-turbo-pro'
  | 'kwaivgi/kling-v2.1'
  | 'wan-video/wan-2.2-i2v-fast'
  | 'wan-video/wan-2.2-animate-replace'
  | 'wan-video/wan-2.5-i2v'
  | 'bytedance/omni-human-1.5'
  | 'lightricks/ltx-2-fast'
  | 'lightricks/ltx-2-pro';

type VideoModelMeta = {
  value: VideoModelValue;
  label: string;
  description?: string;
  badge?: string;
};

const VIDEO_MODELS: readonly VideoModelMeta[] = [
  {
    value: 'google/veo-3.1-fast',
    label: 'Google VEO 3.1 Fast',
    badge: 'Recommended',
    description: 'Latest 3.1 release with upgraded motion intelligence at production-ready speeds.',
  },
  {
    value: 'google/veo-3.1',
    label: 'Google VEO 3.1',
    badge: 'Ultra',
    description: 'Top-tier VEO quality with cinematic depth, better camera reasoning, and longer durations.',
  },
  {
    value: 'kwaivgi/kling-v2.5-turbo-pro',
    label: 'Kling 2.5 Turbo Pro',
    badge: 'New',
    description:
      'Pro-level Kling text-to-video with smooth motion, cinematic depth, and strong prompt fidelity. Supports aspect ratios + optional start image.',
  },
  {
    value: 'kwaivgi/kling-v2.1',
    label: 'Kling v2.1 Image-to-Video',
    description: 'Animate a start frame into 5-10s clips (720p/1080p) with accurate gestures and product framing.',
  },
  {
    value: 'wan-video/wan-2.2-i2v-fast',
    label: 'Pruna WAN 2.2 i2v Fast',
    description: 'Image-to-video workflow with quick turnarounds for animating stills.',
  },
  {
    value: 'wan-video/wan-2.2-animate-replace',
    label: 'Wan 2.2 Animate Replace',
    description: 'Swap characters inside existing footage using Wan\'s character replacement.',
  },
  {
    value: 'wan-video/wan-2.5-i2v',
    label: 'Alibaba WAN 2.5 i2v',
    badge: 'New',
    description: 'Image-to-video with background audio sync, up to 10s, supports 480p/720p/1080p with one-pass A/V sync.',
  },
  {
    value: 'bytedance/omni-human-1.5',
    label: 'ByteDance Omni Human 1.5',
    badge: 'Film-grade',
    description: 'Film-grade digital human from image + audio (<35s). Perfect for realistic talking head videos.',
  },
  {
    value: 'lightricks/ltx-2-fast',
    label: 'LTX 2 Fast',
    badge: 'Lightning',
    description: 'Ultra-fast 6-10s video generation with auto-synced audio. Renders faster than playback, ideal for rapid prototyping.',
  },
  {
    value: 'lightricks/ltx-2-pro',
    label: 'LTX 2 Pro',
    badge: 'Pro',
    description: 'High visual fidelity 6-10s videos with fast turnaround. Superior quality for daily content creation.',
  },
];

type ModelDocExample = {
  title: string;
  input: Record<string, unknown>;
  output: string;
  link?: string;
};

type ModelDoc = {
  title: string;
  description: string;
  inputs: string[];
  outputSchema: string;
  examples: ModelDocExample[];
  tips: string[];
};

const VIDEO_MODEL_DOCS: Record<string, ModelDoc> = {
  'kwaivgi/kling-v2.5-turbo-pro': {
    title: 'Kling 2.5 Turbo Pro',
    description: 'Unlock pro-level text-to-video and image-to-video clips with smooth motion, cinematic depth, and remarkable prompt adherence.',
    inputs: [
      'prompt (required) — describe the shot, camera moves, and pacing',
      'duration — total run time in seconds',
      'aspect_ratio — e.g. 16:9, 9:16, 1:1 (ignored when a start image is supplied)',
      'start_image — first frame when converting an image to video',
      'image (deprecated) — legacy alias for start_image',
      'negative_prompt — force elements to stay out of the scene',
      'guidance controls — some presets expose guidance_scale and other fine-grained knobs via schema',
    ],
    outputSchema: `{
  "type": "string",
  "title": "Output",
  "format": "uri"
}`,
    examples: [
      {
        title: 'Woman is dancing',
        link: 'https://replicate.com/p/75wknmxbfnrme0csg84vagt5qr',
        input: {
          prompt: 'a woman is dancing',
          duration: 5,
          aspect_ratio: '16:9',
          guidance_scale: 0.5,
        },
        output: 'https://replicate.delivery/xezq/17c3JG1SzH6NCduMiKp1Cxyqvpad0GXRf507Pqq5GOqNsZsKA/tmpg4w3kyjz.mp4',
      },
      {
        title: 'Image + prompt (Tokyo rain)',
        link: 'https://replicate.com/p/zz6r0wtn61rma0csg8tr2qnnew',
        input: {
          prompt:
            'A man in a trench coat holding a black umbrella walks briskly through the streets of Tokyo on a rainy night, splashing through puddles. A handheld follow-cam shot from his side and slightly behind. The focus is locked on the man, while background neon signs blur into beautiful bokeh. Cyberpunk aesthetic with a film noir quality; the mood is mysterious and lonely. The pavement is slick and wet, reflecting the vibrant neon signs. Individual raindrops are visible, and a light fog hangs in the air.',
          duration: 5,
          aspect_ratio: '16:9',
          image:
            'https://replicate.delivery/pbxt/NmA3RGnKCecr9sJH8yREBWdqKvka91xFfc9mAhxrreYmJClz/man-in-rain.jpeg',
          guidance_scale: 0.5,
        },
        output: 'https://replicate.delivery/xezq/ssJoLMbvdLIgIRdWaDY26XEmUJmQfH1Af6He1Z2XHLtqIoxqA/tmpp3vqjumh.mp4',
      },
      {
        title: 'Cinematic hero reveal',
        link: 'https://replicate.com/p/gq20bdaybdrm80csg8wbd5vst8',
        input: {
          prompt:
            'Prompt: Real-time playback. Wide shot of a ruined city: collapsed towers, fires blazing, storm clouds with lightning. Camera drops fast from the sky over burning streets and tilted buildings. Smoke and dust fill the air. A lone hero walks out of the ruins, silhouetted by fire. Camera shifts front: his face is dirty with dust and sweat, eyes firm, a faint smile. Wind blows, debris rises. Extreme close-up: his eyes reflect the approaching enemy. Music and drums hit. Final wide shot: fire forms a blazing halo behind him - reborn in flames with epic cinematic vibe.',
          duration: 5,
          aspect_ratio: '16:9',
          guidance_scale: 0.5,
        },
        output: 'https://replicate.delivery/xezq/Fez1ZQegP1tyC0f18Qr1WyVpVeGWEYS0GPemdGCI9ayvDhGrC/tmp4s6vgmpf.mp4',
      },
      {
        title: 'Parkour FPV',
        link: 'https://replicate.com/p/a91f3sfp3drmc0csg9bry7rg34',
        input: {
          prompt:
            'A skilled parkour athlete sprints through the city, leaping and doing many flips over urban obstacles. FPV tracking shot, swoops and banks with him.',
          duration: 5,
          aspect_ratio: '16:9',
          guidance_scale: 0.5,
        },
        output: 'https://replicate.delivery/xezq/Lzq3zWbgAH7vCRFyf7xef9AEqfNOK1fYk2ZJfprfEdHaZUasKA/tmpmpzrg66r.mp4',
      },
    ],
    tips: [
      'Better prompt understanding: chain causal instructions for multi-beat shots and Kling will plan motion accordingly.',
      'More realistic motion: balanced training keeps frames stable even with aggressive camera moves.',
      'Detail consistency: refined conditioning locks palette, lighting, and wardrobe even through fast action.',
      'Designed for marketing, creators, studios, and education teams needing smooth, cinematic loops.',
    ],
  },
  'kwaivgi/kling-v2.1': {
    title: 'Kling v2.1 (Image-to-Video)',
    description: 'Upload a start image and let Kling v2.1 animate a 5s or 10s clip at 24fps in 720p (standard) or 1080p (pro).',
    inputs: [
      'prompt (required) — describe the movement, gestures, or context for the animation',
      'start_image (required) — first frame; Kling v2.1 always needs a reference',
      'mode — standard (720p) or pro (1080p). Use pro when also providing an end_image.',
      'duration — 5 or 10 seconds today',
      'negative_prompt — elements to keep out of the render',
      'end_image — optional final frame; requires mode="pro"',
    ],
    outputSchema: `{
  "type": "string",
  "title": "Output",
  "format": "uri"
}`,
    examples: [
      {
        title: 'Point at words',
        link: 'https://replicate.com/p/7v2d7djbn1rma0cqh6rbxwpxv0',
        input: {
          mode: 'standard',
          prompt: 'a woman points at the words',
          duration: 5,
          start_image: 'https://replicate.delivery/xezq/rfKExHkg7L2UAyYNJj3p1YrW1M3ZROTQQXupJSOyM5RkwQcKA/tmpowaafuyw.png',
        },
        output: 'https://replicate.delivery/xezq/ueemmhGfowaxnp2zx4rQAwZWkIGMkeoEFGwDMB8FJDDUPGiTB/tmpsam6b5v3.mp4',
      },
      {
        title: 'Gestures in the rain',
        link: 'https://replicate.com/p/a5fszgjzvdrmc0cqh6srsz53g4',
        input: {
          mode: 'standard',
          prompt: 'a woman takes her hands out her pockets and gestures to the words with both hands, she is excited, behind her it is raining',
          duration: 5,
          start_image: 'https://replicate.delivery/xezq/rfKExHkg7L2UAyYNJj3p1YrW1M3ZROTQQXupJSOyM5RkwQcKA/tmpowaafuyw.png',
        },
        output: 'https://replicate.delivery/xezq/yitkxodvCK7eJK9BFufsMBaHIfnHgJhlNNIiaQi8g8QebGiTB/tmpby0sgn7w.mp4',
      },
    ],
    tips: [
      'Always provide a crisp start image; Kling v2.1 refuses to run without one.',
      'Use mode="pro" for 1080p or when supplying an end_image to control the final pose.',
      'Stick to 5s clips for fastest turnaround; 10s generations may wait in queue longer.',
      'Pair negative prompts with precise gestures to keep hands and products framed cleanly.',
    ],
  },
};

type VideoModel = VideoModelValue;
const DEFAULT_MODEL: VideoModel = 'google/veo-3.1-fast';
const GOOGLE_MODELS = new Set<VideoModel>(
  VIDEO_MODELS.filter((m) => m.value.startsWith('google/veo')).map((m) => m.value as VideoModel)
);

type VeoResponse = { url?: string | null; raw?: any };
type VideoJobRecord = {
  id: string;
  label: string;
  prompt: string;
  imageUrl: string;
  resolution: '720p' | '1080p';
  seed: string;
  startFrameUrl: string;
  endFrameUrl: string;
  inputValues: Record<string, any>;
  status: 'idle' | 'running' | 'success' | 'error';
  videoUrl: string | null;
  rawVideoUrl: string | null;
  error: string | null;
  kvTaskId: string | null;
};

const DEFAULT_JOB_PROMPT =
  'Woman holding the product facing the camera with slight but sharp hand movements. Keep her face locked on camera and avoid rotating the product.';

const makeJob = (index: number): VideoJobRecord => ({
  id: `video-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  label: `Generation ${index}`,
  prompt: DEFAULT_JOB_PROMPT,
  imageUrl: '',
  resolution: '720p',
  seed: '',
  startFrameUrl: '',
  endFrameUrl: '',
  inputValues: {},
  status: 'idle',
  videoUrl: null,
  rawVideoUrl: null,
  error: null,
  kvTaskId: null,
});

export default function VeoPage() {
  const [model, setModel] = useState<VideoModel>(DEFAULT_MODEL);
  const initialJob = useMemo(() => makeJob(1), []);
  const [jobs, setJobs] = useState<VideoJobRecord[]>(() => [initialJob]);
  const [activeJobId, setActiveJobId] = useState<string>(initialJob.id);
  const [applyPromptToAll, setApplyPromptToAll] = useState(true);
  const [sharedPrompt, setSharedPrompt] = useState(initialJob.prompt);
  const [negativePrompt, setNegativePrompt] = useState('');

  const [dragImage, setDragImage] = useState(false);
  const [dragStart, setDragStart] = useState(false);
  const [dragEnd, setDragEnd] = useState(false);

  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const promptReadyAll = useMemo(
    () => (applyPromptToAll ? !!sharedPrompt.trim() : jobs.every((job) => (job.prompt || '').trim().length > 0)),
    [applyPromptToAll, sharedPrompt, jobs],
  );
  const promptReadyActive = useMemo(
    () => (applyPromptToAll ? !!sharedPrompt.trim() : !!(jobs.find((job) => job.id === activeJobId)?.prompt || '').trim()),
    [applyPromptToAll, sharedPrompt, jobs, activeJobId],
  );
  const promptRequirementMet = useMemo(
    () => (model === 'wan-video/wan-2.2-animate-replace' ? true : promptReadyAll),
    [model, promptReadyAll],
  );
  const promptRequirementActive = useMemo(
    () => (model === 'wan-video/wan-2.2-animate-replace' ? true : promptReadyActive),
    [model, promptReadyActive],
  );
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [inputSchema, setInputSchema] = useState<any | null>(null);

  const selectedModelMeta = useMemo(() => VIDEO_MODELS.find((m) => m.value === model), [model]);
  const selectedModelDoc = useMemo(() => VIDEO_MODEL_DOCS[model] || null, [model]);
  const isGoogleModel = useMemo(() => GOOGLE_MODELS.has(model), [model]);
  const supportsNegativePrompt = isGoogleModel || Boolean(inputSchema?.properties?.negative_prompt);
  const activeJob = useMemo(() => jobs.find((job) => job.id === activeJobId) ?? jobs[0], [jobs, activeJobId]);

  const updateJob = useCallback((jobId: string, updater: (prev: VideoJobRecord) => VideoJobRecord) => {
    setJobs((prev) => prev.map((job) => (job.id === jobId ? updater(job) : job)));
  }, []);

  const patchJob = useCallback(
    (jobId: string, patch: Partial<VideoJobRecord>) => {
      updateJob(jobId, (job) => ({ ...job, ...patch }));
    },
    [updateJob],
  );

  const addJob = useCallback(() => {
    setJobs((prev) => {
      const base = makeJob(prev.length + 1);
      const jobToAdd = applyPromptToAll ? { ...base, prompt: sharedPrompt } : base;
      const next = [...prev, jobToAdd];
      setActiveJobId(jobToAdd.id);
      return next;
    });
  }, [applyPromptToAll, sharedPrompt]);

  const removeJob = useCallback(
    (jobId: string) => {
      setJobs((prev) => {
        if (prev.length === 1) return prev;
        const filtered = prev.filter((job) => job.id !== jobId);
        const relabeled = filtered.map((job, index) => ({ ...job, label: `Generation ${index + 1}` }));
        if (!relabeled.find((job) => job.id === activeJobId)) {
          setActiveJobId(relabeled[0].id);
        }
        return relabeled;
      });
    },
    [activeJobId],
  );

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    form.append('filename', file.name);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { url: string };
    return json.url;
  }, []);

  const uploadMedia = useCallback(async (file: File): Promise<string> => {
    // Generic uploader for images/videos
    const form = new FormData();
    form.append('file', file);
    form.append('filename', file.name);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { url: string };
    return json.url;
  }, []);

  useEffect(() => {
    const reset = makeJob(1);
    setJobs([reset]);
    setActiveJobId(reset.id);
    setSharedPrompt(reset.prompt);
  }, [model]);

  useEffect(() => {
    const loadSchema = async () => {
      setSchemaLoading(true);
      setSchemaError(null);
      setInputSchema(null);
      try {
        const res = await fetch(`/api/replicate/schema?model=${encodeURIComponent(model)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setInputSchema(json.input || null);
      } catch (e: any) {
        setSchemaError(e?.message || 'Failed to load schema');
      } finally {
        setSchemaLoading(false);
      }
    };
    loadSchema();
  }, [model]);

  const uriFields = useMemo(() => {
    if (!inputSchema?.properties) return [] as string[];
    const out: string[] = [];
    for (const [key, prop] of Object.entries<any>(inputSchema.properties)) {
      if (key === 'prompt') continue;
      if ((prop as any)?.format === 'uri') out.push(key);
    }
    return out;
  }, [inputSchema]);

  const nonUriFields = useMemo(() => {
    if (!inputSchema?.properties) return [] as Array<{ key: string; schema: any }>;
    const out: Array<{ key: string; schema: any }> = [];
    for (const [key, prop] of Object.entries<any>(inputSchema.properties)) {
      if (key === 'prompt') continue;
      if ((prop as any)?.format === 'uri') continue;
      out.push({ key, schema: prop });
    }
    return out;
  }, [inputSchema]);

  async function persistUrlIfPossible(url: string): Promise<string> {
    try {
      const res = await fetch('/api/persist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, filename: url.split('/').pop() || null, folder: 'veo' }) });
      if (!res.ok) return url;
      const j = await res.json();
      return typeof j?.url === 'string' ? j.url : url;
    } catch { return url; }
  }

  const jobPromptValue = (job: VideoJobRecord) =>
    (applyPromptToAll ? sharedPrompt : job.prompt).trim();

  const runBatch = async (jobIds?: string[]) => {
    const targets = jobs.filter((job) => (jobIds ? jobIds.includes(job.id) : true));
    if (!targets.length) return;
    setIsBatchRunning(true);
    setGlobalError(null);
    try {
      for (const job of targets) {
        await runSingleJob(job);
      }
    } finally {
      setIsBatchRunning(false);
    }
  };
  const runActiveJob = () => {
    if (!activeJobId) return;
    runBatch([activeJobId]);
  };

  async function runSingleJob(job: VideoJobRecord) {
    const promptValue = jobPromptValue(job);
    if (model !== 'wan-video/wan-2.2-animate-replace' && !promptValue) {
      patchJob(job.id, { status: 'error', error: 'Prompt required' });
      return;
    }

    let kvIdLocal: string | null = null;
    patchJob(job.id, { status: 'running', error: null, videoUrl: null, rawVideoUrl: null });
    // Update global task state for favicon
    const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
    updateTaskStateFromJobStatus('running');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in at /auth before creating a task.');

      const dynamicInput: Record<string, any> = { ...job.inputValues };
      if (isGoogleModel) {
        if (job.imageUrl) dynamicInput.image = job.imageUrl;
        dynamicInput.resolution = job.resolution;
        if (job.seed.trim() !== '') dynamicInput.seed = Number(job.seed);
        if (job.startFrameUrl) dynamicInput.start_frame = job.startFrameUrl;
        if (job.endFrameUrl) dynamicInput.end_frame = job.endFrameUrl;
      }
      const trimmedNegative = negativePrompt.trim();
      if (supportsNegativePrompt && trimmedNegative) {
        dynamicInput.negative_prompt = trimmedNegative;
      }

      if (model === 'wan-video/wan-2.2-animate-replace') {
        if (!dynamicInput.video || !dynamicInput.character_image) {
          throw new Error('Please provide both video and character_image files.');
        }
        if (dynamicInput.refert_num !== undefined) {
          const rn = Number(dynamicInput.refert_num);
          if (!(rn === 1 || rn === 5)) {
            throw new Error('refert_num must be 1 or 5.');
          }
        }
        if (dynamicInput.frames_per_second !== undefined) {
          const fps = parseInt(String(dynamicInput.frames_per_second), 10);
          if (!Number.isFinite(fps) || fps <= 0) {
            throw new Error('frames_per_second must be a positive integer.');
          }
        }
      }

      if (inputSchema?.properties && typeof inputSchema.properties === 'object') {
        for (const [key, prop] of Object.entries<any>(inputSchema.properties)) {
          if (!(key in dynamicInput)) continue;
          const val = dynamicInput[key];
          if (val === undefined || val === null || val === '') continue;
          const declaredType = prop?.type;
          const isEnumNumeric = Array.isArray(prop?.enum) && prop.enum.length > 0 && typeof prop.enum[0] === 'number';
          if (declaredType === 'integer' || (isEnumNumeric && Number.isInteger(Number(val)))) {
            const parsed = parseInt(String(val));
            if (!Number.isNaN(parsed)) dynamicInput[key] = parsed;
          } else if (declaredType === 'number' || (isEnumNumeric && !Number.isInteger(Number(val)))) {
            const parsed = parseFloat(String(val));
            if (!Number.isNaN(parsed)) dynamicInput[key] = parsed;
          }
        }
      }

      const options = { model, ...dynamicInput } as Record<string, any>;

      try {
        const createRes = await fetch('/api/tasks/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            type: 'video',
            status: 'queued',
            provider: 'replicate',
            model_id: model,
            options_json: options,
            text_input: promptValue,
            image_url: dynamicInput.image || null,
          }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          kvIdLocal = created?.id || null;
          patchJob(job.id, { kvTaskId: kvIdLocal });
        }
      } catch {}

      const res = await fetch('/api/veo/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: promptValue,
          input: dynamicInput,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as VeoResponse;
      if (!json.url) throw new Error('No video URL returned');
      const persisted = await persistUrlIfPossible(json.url);
      const proxied = `/api/proxy?type=video&url=${encodeURIComponent(persisted)}`;
      patchJob(job.id, { status: 'success', rawVideoUrl: persisted, videoUrl: proxied });
      // Update global task state for favicon
      const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
      updateTaskStateFromJobStatus('success');

      if (kvIdLocal) {
        try {
          await fetch('/api/tasks/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: kvIdLocal, status: 'finished', output_url: persisted }),
          });
        } catch {}
      }
    } catch (e: any) {
      const message = e?.message || 'Failed to generate video';
      patchJob(job.id, { status: 'error', error: message });
      // Update global task state for favicon
      const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
      updateTaskStateFromJobStatus('error');
      const targetKv = kvIdLocal || job.kvTaskId;
      if (targetKv) {
        try {
          await fetch('/api/tasks/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: targetKv, status: 'error' }),
          });
        } catch {}
      }
      setGlobalError((prev) => prev ?? message);
    }
  }

  const activeInputs = activeJob?.inputValues ?? {};
  const isAnimateReplace = model === 'wan-video/wan-2.2-animate-replace';
  const animateMissingRequired = isAnimateReplace && (!activeInputs.video || !activeInputs.character_image);

  return (
    <div className="page-template generator fade-in">
      <header className="page-hero">
        <div>
          <p className="page-eyebrow">Video Generation</p>
          <h1>VEO Studio</h1>
          <p className="page-description">
            Storyboard cinematic spots from text, animate reference images, and experiment with the latest video generation models.
          </p>
        </div>
        <div className="page-hero-actions">
          <a href="/tasks" className="hero-link">Monitor tasks</a>
          <a href="/credits" className="hero-link">Check credits</a>
        </div>
      </header>
      <div className="action-dock">
        <div className="action-dock-grid">
          <div className="dock-field">
            <div className="small">Prompt control</div>
            <textarea
              className="input"
              rows={3}
              value={applyPromptToAll ? sharedPrompt : (activeJob?.prompt ?? '')}
              onChange={(e)=>{
                const next = e.target.value;
                if (applyPromptToAll) setSharedPrompt(next);
                else if (activeJob) patchJob(activeJob.id, { prompt: next });
              }}
              placeholder="Keep your main prompt in reach while you configure the job."
            />
            <label className="apply-all-toggle" style={{marginTop:'var(--space-2)'}}>
              <input
                type="checkbox"
                checked={applyPromptToAll}
                onChange={(e)=>setApplyPromptToAll(e.target.checked)}
              />
              Apply prompt to all jobs
            </label>
          </div>
          <div className="dock-meta">
            <div className="dock-stats">
              <div><strong>Jobs</strong><span>{jobs.length}</span></div>
              <div><strong>Running</strong><span>{jobs.filter((j)=>j.status === 'running').length}</span></div>
              <div><strong>Model</strong><span>{model}</span></div>
            </div>
            <div className="dock-tabs">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  className={`veo-job-tab ${job.id === activeJobId ? 'active' : ''}`}
                  onClick={()=>setActiveJobId(job.id)}
                >
                  <span>{job.label}</span>
                  <span className={`status-pill ${job.status}`}>{job.status}</span>
                </button>
              ))}
              <button type="button" className="veo-job-tab add" onClick={addJob}>+ Add</button>
              {jobs.length > 1 && (
                <button type="button" className="veo-job-tab remove" onClick={()=>removeJob(activeJobId)}>Remove</button>
              )}
            </div>
          </div>
          <div className="action-dock-actions">
            <div className="small" style={{color:'var(--text-muted)'}}>Active: {activeJob?.label || 'n/a'}</div>
            <button
              className="btn inline"
              onClick={runActiveJob}
              disabled={isBatchRunning || !promptRequirementActive}
            >
              Run active
            </button>
            <button
              className="btn"
              onClick={()=>runBatch()}
              disabled={isBatchRunning || !promptRequirementMet}
            >
              {isBatchRunning ? 'Generating…' : 'Run all jobs'}
            </button>
          </div>
        </div>
      </div>

      <div className="page-grid">
        <div className="page-main">
          <div className="generator-workspace">
            <div className="panel output">
              <div className="header">
                <h2 style={{margin:0}}>Output</h2>
              </div>
              <div className="outputArea">
                {jobs.map((job) => (
                  <div key={job.id} className="veo-output-card">
                    <div className="veo-output-header">
                      <div className="veo-output-title">
                        <span>{job.label}</span>
                        <span className={`status-pill ${job.status}`}>{job.status}</span>
                      </div>
                      <button className="tiny-link" onClick={() => runBatch([job.id])} disabled={isBatchRunning}>
                        Rerun
                      </button>
                    </div>
                    {job.videoUrl ? (
                      <>
                        <video
                          controls
                          preload="metadata"
                          playsInline
                          style={{ width: '100%', borderRadius: 8 }}
                          onError={() => patchJob(job.id, { error: 'Failed to load video. Try the direct link below.' })}
                        >
                          <source src={job.videoUrl} type="video/mp4" />
                          {job.rawVideoUrl && job.rawVideoUrl !== job.videoUrl ? <source src={job.rawVideoUrl} /> : null}
                        </video>
                        <div className="small" style={{ marginTop: 8, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
                          <a href={job.videoUrl} target="_blank" rel="noreferrer" style={{padding:'8px 12px', background:'var(--panel-elevated)', borderRadius:'6px', textDecoration:'none'}}>Open via proxy</a>
                          {job.rawVideoUrl ? (
                            <a href={job.rawVideoUrl} target="_blank" rel="noreferrer" style={{padding:'8px 12px', background:'var(--panel-elevated)', borderRadius:'6px', textDecoration:'none'}}>Open direct</a>
                          ) : null}
                          <a href={`${job.videoUrl}${job.videoUrl.includes('?') ? '&' : '?'}download=true`} style={{padding:'8px 12px', background:'var(--accent)', color:'var(--color-black)', borderRadius:'6px', textDecoration:'none'}}>Download</a>
                        </div>
                      </>
                    ) : (
                      <div style={{fontSize:16, color:'#b7c2df'}}>Generated video will appear here.</div>
                    )}
                    {job.error && (
                      <div className="small" style={{ marginTop: 'var(--space-2)', color: '#ff7878' }}>{job.error}</div>
                    )}
                  </div>
                ))}
              </div>
              {globalError && (
                <div className="small" style={{ color: '#ff7878' }}>{globalError}</div>
              )}
            </div>

            <div className="panel">
              <div className="header">
                <h3 style={{margin:0}}>Video Generation</h3>
                <span className="badge">AI Video Models</span>
              </div>

              <div className="veo-control-stack">
                <section className="veo-control-card">
                  <div className="veo-control-card-header">
                    <div>
                      <div className="small">Model</div>
                      <div className="veo-control-title">{selectedModelMeta?.label || 'Select a model'}</div>
                    </div>
                    {selectedModelMeta?.badge && (
                      <span className="veo-chip">{selectedModelMeta.badge}</span>
                    )}
                  </div>
                  <select className="select" value={model} onChange={(e)=>setModel(e.target.value as VideoModel)}>
                    {VIDEO_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  {selectedModelMeta?.description && (
                    <p className="veo-control-description">{selectedModelMeta.description}</p>
                  )}
                </section>

                <section className="veo-control-card">
                  <div className="veo-job-tabs">
                    {jobs.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        className={`veo-job-tab ${job.id === activeJobId ? 'active' : ''}`}
                        onClick={()=>setActiveJobId(job.id)}
                      >
                        <span>{job.label}</span>
                        <span className={`status-pill ${job.status}`}>{job.status}</span>
                      </button>
                    ))}
                    <button type="button" className="veo-job-tab add" onClick={addJob}>+ Add</button>
                    {jobs.length > 1 && (
                      <button type="button" className="veo-job-tab remove" onClick={()=>removeJob(activeJobId)}>Remove</button>
                    )}
                  </div>
                </section>

                <section className="veo-control-card">
                  <div className="small">Video Prompt{model === 'wan-video/wan-2.2-animate-replace' ? ' (optional)' : ''}</div>
                  <textarea
                    className="input"
                    value={applyPromptToAll ? sharedPrompt : (activeJob?.prompt ?? '')}
                    onChange={(e)=>{
                      const next = e.target.value;
                      if (applyPromptToAll) {
                        setSharedPrompt(next);
                      } else if (activeJob) {
                        patchJob(activeJob.id, { prompt: next });
                      }
                    }}
                    rows={4}
                    placeholder="Describe the video you want to generate in detail..."
                  />
                  {supportsNegativePrompt && (
                    <div style={{marginTop:'var(--space-4)'}}>
                      <div className="small">Negative Prompt (optional)</div>
                      <textarea
                        className="input"
                        value={negativePrompt}
                        onChange={(e)=>setNegativePrompt(e.target.value)}
                        rows={3}
                        placeholder="Things to avoid in the video"
                      />
                    </div>
                  )}
                </section>

                {isGoogleModel && (
                  <section className="veo-control-card">
                    <div>
                      <div className="small">Reference image (optional)</div>
                      <div
                        className={`dnd ${dragImage ? 'drag' : ''}`}
                        onDragOver={(e)=>{e.preventDefault(); setDragImage(true);}}
                        onDragLeave={(e)=>{e.preventDefault(); setDragImage(false);}}
                        onDrop={async (e)=>{
                          e.preventDefault();
                          setDragImage(false);
                          const f = e.dataTransfer.files?.[0];
                          if (f && f.type.startsWith('image/')) {
                            try {
                              const url = await uploadImage(f);
                              if (activeJob) patchJob(activeJob.id, { imageUrl: url });
                            } catch (err: any) {
                              setGlobalError(err?.message || 'Upload failed');
                            }
                          }
                        }}
                        onClick={()=>{
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = async ()=>{
                            const f = (input.files?.[0]) || null;
                            if (f) {
                              try {
                                const url = await uploadImage(f);
                                if (activeJob) patchJob(activeJob.id, { imageUrl: url });
                              } catch (err: any) {
                                setGlobalError(err?.message || 'Upload failed');
                              }
                            }
                          };
                          input.click();
                        }}
                      >
                        <div className="dnd-icon">🖼️</div>
                        <div className="dnd-title">Reference Image</div>
                        <div className="dnd-subtitle">PNG/JPG • ideal 1280x720</div>
                        {activeJob?.imageUrl && (
                          <div className="fileInfo" style={{marginTop:'var(--space-3)'}}>
                            <img src={activeJob.imageUrl} alt="reference" style={{maxWidth:240, borderRadius:'var(--radius-lg)'}} />
                            <div className="small" style={{marginTop:'var(--space-2)'}}><a href={activeJob.imageUrl} target="_blank" rel="noreferrer">Open image</a></div>
                          </div>
                        )}
                      </div>
                      {activeJob?.imageUrl && (
                        <button className="btn" style={{marginTop:8}} onClick={()=>patchJob(activeJob.id, { imageUrl: '' })}>Clear image</button>
                      )}
                    </div>

                    <div className="options" style={{marginTop:12}}>
                      <div>
                        <div className="small">Start frame (optional)</div>
                        <div
                          className={`dnd ${dragStart ? 'drag' : ''}`}
                          onDragOver={(e)=>{e.preventDefault(); setDragStart(true);}}
                          onDragLeave={(e)=>{e.preventDefault(); setDragStart(false);}}
                        onDrop={async (e)=>{
                          e.preventDefault();
                          setDragStart(false);
                          const f = e.dataTransfer.files?.[0];
                          if (f && f.type.startsWith('image/')) {
                            try {
                              const url = await uploadImage(f);
                              if (activeJob) patchJob(activeJob.id, { startFrameUrl: url });
                            } catch (err: any) {
                              setGlobalError(err?.message || 'Upload failed');
                            }
                          }
                        }}
                        onClick={()=>{
                          const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async ()=>{
                            const f = (input.files?.[0]) || null;
                            if (f) {
                              try {
                                const url = await uploadImage(f);
                                if (activeJob) patchJob(activeJob.id, { startFrameUrl: url });
                              } catch (err: any) {
                                setGlobalError(err?.message || 'Upload failed');
                              }
                            }
                          };
                          input.click();
                        }}
                        >
                          <div className="dnd-icon">🎬</div>
                          <div className="dnd-title">Start Frame</div>
                          <div className="dnd-subtitle">PNG/JPG</div>
                          {activeJob?.startFrameUrl && (
                            <div className="fileInfo" style={{marginTop:'var(--space-3)'}}>
                              <img src={activeJob.startFrameUrl} alt="start" style={{maxWidth:240, borderRadius:'var(--radius-lg)'}} />
                              <div className="small" style={{marginTop:'var(--space-2)'}}><a href={activeJob.startFrameUrl} target="_blank" rel="noreferrer">Open start</a></div>
                            </div>
                          )}
                        </div>
                        {activeJob?.startFrameUrl && (
                          <button className="btn" style={{marginTop:8}} onClick={()=>patchJob(activeJob.id, { startFrameUrl: '' })}>Clear start</button>
                        )}
                      </div>

                      <div>
                        <div className="small">End frame (optional)</div>
                        <div
                          className={`dnd ${dragEnd ? 'drag' : ''}`}
                          onDragOver={(e)=>{e.preventDefault(); setDragEnd(true);}}
                          onDragLeave={(e)=>{e.preventDefault(); setDragEnd(false);}}
                        onDrop={async (e)=>{
                          e.preventDefault();
                          setDragEnd(false);
                          const f = e.dataTransfer.files?.[0];
                          if (f && f.type.startsWith('image/')) {
                            try {
                              const url = await uploadImage(f);
                              if (activeJob) patchJob(activeJob.id, { endFrameUrl: url });
                            } catch (err: any) {
                              setGlobalError(err?.message || 'Upload failed');
                            }
                          }
                        }}
                        onClick={()=>{
                          const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async ()=>{
                            const f = (input.files?.[0]) || null;
                            if (f) {
                              try {
                                const url = await uploadImage(f);
                                if (activeJob) patchJob(activeJob.id, { endFrameUrl: url });
                              } catch (err: any) {
                                setGlobalError(err?.message || 'Upload failed');
                              }
                            }
                          };
                          input.click();
                        }}
                        >
                          <div className="dnd-icon">🏁</div>
                          <div className="dnd-title">End Frame</div>
                          <div className="dnd-subtitle">PNG/JPG</div>
                          {activeJob?.endFrameUrl && (
                            <div className="fileInfo" style={{marginTop:'var(--space-3)'}}>
                              <img src={activeJob.endFrameUrl} alt="end" style={{maxWidth:240, borderRadius:'var(--radius-lg)'}} />
                              <div className="small" style={{marginTop:'var(--space-2)'}}><a href={activeJob.endFrameUrl} target="_blank" rel="noreferrer">Open end</a></div>
                            </div>
                          )}
                        </div>
                        {activeJob?.endFrameUrl && (
                          <button className="btn" style={{marginTop:8}} onClick={()=>patchJob(activeJob.id, { endFrameUrl: '' })}>Clear end</button>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                <section className="veo-control-card">
                  <div className="veo-control-card-header">
                    <div>
                      <div className="small">Model Inputs</div>
                      <div className="veo-control-description">Synced from Replicate schema</div>
                    </div>
                  </div>
                  {schemaLoading ? (
                    <div className="small" style={{marginTop:8}}>Loading model schema…</div>
                  ) : schemaError ? (
                    <div className="small" style={{ color: '#ff7878', marginTop:8 }}>{schemaError}</div>
                  ) : inputSchema ? (
                    <>
                      {uriFields.length > 0 && (
                        <div className="veo-subsection">
                          <div className="veo-subsection-title">Reference media</div>
                          {uriFields.map((fieldKey) => (
                            <div key={fieldKey}>
                              <div className="small">{fieldKey}{Array.isArray(inputSchema?.required) && inputSchema.required.includes(fieldKey) ? ' *' : ''}</div>
                              <div
                                className={`dnd`}
                                onDragOver={(e)=>{e.preventDefault();}}
                                onDrop={async (e)=>{
                                  e.preventDefault();
                                  const f = e.dataTransfer.files?.[0];
                                  if (f) {
                                    try {
                                      const url = await uploadMedia(f);
                                      if (activeJob) {
                                        updateJob(activeJob.id, (job) => ({
                                          ...job,
                                          inputValues: { ...job.inputValues, [fieldKey]: url },
                                        }));
                                      }
                                    } catch (err: any) {
                                      setGlobalError(err?.message || 'Upload failed');
                                    }
                                  }
                                }}
                                onClick={()=>{
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = fieldKey === 'video' ? 'video/*' : (fieldKey === 'character_image' ? 'image/*' : 'image/*,video/*');
                                  input.onchange = async ()=>{
                                    const f = (input.files?.[0]) || null;
                                    if (f) {
                                      try {
                                        const url = await uploadMedia(f);
                                        if (activeJob) {
                                          updateJob(activeJob.id, (job) => ({
                                            ...job,
                                            inputValues: { ...job.inputValues, [fieldKey]: url },
                                          }));
                                        }
                                      } catch (err: any) {
                                        setGlobalError(err?.message || 'Upload failed');
                                      }
                                    }
                                  };
                                  input.click();
                                }}
                              >
                                <div className="dnd-icon">📎</div>
                                <div className="dnd-title">{fieldKey}</div>
                                <div className="dnd-subtitle">{fieldKey === 'video' ? 'Video' : (fieldKey === 'character_image' ? 'Image' : 'Image/Video')} • {Array.isArray(inputSchema?.required) && inputSchema.required.includes(fieldKey) ? 'Required' : 'Optional'}</div>
                                {activeInputs[fieldKey] && (
                                  <div className="fileInfo" style={{marginTop:'var(--space-3)'}}>
                                    {String(activeInputs[fieldKey]).match(/\.(mp4|mov|webm)(\?|$)/i) ? (
                                      <video src={activeInputs[fieldKey]} controls style={{maxWidth:240, borderRadius:'var(--radius-lg)'}} />
                                    ) : (
                                      <img src={activeInputs[fieldKey]} alt={fieldKey} style={{maxWidth:240, borderRadius:'var(--radius-lg)'}} />
                                    )}
                                    <div className="small" style={{marginTop:'var(--space-2)'}}><a href={activeInputs[fieldKey]} target="_blank" rel="noreferrer">Open</a></div>
                                  </div>
                                )}
                              </div>
                              {activeInputs[fieldKey] && activeJob && (
                                <button
                                  className="btn"
                                  style={{marginTop:8}}
                                  onClick={()=>updateJob(activeJob.id, (job) => {
                                    const next = { ...job.inputValues };
                                    delete next[fieldKey];
                                    return { ...job, inputValues: next };
                                  })}
                                >
                                  Clear {fieldKey}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {nonUriFields.length > 0 && (
                        <div className="veo-subsection">
                          <div className="veo-subsection-title">Model parameters</div>
                          {nonUriFields.map(({ key, schema }) => {
                            const required = Array.isArray(inputSchema?.required) && inputSchema.required.includes(key);
                            const title = schema?.title || key;
                            if (Array.isArray(schema?.enum)) {
                              const isNumericEnum = schema?.type === 'integer' || schema?.type === 'number';
                              return (
                                <div key={key}>
                                  <div className="small">{title}{required ? ' *' : ''}</div>
                                  <select
                                    className="select"
                                    value={activeInputs[key] ?? schema.default ?? ''}
                                    onChange={(e)=>{
                                      const val = e.target.value;
                                      if (!activeJob) return;
                                      updateJob(activeJob.id, (job) => ({
                                        ...job,
                                        inputValues: {
                                          ...job.inputValues,
                                          [key]: isNumericEnum ? (schema?.type === 'integer' ? parseInt(val) : parseFloat(val)) : val,
                                        },
                                      }));
                                    }}
                                  >
                                    {schema.enum.map((opt: any) => {
                                      const label = String(opt);
                                      const value = String(opt);
                                      return (
                                        <option key={label} value={value}>{label}</option>
                                      );
                                    })}
                                  </select>
                                </div>
                              );
                            }
                            if (schema?.type === 'integer' || schema?.type === 'number') {
                              const step = schema?.type === 'integer' ? 1 : (schema?.multipleOf || 0.1);
                              return (
                                <div key={key}>
                                  <div className="small">{title}{required ? ' *' : ''}</div>
                                  <input
                                    className="input"
                                    type="number"
                                    step={step}
                                    min={schema?.minimum ?? undefined}
                                    max={schema?.maximum ?? undefined}
                                    value={activeInputs[key] ?? ''}
                                    onChange={(e)=>{
                                      if (!activeJob) return;
                                      const val = e.target.value;
                                      updateJob(activeJob.id, (job) => ({
                                        ...job,
                                        inputValues: {
                                          ...job.inputValues,
                                          [key]: val === '' ? undefined : (schema?.type === 'integer' ? parseInt(val) : parseFloat(val)),
                                        },
                                      }));
                                    }}
                                    placeholder={schema?.description || ''}
                                  />
                                </div>
                              );
                            }
                            if (schema?.type === 'boolean') {
                              return (
                                <label key={key} className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
                                  <input
                                    type="checkbox"
                                    checked={!!activeInputs[key]}
                                    onChange={(e)=>{
                                      if (!activeJob) return;
                                      const checked = e.target.checked;
                                      updateJob(activeJob.id, (job) => ({
                                        ...job,
                                        inputValues: { ...job.inputValues, [key]: checked },
                                      }));
                                    }}
                                  /> {title}{required ? ' *' : ''}
                                </label>
                              );
                            }
                            return (
                              <div key={key}>
                                <div className="small">{title}{required ? ' *' : ''}</div>
                                <input
                                  className="input"
                                  value={activeInputs[key] ?? ''}
                                  onChange={(e)=>{
                                    if (!activeJob) return;
                                    const val = e.target.value;
                                    updateJob(activeJob.id, (job) => ({
                                      ...job,
                                      inputValues: { ...job.inputValues, [key]: val },
                                    }));
                                  }}
                                  placeholder={schema?.description || ''}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {uriFields.length === 0 && nonUriFields.length === 0 && (
                        <div className="small" style={{color:'var(--text-muted)'}}>This model has no additional exposed parameters.</div>
                      )}
                    </>
                  ) : (
                    <div className="small" style={{color:'var(--text-muted)'}}>Select a model to load its inputs.</div>
                  )}
                </section>

                {isGoogleModel && (
                  <section className="veo-control-card">
                    <div className="options" style={{marginTop:0}}>
                      <div>
                        <div className="small">Resolution</div>
                        <select
                          className="select"
                          value={activeJob?.resolution ?? '720p'}
                          onChange={(e)=>{
                            if (activeJob) patchJob(activeJob.id, { resolution: e.target.value as '720p' | '1080p' });
                          }}
                        >
                          <option value="720p">720p</option>
                          <option value="1080p">1080p</option>
                        </select>
                      </div>

                      <div>
                        <div className="small">Seed (optional)</div>
                        <input
                          className="input"
                          type="number"
                          value={activeJob?.seed ?? ''}
                          onChange={(e)=>{
                            if (activeJob) patchJob(activeJob.id, { seed: e.target.value });
                          }}
                          placeholder="Random if empty"
                        />
                      </div>
                    </div>
                  </section>
                )}

                <section className="veo-control-card">
                  <button
                    className="btn"
                    style={{ width: '100%' }}
                    disabled={isBatchRunning || !promptRequirementMet || animateMissingRequired}
                    onClick={()=>runBatch()}
                  >
                    {isBatchRunning ? 'Generating…' : 'Generate videos'}
                  </button>
                </section>
              </div>
            </div>
          </div>
        </div>

        <div className="page-side-panel">
          <div className="side-panel-card">
            <h3>Session</h3>
            <div className="kv">
              <div>Model</div><div>{selectedModelMeta?.label || model}</div>
              <div>Negative prompt</div><div>{supportsNegativePrompt ? 'Yes' : 'Not exposed'}</div>
              <div>Schema</div><div>{schemaLoading ? 'Loading…' : (schemaError ? 'Error' : 'Loaded')}</div>
              <div>Inputs set</div><div>{Object.keys(activeInputs).length}</div>
            </div>
          </div>

          {selectedModelDoc ? (
            <div className="side-panel-card model-doc-card">
              <h3>{selectedModelDoc.title}</h3>
              <p className="small">{selectedModelDoc.description}</p>

              <div className="model-doc-section">
                <strong>Inputs</strong>
                <ul>
                  {selectedModelDoc.inputs.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="model-doc-section">
                <strong>Output schema</strong>
                <pre className="model-doc-code">{selectedModelDoc.outputSchema}</pre>
              </div>

              {selectedModelDoc.examples.map((example) => (
                <div key={example.title} className="model-doc-example">
                  <div className="model-doc-example-header">
                    <strong>{example.title}</strong>
                    {example.link && <a href={example.link} target="_blank" rel="noreferrer">View</a>}
                  </div>
                  <div className="model-doc-example-body">
                    <span className="small">Input</span>
                    <pre className="model-doc-code">{JSON.stringify(example.input, null, 2)}</pre>
                    <span className="small">Output</span>
                    <a href={example.output} target="_blank" rel="noreferrer">{example.output.replace(/^https?:\/\//, '')}</a>
                  </div>
                </div>
              ))}

              <div className="model-doc-section">
                <strong>Tips</strong>
                <ul>
                  {selectedModelDoc.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="side-panel-card">
              <h3>Model Guide</h3>
              <p className="small">Select a model to view detailed inputs, schema, example prompts, and creative tips.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
