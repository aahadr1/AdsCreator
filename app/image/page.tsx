'use client';

import '../globals.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';

const FLUX_KONTEXT_ASPECT_RATIOS = ['match_input_image','1:1','16:9','9:16','4:3','3:4','3:2','2:3','4:5','5:4','21:9','9:21','2:1','1:2'] as const;
const GENERIC_ASPECT_RATIOS = ['1:1','16:9','21:9','3:2','2:3','4:5','5:4','3:4','4:3','9:16','9:21'] as const;
const MULTI_IMAGE_MODELS = new Set(['google/nano-banana','google/nano-banana-pro','openai/gpt-image-1.5','bytedance/seedream-4','bytedance/seedream-4.5']);

type ReplicateStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'queued' | 'unknown';
type ImageJobStatus = 'idle' | 'running' | 'success' | 'error';

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

const IMAGE_MODEL_DOCS: Record<string, ModelDoc> = {
  'openai/gpt-image-1.5': {
    title: 'GPT Image 1.5',
    description: `OpenAI's latest image model with better instruction following, precise facial fidelity, and stronger adherence to prompts.`,
    inputs: [
      'prompt (required) — Describe the scene you want to generate',
      'openai_api_key (optional) — Use your own key or fall back to the shared proxy',
      'aspect_ratio — Any freeform ratio such as "3:2" or "16:9"',
      'input_images — Supply one or more reference URLs for edits or consistency',
      'input_fidelity — low / medium / high to control likeness to references',
      'number_of_images — 1-10 renditions from a single prompt',
      'quality, background, moderation, output_format, output_compression and more for fine control',
    ],
    outputSchema: `{
  "type": "array",
  "items": { "type": "string", "format": "uri" },
  "title": "Output"
}`,
    examples: [
      {
        title: 'Chelsea, London 1970s',
        link: 'https://replicate.com/p/z3jpsevkdhrm80cv56maz0tehw',
        input: {
          prompt: 'make a scene in chelsea, london in the 1970s ... "Create what you imagine"',
          quality: 'high',
          background: 'auto',
          moderation: 'auto',
          aspect_ratio: '1:1',
          output_format: 'webp',
          input_fidelity: 'low',
          number_of_images: 1,
          output_compression: 90,
        },
        output: 'https://replicate.delivery/xezq/cfGqZx844oRYLKNR6CWBVNARYlJVBfmgeOKbGP0z1vzeAqPXB/tmp9zf8qbu4.webp',
      },
      {
        title: 'Combine two men + dog',
        link: 'https://replicate.com/p/p38pkfx4c5rm80cv589aqgsgb8',
        input: {
          prompt: 'Combine the two men and the dog in a 2000s film...',
          quality: 'high',
          background: 'auto',
          moderation: 'auto',
          aspect_ratio: '3:2',
          input_images: [
            'https://replicate.delivery/pbxt/OFNN4DH4OXYel64RkDKDp4HxwoY9tfK5OtYHkWHx3ktKsfe7/man1.webp',
            'https://replicate.delivery/pbxt/OFNN3YocTbB7SITa2UAOHgjz81miTP5Osg3C3zT7QzUJEqwq/man2.webp',
            'https://replicate.delivery/pbxt/OFNN3mVC2NEqTEOwljhVWyEsrccYY5Mzo10ynKHhKM72L2AU/dog1.webp',
          ],
          output_format: 'jpeg',
          input_fidelity: 'low',
          number_of_images: 1,
          output_compression: 90,
        },
        output: 'https://replicate.delivery/xezq/VeuqmSs6b83PbSAfcBxzE65BiHGxiJpeJBGaURgVP24Xa4nrA/tmpnzt7xhtv.jpeg',
      },
    ],
    tips: [
      'Be specific: describe lighting, materials, typography, and what should remain untouched.',
      'Use photo language (lens, depth of field, lighting) when aiming for realism.',
      'Lock critical regions by stating what must not change during edits.',
      'Put any text you need rendered in quotes for better accuracy.',
      'Iterate in small steps — reusing prior outputs as references when refining details.',
    ],
  },
  'bytedance/seedream-4': {
    title: 'Seedream 4',
    description: `ByteDance's unified text-to-image generation and image editing model with multi-reference support up to 4K resolution.`,
    inputs: [
      'prompt (required) — Describe the scene or edit you want to create',
      'image_input (optional) — Up to 10 reference images for multi-reference generation',
      'size — Resolution: 1K, 2K, 4K, or custom dimensions (1024-4096px)',
      'aspect_ratio — Wide range of ratios including match_input_image',
      'sequential_image_generation — Auto mode for batch/related image generation',
      'max_images — Maximum images to generate (1-15) when sequential mode is on',
      'enhance_prompt — Enable prompt enhancement for higher quality (takes longer)',
      'width/height — Custom dimensions when size is set to custom',
    ],
    outputSchema: `{
  "type": "array",
  "items": { "type": "string", "format": "uri" },
  "title": "Output"
}`,
    examples: [],
    tips: [
      'Use multi-reference mode with 2-10 images to blend styles or maintain consistency.',
      'Enable sequential_image_generation for batch workflows like story scenes or variations.',
      'Set enhance_prompt to true for complex prompts but expect longer generation times.',
      'Supports both text-to-image and image editing in a single unified model.',
    ],
  },
  'bytedance/seedream-4.5': {
    title: 'Seedream 4.5',
    description: `Upgraded Seedream with stronger spatial understanding, world knowledge, and cinematic aesthetics. Note: 1K resolution not supported.`,
    inputs: [
      'prompt (required) — Detailed description of the image you want',
      'image_input (optional) — Up to 14 reference images for multi-reference generation',
      'size — Resolution: 2K or 4K only (1K not supported in 4.5)',
      'aspect_ratio — Comprehensive aspect ratio support including match_input_image',
      'sequential_image_generation — Auto mode for generating multiple related images',
      'max_images — Maximum images to generate (1-15) in sequential mode',
      'width/height — Custom dimensions (1024-4096px) when size is custom',
    ],
    outputSchema: `{
  "type": "array",
  "items": { "type": "string", "format": "uri" },
  "title": "Output"
}`,
    examples: [],
    tips: [
      'Superior aesthetics with cinematic lighting and refined rendering compared to Seedream 4.',
      'Better spatial understanding for realistic proportions and believable environments.',
      'Ideal for professional workflows: e-commerce, film/advertising, architectural design.',
      'Use up to 14 reference images for complex multi-image blending.',
    ],
  },
  'bytedance/seededit-3.0': {
    title: 'Seededit 3.0',
    description: `Text-guided image editing that preserves original details while making targeted modifications like lighting changes, object removal, and style conversion.`,
    inputs: [
      'image (required) — Input image URL to edit',
      'prompt (required) — Editing instructions (e.g., "Change text to X", "Remove background")',
      'guidance_scale (optional) — Prompt adherence (default: 5.5), higher = more literal',
      'seed (optional) — Random seed for reproducible edits',
    ],
    outputSchema: `{
  "type": "string",
  "format": "uri",
  "title": "Output"
}`,
    examples: [],
    tips: [
      'Be specific with edit instructions: "Replace headline text with \'SALE\' keeping same font"',
      'Works great for: lighting changes, object removal, style conversion, text replacement.',
      'Preserves unedited areas with high fidelity - perfect for targeted modifications.',
      'Use higher guidance_scale (6-8) for more literal interpretation of edits.',
    ],
  },
};

type ImageResponse = { id?: string | null; status?: string | null };

type ImageJobRecord = {
  id: string;
  label: string;
  prompt: string;
  inputImages: string[];
  status: ImageJobStatus;
  outputUrl: string | null;
  rawOutputUrl: string | null;
  error: string | null;
  kvTaskId: string | null;
  supabaseTaskId: string | null;
  predictionId: string | null;
};

const DEFAULT_IMAGE_PROMPT = 'A stunning digital artwork of a futuristic cityscape at sunset, with neon lights reflecting on wet streets';

const makeImageJob = (index: number): ImageJobRecord => ({
  id: `image-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  label: `Generation ${index}`,
  prompt: DEFAULT_IMAGE_PROMPT,
  inputImages: [],
  status: 'idle',
  outputUrl: null,
  rawOutputUrl: null,
  error: null,
  kvTaskId: null,
  supabaseTaskId: null,
  predictionId: null,
});

export default function ImagePage() {
  const [model, setModel] = useState<
    | 'google/nano-banana'
    | 'google/nano-banana-pro'
    | 'openai/gpt-image-1.5'
    | 'bytedance/seedream-4'
    | 'bytedance/seedream-4.5'
    | 'bytedance/seededit-3.0'
  >('openai/gpt-image-1.5');
  const [jobs, setJobs] = useState<ImageJobRecord[]>(() => [makeImageJob(1)]);
  const [activeJobId, setActiveJobId] = useState<string>(jobs[0]?.id || '');
  const [applyPromptToAll, setApplyPromptToAll] = useState(true);
  const [sharedPrompt, setSharedPrompt] = useState(DEFAULT_IMAGE_PROMPT);
  const [negativePrompt, setNegativePrompt] = useState('blurry, low quality, distorted, ugly');
  const [aspectRatio, setAspectRatio] = useState('match_input_image');
  const [outputFormat, setOutputFormat] = useState<'jpg' | 'png' | 'webp'>('png');
  const [seed, setSeed] = useState<string>('');
  const [safetyTolerance, setSafetyTolerance] = useState<number>(2);
  const [promptUpsampling, setPromptUpsampling] = useState(false);
  const [resolution, setResolution] = useState<string>('2K');
  const [safetyFilterLevel, setSafetyFilterLevel] = useState<string>('block_only_high');

  const [openAiApiKey, setOpenAiApiKey] = useState('');
  const [inputFidelity, setInputFidelity] = useState<'low' | 'medium' | 'high'>('low');
  const [qualityPreset, setQualityPreset] = useState<'standard' | 'high'>('high');
  const [backgroundSetting, setBackgroundSetting] = useState<'auto' | 'transparent' | 'opaque'>('auto');
  const [outputCompression, setOutputCompression] = useState<number>(90);
  const [moderationSetting, setModerationSetting] = useState<'auto' | 'lenient' | 'strict' | 'none'>('auto');
  const [userId, setUserId] = useState('');
  
  const [guidance, setGuidance] = useState<number>(7.5);
  const [outputQuality, setOutputQuality] = useState<number>(80);
  const [numOutputs, setNumOutputs] = useState<number>(1);
  const [steps, setSteps] = useState<number>(25);
  const [strength, setStrength] = useState<number>(0.8);

  const [dragInput, setDragInput] = useState(false);

  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const promptReadyAll = useMemo(
    () => (applyPromptToAll ? !!sharedPrompt.trim() : jobs.every((job) => (job.prompt || '').trim().length > 0)),
    [applyPromptToAll, sharedPrompt, jobs],
  );
  const supportsMultipleInputImages = MULTI_IMAGE_MODELS.has(model);
  const maxImageOutputs = model === 'openai/gpt-image-1.5' ? 10 : 4;

  const selectedDoc = useMemo(() => IMAGE_MODEL_DOCS[model] || null, [model]);
const activeJob = useMemo(() => jobs.find((job) => job.id === activeJobId) ?? jobs[0], [jobs, activeJobId]);
  const promptReadyActive = useMemo(
    () => (applyPromptToAll ? !!sharedPrompt.trim() : !!(activeJob?.prompt || '').trim()),
    [applyPromptToAll, sharedPrompt, activeJob],
  );
const sharedPromptValue = useMemo(
  () => (applyPromptToAll ? sharedPrompt : activeJob?.prompt ?? sharedPrompt),
  [applyPromptToAll, sharedPrompt, activeJob],
);

  const updateJob = useCallback((jobId: string, updater: (prev: ImageJobRecord) => ImageJobRecord) => {
    setJobs((prev) => prev.map((job) => (job.id === jobId ? updater(job) : job)));
  }, []);

  const patchJob = useCallback(
    (jobId: string, patch: Partial<ImageJobRecord>) => {
      updateJob(jobId, (job) => ({ ...job, ...patch }));
    },
    [updateJob],
  );

  const addJob = useCallback(() => {
    setJobs((prev) => {
      const base = makeImageJob(prev.length + 1);
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

  useEffect(() => {
    const first = makeImageJob(1);
    setJobs([first]);
    setActiveJobId(first.id);
    setSharedPrompt(DEFAULT_IMAGE_PROMPT);
  }, [model]);

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    form.append('filename', file.name);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { url: string };
    return json.url;
  }, []);

  async function persistUrlIfPossible(url: string): Promise<string> {
    try {
      const res = await fetch('/api/persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, filename: url.split('/').pop() || null, folder: 'image' })
      });
      if (!res.ok) return url;
      const j = await res.json();
      return typeof j?.url === 'string' ? j.url : url;
    } catch {
      return url;
    }
  }

  const buildModelOptionsForJob = (job: ImageJobRecord, includeSensitive = false): Record<string, any> => {
    const promptValue = applyPromptToAll ? sharedPrompt : job.prompt;
    const normalizedFormat = model === 'openai/gpt-image-1.5' && outputFormat === 'jpg' ? 'jpeg' : outputFormat;
    const sanitizedFluxAspect = FLUX_KONTEXT_ASPECT_RATIOS.includes(aspectRatio as (typeof FLUX_KONTEXT_ASPECT_RATIOS)[number])
      ? aspectRatio
      : 'match_input_image';
    const sanitizedGenericAspect = GENERIC_ASPECT_RATIOS.includes(aspectRatio as (typeof GENERIC_ASPECT_RATIOS)[number])
      ? aspectRatio
      : '1:1';
    const seedNumber = seed.trim() === '' ? undefined : Number(seed);
    const clampOutputs = (max: number) => Math.min(max, Math.max(1, Number(numOutputs) || 1));
    const base: Record<string, any> = { model, prompt: promptValue, output_format: normalizedFormat };

    if (model === 'google/nano-banana') {
      base.image_input = job.inputImages.length ? job.inputImages : undefined;
    } else if (model === 'google/nano-banana-pro') {
      base.image_input = job.inputImages.length ? job.inputImages : undefined;
      base.aspect_ratio = sanitizedGenericAspect;
      base.resolution = resolution;
      base.safety_filter_level = safetyFilterLevel;
    } else if (model === 'openai/gpt-image-1.5') {
      base.aspect_ratio = sanitizedGenericAspect;
      if (job.inputImages.length) base.input_images = job.inputImages;
      base.input_fidelity = inputFidelity;
      base.quality = qualityPreset;
      base.background = backgroundSetting;
      base.number_of_images = clampOutputs(10);
      base.output_compression = Math.min(100, Math.max(0, Number(outputCompression) || 0));
      base.moderation = moderationSetting;
      if (userId.trim()) base.user_id = userId.trim();
      if (includeSensitive && openAiApiKey.trim()) base.openai_api_key = openAiApiKey.trim();
    }

    return base;
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function pollPrediction(jobId: string, predictionId: string, kvId: string | null, supabaseTaskId: string | null) {
    while (true) {
      const statusRes = await fetch(`/api/replicate/status?id=${encodeURIComponent(predictionId)}`);
      if (!statusRes.ok) break;
      const payload = await statusRes.json();
      const st: ReplicateStatus = payload.status || 'unknown';

      const jobStatus = st === 'succeeded' ? 'success' : st === 'failed' || st === 'canceled' ? 'error' : 'running';
      patchJob(jobId, { status: jobStatus });
      
      // Update global task state for favicon
      const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
      updateTaskStateFromJobStatus(jobStatus);

      const supabaseUpdate: Record<string, any> = { status: st };
      if (payload.outputUrl && typeof payload.outputUrl === 'string') {
        const persisted = await persistUrlIfPossible(payload.outputUrl);
        const proxied = `/api/proxy?url=${encodeURIComponent(persisted)}`;
        patchJob(jobId, { rawOutputUrl: persisted, outputUrl: proxied });
        supabaseUpdate.output_url = proxied;
        if (kvId) {
          try {
            await fetch('/api/tasks/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: kvId, status: st, output_url: persisted }),
            });
          } catch {}
        }
      } else if (kvId) {
        try {
          await fetch('/api/tasks/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: kvId, status: st }),
          });
        } catch {}
      }
      if (supabaseTaskId) {
        await supabase.from('tasks').update(supabaseUpdate).eq('id', supabaseTaskId);
      }

      if (st === 'succeeded' || st === 'failed' || st === 'canceled') {
        if (st !== 'succeeded' && payload.error) {
          patchJob(jobId, { error: typeof payload.error === 'string' ? payload.error : 'Generation failed' });
        }
        break;
      }
      await sleep(2000);
    }
  }

  async function runSingleJob(job: ImageJobRecord) {
    const promptValue = applyPromptToAll ? sharedPrompt : job.prompt;
    if (!promptValue.trim()) {
      patchJob(job.id, { status: 'error', error: 'Prompt required' });
      return;
    }
    patchJob(job.id, { status: 'running', error: null, outputUrl: null, rawOutputUrl: null });
    // Update global task state for favicon
    const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
    updateTaskStateFromJobStatus('running');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in at /auth before creating a task.');

      const optionsPublic = buildModelOptionsForJob(job, false);
      let kvIdLocal: string | null = null;
      let supabaseTaskId: string | null = null;

      try {
        const createRes = await fetch('/api/tasks/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            type: 'image',
            status: 'queued',
            provider: 'replicate',
            model_id: model,
            options_json: optionsPublic,
            text_input: promptValue,
            image_url: job.inputImages[0] || null,
          }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          kvIdLocal = created?.id || null;
          patchJob(job.id, { kvTaskId: kvIdLocal });
        }
      } catch {}

      const { data: inserted, error: insertErr } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          type: 'image',
          status: 'queued',
          provider: 'replicate',
          model_id: model,
          options_json: optionsPublic,
          text_input: promptValue,
        })
        .select('*')
        .single();
      if (insertErr || !inserted) throw new Error(insertErr?.message || 'Failed to create task');
      supabaseTaskId = inserted.id;
      patchJob(job.id, { supabaseTaskId });

      const res = await fetch('/api/image/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildModelOptionsForJob(job, true)),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as ImageResponse;
      if (!json.id) throw new Error('No prediction ID returned');
      patchJob(job.id, { predictionId: json.id });

      await pollPrediction(job.id, json.id, kvIdLocal, supabaseTaskId);
    } catch (e: any) {
      const message = e?.message || 'Failed to generate image';
      patchJob(job.id, { status: 'error', error: message });
      // Update global task state for favicon
      const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
      updateTaskStateFromJobStatus('error');
      const targetKv = job.kvTaskId;
      if (targetKv) {
        try {
          await fetch('/api/tasks/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: targetKv, status: 'error' }),
          });
        } catch {}
      }
    }
  }

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

  return (
    <div className="page-template generator fade-in">
      <header className="page-hero">
        <div>
          <p className="page-eyebrow">Image Generation</p>
          <h1>Image Lab</h1>
          <p className="page-description">
GPT Image 1.5, Nano Banana, Seedream, and more in one workspace. Layer references, edit identities, and export production-ready visuals.
          </p>
        </div>
        <div className="page-hero-actions">
          <a href="/tasks" className="hero-link">View tasks</a>
          <a href="/credits" className="hero-link">Credit status</a>
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
              placeholder="Type your prompt once and keep the run controls in reach."
            />
            <label className="apply-all-toggle" style={{marginTop: 'var(--space-2)'}}>
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
            <div className="small" style={{color:'var(--text-muted)'}}>
              Active: {activeJob?.label || 'n/a'}
            </div>
            <button
              className="btn inline"
              onClick={runActiveJob}
              disabled={isBatchRunning || !promptReadyActive}
            >
              Run active
            </button>
            <button
              className="btn"
              onClick={()=>runBatch()}
              disabled={isBatchRunning || !promptReadyAll}
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
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <h2 style={{margin:0}}>Output</h2>
                </div>
                <div className="small">Bulk-ready previews</div>
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
                    {job.outputUrl ? (
                      <>
                        <img
                          src={job.outputUrl}
                          alt="Generated image"
                          style={{ maxWidth: '100%', borderRadius: 8 }}
                          onError={()=> patchJob(job.id, { error: 'Failed to load image. Try the direct link below.' })}
                        />
                        <div className="small" style={{ marginTop: 8, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
                          <a href={job.outputUrl} target="_blank" rel="noreferrer" style={{padding:'8px 12px', background:'var(--panel-elevated)', borderRadius:'6px', textDecoration:'none'}}>Open via proxy</a>
                          {job.rawOutputUrl ? (
                            <a href={job.rawOutputUrl} target="_blank" rel="noreferrer" style={{padding:'8px 12px', background:'var(--panel-elevated)', borderRadius:'6px', textDecoration:'none'}}>Open direct</a>
                          ) : null}
                          <a href={`${job.outputUrl}${job.outputUrl.includes('?') ? '&' : '?'}download=true`} style={{padding:'8px 12px', background:'var(--accent)', color:'var(--color-black)', borderRadius:'6px', textDecoration:'none'}}>Download</a>
                        </div>
                      </>
                    ) : (
                      <div style={{fontSize:16, color:'#b7c2df'}}>Generated image will appear here.</div>
                    )}
                    {job.error && (
                      <div className="small" style={{ marginTop: 'var(--space-2)', color: '#ff7878' }}>{job.error}</div>
                    )}
                  </div>
                ))}
              </div>
              {globalError && (
                <div className="small" style={{ color: '#ff7878', marginTop:8 }}>{globalError}</div>
              )}
            </div>

            <div className="panel">
              <div className="header">
                <h3 style={{margin:0}}>Model Configuration</h3>
                <span className="badge">AI Image Generation</span>
              </div>

              <div className="options">
                <div style={{gridColumn: 'span 2'}}>
                  <div className="small">Model</div>
                  <select className="select" value={model} onChange={(e)=>setModel(e.target.value as any)}>
                    <option value="openai/gpt-image-1.5">OpenAI GPT Image 1.5</option>
                    <option value="google/nano-banana">Google Nano Banana</option>
                    <option value="google/nano-banana-pro">Google Nano Banana Pro 🍌🍌</option>
                    <option value="bytedance/seedream-4">ByteDance Seedream 4</option>
                    <option value="bytedance/seedream-4.5">ByteDance Seedream 4.5</option>
                    <option value="bytedance/seededit-3.0">ByteDance Seededit 3.0</option>
                  </select>
                </div>
              </div>

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

              <div className="options">
                <div style={{gridColumn: 'span 2'}}>
                  <div className="small">Prompt</div>
                  <textarea
                    className="input"
                    value={applyPromptToAll ? sharedPrompt : (activeJob?.prompt ?? '')}
                    onChange={(e)=>{
                      const next = e.target.value;
                      if (applyPromptToAll) setSharedPrompt(next);
                      else if (activeJob) patchJob(activeJob.id, { prompt: next });
                    }}
                    rows={4}
                    placeholder="Describe the image you want to generate or edit..."
                  />
                </div>
                
                <div style={{gridColumn: 'span 2'}}>
                  <div className="small">Negative Prompt (Optional)</div>
                  <textarea
                    className="input"
                    value={negativePrompt}
                    onChange={(e)=>setNegativePrompt(e.target.value)}
                    rows={2}
                    placeholder="What to avoid in the image..."
                  />
                </div>
              </div>

              <div>
                <div className="small">Input image (optional)</div>
                {supportsMultipleInputImages && (
                  <div className="small" style={{color:'var(--text-muted)', marginBottom:4}}>Per-job references: each generation can have its own stack of input images.</div>
                )}
                <div
                  className={`dnd ${dragInput ? 'drag' : ''}`}
                  onDragOver={(e)=>{e.preventDefault(); setDragInput(true);}}
                  onDragLeave={(e)=>{e.preventDefault(); setDragInput(false);}}
                  onDrop={async (e)=>{
                    e.preventDefault();
                    setDragInput(false);
                    const files = Array.from(e.dataTransfer.files || []).filter(f=>f.type.startsWith('image/'));
                    if (!files.length) return;
                    try {
                      const urls = await Promise.all(files.map(f=>uploadImage(f)));
                      if (supportsMultipleInputImages) {
                        if (activeJob) {
                          const merged = [...(activeJob.inputImages || []), ...urls].slice(0, 10);
                          patchJob(activeJob.id, { inputImages: merged });
                        }
                      } else if (activeJob) {
                        patchJob(activeJob.id, { inputImages: [urls[0]] });
                      }
                    } catch (err: any) {
                      setGlobalError(err?.message || 'Upload failed');
                    }
                  }}
                  onClick={()=>{
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    if (supportsMultipleInputImages) (input as any).multiple = true;
                    input.onchange = async ()=>{
                      const files = Array.from(input.files || []);
                      if (!files.length) return;
                      try {
                        const urls = await Promise.all(files.map(f=>uploadImage(f)));
                        if (supportsMultipleInputImages) {
                          if (activeJob) {
                            const merged = [...(activeJob.inputImages || []), ...urls].slice(0, 10);
                            patchJob(activeJob.id, { inputImages: merged });
                          }
                        } else if (activeJob) {
                          patchJob(activeJob.id, { inputImages: [urls[0]] });
                        }
                      } catch (err: any) {
                        setGlobalError(err?.message || 'Upload failed');
                      }
                    };
                    input.click();
                  }}
                >
                  <div className="dnd-icon">🖼️</div>
                  <div className="dnd-title">Reference Image</div>
                  <div className="dnd-subtitle">PNG/JPG/GIF/WebP • Optional for image editing</div>
                  {supportsMultipleInputImages ? (
                    activeJob?.inputImages?.length ? (
                      <div className="fileInfo" style={{marginTop:'var(--space-3)', display:'flex', flexWrap:'wrap', gap:'var(--space-2)'}}>
                        {activeJob.inputImages.map((url, idx) => (
                          <div key={url+idx}>
                            <img src={url} alt={`input-${idx}`} style={{maxWidth:120, borderRadius:'var(--radius-lg)'}} />
                            <div className="small" style={{marginTop:'var(--space-1)'}}><a href={url} target="_blank" rel="noreferrer">Open</a></div>
                          </div>
                        ))}
                      </div>
                    ) : null
                  ) : (
                    activeJob?.inputImages?.[0] && (
                      <div className="fileInfo" style={{marginTop:'var(--space-3)'}}>
                        <img src={activeJob.inputImages[0]} alt="input" style={{maxWidth:240, borderRadius:'var(--radius-lg)'}} />
                        <div className="small" style={{marginTop:'var(--space-2)'}}><a href={activeJob.inputImages[0]} target="_blank" rel="noreferrer">Open image</a></div>
                      </div>
                    )
                  )}
                </div>
                {supportsMultipleInputImages ? (
                  activeJob?.inputImages?.length ? (
                    <button className="btn" style={{marginTop:8}} onClick={()=>activeJob && patchJob(activeJob.id, { inputImages: [] })}>Clear images</button>
                  ) : null
                ) : (
                  activeJob?.inputImages?.[0] ? (
                    <button className="btn" style={{marginTop:8}} onClick={()=>activeJob && patchJob(activeJob.id, { inputImages: [] })}>Clear image</button>
                  ) : null
                )}
              </div>

              <div className="options">
                <div>
                  <div className="small">Aspect Ratio</div>
                  <select className="select" value={aspectRatio} onChange={(e)=>setAspectRatio(e.target.value)}>
                    {GENERIC_ASPECT_RATIOS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="small">Output Format</div>
                  <select className="select" value={outputFormat} onChange={(e)=>setOutputFormat(e.target.value as any)}>
                    <option value="png">PNG</option>
                    <option value="jpg">JPG</option>
                    {model === 'openai/gpt-image-1.5' && (
                      <option value="webp">WebP</option>
                    )}
                  </select>
                </div>

                <div>
                  <div className="small">Seed</div>
                  <input className="input" type="number" value={seed} onChange={(e)=>setSeed(e.target.value)} placeholder="Random if empty" />
                </div>

                <div>
                  <div className="small">Number of Images (max {maxImageOutputs})</div>
                  <input className="input" type="number" min={1} max={maxImageOutputs} value={numOutputs} onChange={(e)=>setNumOutputs(parseInt(e.target.value || '1'))} />
                </div>
              </div>

              <div className="options">
                <div>
                  <div className="small">Guidance Scale</div>
                  <input className="input" type="number" step={0.5} min={1} max={20} value={guidance} onChange={(e)=>setGuidance(parseFloat(e.target.value || '7.5'))} />
                </div>

                <div>
                  <div className="small">Steps</div>
                  <input className="input" type="number" min={1} max={100} value={steps} onChange={(e)=>setSteps(parseInt(e.target.value || '25'))} />
                </div>

                {activeJob?.inputImages?.[0] && (
                  <div>
                    <div className="small">Strength</div>
                    <input className="input" type="number" step={0.1} min={0} max={1} value={strength} onChange={(e)=>setStrength(parseFloat(e.target.value || '0.8'))} />
                  </div>
                )}

                <div>
                  <div className="small">Quality</div>
                  <input className="input" type="number" min={0} max={100} value={outputQuality} onChange={(e)=>setOutputQuality(parseInt(e.target.value || '80'))} />
                </div>
              </div>

              {model === 'google/nano-banana-pro' && (
                <div className="options">
                  <div>
                    <div className="small">Resolution</div>
                    <select className="select" value={resolution} onChange={(e)=>setResolution(e.target.value)}>
                      <option value="1K">1K</option>
                      <option value="2K">2K</option>
                      <option value="4K">4K</option>
                    </select>
                  </div>
                  <div>
                    <div className="small">Safety Filter Level</div>
                    <select className="select" value={safetyFilterLevel} onChange={(e)=>setSafetyFilterLevel(e.target.value)}>
                      <option value="block_low_and_above">Block Low and Above (Strictest)</option>
                      <option value="block_medium_and_above">Block Medium and Above</option>
                      <option value="block_only_high">Block Only High (Most Permissive)</option>
                    </select>
                  </div>
                </div>
              )}

              {model === 'openai/gpt-image-1.5' && (
                <>
                  <div className="options">
                    <div style={{gridColumn:'span 2'}}>
                      <div className="small">OpenAI API Key (optional)</div>
                      <input
                        className="input"
                        type="password"
                        value={openAiApiKey}
                        onChange={(e)=>setOpenAiApiKey(e.target.value)}
                        placeholder="sk-..."
                      />
                      <div className="small" style={{marginTop:4, fontSize:12, opacity:0.8}}>Leave blank to use the shared proxy key.</div>
                    </div>
                    <div>
                      <div className="small">Input Fidelity</div>
                      <select className="select" value={inputFidelity} onChange={(e)=>setInputFidelity(e.target.value as any)}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <div className="small">Quality</div>
                      <select className="select" value={qualityPreset} onChange={(e)=>setQualityPreset(e.target.value as any)}>
                        <option value="standard">Standard</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                  <div className="options">
                    <div>
                      <div className="small">Background</div>
                      <select className="select" value={backgroundSetting} onChange={(e)=>setBackgroundSetting(e.target.value as any)}>
                        <option value="auto">Auto</option>
                        <option value="transparent">Transparent</option>
                        <option value="opaque">Opaque</option>
                      </select>
                    </div>
                    <div>
                      <div className="small">Moderation</div>
                      <select className="select" value={moderationSetting} onChange={(e)=>setModerationSetting(e.target.value as any)}>
                        <option value="auto">Auto</option>
                        <option value="lenient">Lenient</option>
                        <option value="strict">Strict</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    <div>
                      <div className="small">Output Compression (%)</div>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        max={100}
                        value={outputCompression}
                        onChange={(e)=>setOutputCompression(Math.min(100, Math.max(0, parseInt(e.target.value || '0') || 0)))}
                      />
                    </div>
                    <div style={{gridColumn:'span 2'}}>
                      <div className="small">User ID (optional)</div>
                      <input
                        className="input"
                        value={userId}
                        onChange={(e)=>setUserId(e.target.value)}
                        placeholder="user-123"
                      />
                    </div>
              </div>
            </>
          )}

          <button
            className="btn"
            style={{ marginTop: 12 }}
            disabled={isBatchRunning || !promptReadyAll}
            onClick={()=>runBatch()}
          >
            {isBatchRunning ? 'Generating…' : 'Generate images'}
          </button>
        </div>
      </div>
    </div>

    <div className="page-side-panel">
      <div className="side-panel-card">
        <h3>Status</h3>
        <div className="kv">
          <div>Jobs</div><div>{jobs.length}</div>
          <div>Running</div><div>{jobs.filter((j)=>j.status === 'running').length}</div>
          <div>Completed</div><div>{jobs.filter((j)=>j.status === 'success').length}</div>
          <div>Model</div><div>{model}</div>
        </div>
        <p className="small" style={{marginTop:12}}>
          Bulk generation applies your prompt across multiple image references. Use the job tabs to attach different inputs, then run them in one click.
        </p>
      </div>

      {selectedDoc ? (
            <div className="side-panel-card model-doc-card">
              <h3>{selectedDoc.title}</h3>
              <p className="small">{selectedDoc.description}</p>

              <div className="model-doc-section">
                <strong>Inputs</strong>
                <ul>
                  {selectedDoc.inputs.map((input) => (
                    <li key={input}>{input}</li>
                  ))}
                </ul>
              </div>

              <div className="model-doc-section">
                <strong>Output schema</strong>
                <pre className="model-doc-code">{selectedDoc.outputSchema}</pre>
              </div>

              {selectedDoc.examples.map((example) => (
                <div key={example.title} className="model-doc-example">
                  <div className="model-doc-example-header">
                    <strong>{example.title}</strong>
                    {example.link && (
                      <a href={example.link} target="_blank" rel="noreferrer">View</a>
                    )}
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
                  {selectedDoc.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="side-panel-card">
              <h3>Model Guide</h3>
              <p className="small">Select OpenAI GPT Image 1.5 to unlock detailed docs, examples, and prompt advice.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
