/* eslint-disable react/no-array-index-key */
'use client';

import '../globals.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';
import type { AssistantPlan, AssistantPlanMessage, AssistantMedia, AssistantPlanStep, AssistantRunEvent } from '../../types/assistant';
import { TOOL_SPECS, fieldsForModel, defaultsForModel } from '../../lib/assistantTools';
import { Sparkles, Paperclip, Settings2, Send, Play, Loader2, CheckCircle2, XCircle, RefreshCw, Upload, MessageSquare, Wand2 } from 'lucide-react';

type StepConfig = { model: string; inputs: Record<string, any> };
type StepState = { status: 'idle' | 'running' | 'complete' | 'error'; outputUrl?: string | null; outputText?: string | null; error?: string | null };

const EMPTY_PLAN: AssistantPlan = { summary: 'No plan yet', steps: [] };

const ACTION_DESCRIPTIONS: Record<string, { base: string; withUpload?: string }> = {
  image: { base: 'create the hero still image', withUpload: 'modify your uploaded image' },
  video: { base: 'animate the approved still into a video spot' },
  enhance: { base: 'enhance and upscale the imagery' },
  background_remove: { base: 'remove the background from the clip' },
  lipsync: { base: 'apply lipsync using the prepared audio' },
  transcription: { base: 'transcribe the audio' },
  tts: { base: 'generate narration audio' },
};

const stepIntro = (idx: number, total: number): string => {
  if (idx === 0) return 'First,';
  if (idx === total - 1) return 'Finally,';
  return 'Then,';
};

const inputsContainUrl = (inputs: Record<string, any> | undefined, url: string | undefined): boolean => {
  if (!inputs || !url) return false;
  try {
    return JSON.stringify(inputs).includes(url);
  } catch {
    return false;
  }
};

const describePlanIntent = (
  plan: AssistantPlan,
  media: AssistantMedia[],
  history: AssistantPlanMessage[],
): string => {
  if (!plan.steps.length) return 'No workflow planned yet.';
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  const requestLine = lastUser ? `You asked: "${lastUser.content.trim()}".` : '';
  const counts = media.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
  const attachmentParts = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`);
  const attachmentLine = attachmentParts.length ? `I detected ${attachmentParts.join(' and ')} attached.` : '';
  const stepLookup = new Map(plan.steps.map((s) => [s.id, s]));
  const total = plan.steps.length;
  const sentences = plan.steps.map((step, idx) => {
    const intro = stepIntro(idx, total);
    const usesUpload = media.some((m) => inputsContainUrl(step.inputs, m.url || ''));
    const desc = ACTION_DESCRIPTIONS[step.tool] || { base: step.title ? step.title.toLowerCase() : `run ${step.tool}` };
    const action = usesUpload && desc.withUpload ? desc.withUpload : desc.base;
    const dependencyTitles = (step.dependencies || [])
      .map((depId) => stepLookup.get(depId))
      .filter(Boolean)
      .map((dep) => `"${dep!.title || dep!.id}"`);
    const dependencyText = dependencyTitles.length
      ? ` using the output from ${dependencyTitles.join(' and ')}`
      : usesUpload
        ? ' using your provided asset'
        : '';
    const modelText = step.model ? ` with ${step.model}` : '';
    return `${intro} I will ${action}${dependencyText}${modelText}.`.replace(/\s+/g, ' ').trim();
  });
  return [requestLine, attachmentLine, 'Here is the workflow I will run:', ...sentences].filter(Boolean).join(' ');
};

export default function AssistantPage() {
  const [userId, setUserId] = useState<string>('');
  const [messages, setMessages] = useState<AssistantPlanMessage[]>([{ role: 'user', content: 'Create a short product hero video with a voiceover.' }]);
  const [draft, setDraft] = useState<string>('');
  const [attachments, setAttachments] = useState<AssistantMedia[]>([]);
  const [plan, setPlan] = useState<AssistantPlan>(EMPTY_PLAN);
  const [planLoading, setPlanLoading] = useState(false);
  const [stepConfigs, setStepConfigs] = useState<Record<string, StepConfig>>({});
  const [stepStates, setStepStates] = useState<Record<string, StepState>>({});
  const [activeStep, setActiveStep] = useState<AssistantPlanStep | null>(null);
  const [uploading, setUploading] = useState(false);
  const [runState, setRunState] = useState<'idle' | 'running' | 'done'>('idle');
  const [runError, setRunError] = useState<string | null>(null);
  const streamRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  const validateStep = (step: AssistantPlanStep, cfg: StepConfig): string[] => {
    const errors: string[] = [];
    const spec = TOOL_SPECS[step.tool];
    const fields = fieldsForModel(cfg.model || step.model, step.tool);
    for (const field of fields) {
      if (!field.required) continue;
      const val = cfg.inputs?.[field.key];
      if (val === undefined || val === null) {
        errors.push(`${field.label} required`);
        continue;
      }
      if (typeof val === 'string' && !val.trim()) errors.push(`${field.label} required`);
    }
    if (step.tool === 'video' && step.model.includes('kling-v2.1') && !cfg.inputs?.start_image) {
      errors.push('Kling v2.1 requires start_image');
    }
    if (step.tool === 'image' && step.model === 'openai/gpt-image-1.5') {
      const count = Number(cfg.inputs?.number_of_images || 0);
      if (count > 10) errors.push('GPT Image 1.5 allows up to 10 images');
    }
    return errors;
  };

  const planReady = useMemo(() => {
    if (!plan.steps.length) return false;
    return plan.steps.every((step) => {
      const cfg = stepConfigs[step.id] || { model: step.model, inputs: step.inputs };
      return validateStep(step, cfg).length === 0;
    });
  }, [plan, stepConfigs]);

  const stepMap = useMemo(() => Object.fromEntries(plan.steps.map((s) => [s.id, s])), [plan]);

  const updateStepConfig = (stepId: string, next: StepConfig) => {
    setStepConfigs((prev) => ({ ...prev, [stepId]: next }));
  };

  const openConfigurator = (step: AssistantPlanStep) => {
    setActiveStep(step);
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    const next: AssistantMedia[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      form.append('filename', file.name);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (res.ok) {
        const json = await res.json();
        const kind = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'unknown';
        next.push({ type: kind as AssistantMedia['type'], url: json.url, label: file.name });
      }
    }
    setAttachments((prev) => [...prev, ...next]);
    setUploading(false);
  };

  const generatePlan = async (overrideMessages?: AssistantPlanMessage[]) => {
    if (!userId) {
      setRunError('Sign in at /auth to generate a plan.');
      return;
    }
    setPlanLoading(true);
    setRunError(null);
    const payloadMessages: AssistantPlanMessage[] = overrideMessages || messages;
    const pendingDraft = draft.trim();
    const draftMessage: AssistantPlanMessage | null = pendingDraft ? { role: 'user', content: pendingDraft } : null;
    const finalMessages: AssistantPlanMessage[] = draftMessage ? [...payloadMessages, draftMessage] : payloadMessages;
    setMessages(finalMessages);
    if (pendingDraft) setDraft('');
    try {
      const res = await fetch('/api/assistant/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: finalMessages, media: attachments, user_id: userId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const nextPlan: AssistantPlan = json.plan || json;
      setPlan(nextPlan);
      const nextConfigs: Record<string, StepConfig> = {};
      const nextStates: Record<string, StepState> = {};
      for (const step of nextPlan.steps) {
        nextConfigs[step.id] = { model: step.model, inputs: { ...step.inputs } };
        nextStates[step.id] = { status: 'idle' };
      }
      setStepConfigs(nextConfigs);
      setStepStates(nextStates);
      const narrative = describePlanIntent(nextPlan, attachments, finalMessages);
      setMessages((prev) => [...prev, { role: 'assistant', content: narrative }]);
    } catch (err: any) {
      setRunError(err?.message || 'Failed to plan.');
    } finally {
      setPlanLoading(false);
    }
  };

  const parseSse = (chunk: string): AssistantRunEvent[] => {
    return chunk
      .split('\n\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^data:\s*/i, ''))
      .map((json) => {
        try {
          return JSON.parse(json) as AssistantRunEvent;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as AssistantRunEvent[];
  };

  const runWorkflow = async (startFromId?: string) => {
    if (!planReady || !userId) return;
    const startIndex = startFromId ? plan.steps.findIndex((s) => s.id === startFromId) : 0;
    const boundedStart = startIndex >= 0 ? startIndex : 0;
    setRunState('running');
    setRunError(null);
    setStepStates((prev) =>
      plan.steps.reduce<Record<string, StepState>>((acc, step, idx) => {
        const prevState = prev[step.id] || { status: 'idle' };
        acc[step.id] = idx >= boundedStart ? { ...prevState, status: 'idle', error: null } : prevState;
        return acc;
      }, {}),
    );

    const prepareInputs = (step: AssistantPlanStep, cfg: StepConfig) => {
      const inputs: Record<string, any> = { ...cfg.inputs };
      const fields = step.fields || [];
      fields.forEach((field) => {
        const val = inputs[field.key];
        if (typeof val === 'string') {
          if (['input_images', 'image_input'].includes(field.key)) {
            inputs[field.key] = val
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean);
          }
        }
      });
      return inputs;
    };

    const payloadSteps = plan.steps.slice(boundedStart).map((step) => {
      const cfg = stepConfigs[step.id] || { model: step.model, inputs: step.inputs };
      return { ...step, model: cfg.model, inputs: prepareInputs(step, cfg) };
    });
    const previousOutputs = boundedStart > 0
      ? plan.steps.slice(0, boundedStart).reduce<Record<string, { url?: string | null; text?: string | null }>>((acc, step) => {
        const state = stepStates[step.id];
        if (state?.outputUrl || state?.outputText) {
          acc[step.id] = { url: state.outputUrl || null, text: state.outputText || null };
        }
        return acc;
      }, {})
      : undefined;

    try {
      const res = await fetch('/api/assistant/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: payloadSteps, user_id: userId, plan_summary: plan.summary, previous_outputs: previousOutputs }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      streamRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const segments = buffer.split('\n\n');
        buffer = segments.pop() || '';
        for (const segment of segments) {
          const events = parseSse(segment);
          for (const event of events) {
            if (event.type === 'step_start') {
              setStepStates((prev) => ({ ...prev, [event.stepId]: { ...(prev[event.stepId] || { status: 'idle' }), status: 'running' } }));
            } else if (event.type === 'step_complete') {
              setStepStates((prev) => ({
                ...prev,
                [event.stepId]: {
                  status: 'complete',
                  outputUrl: event.outputUrl ?? prev[event.stepId]?.outputUrl,
                  outputText: event.outputText ?? prev[event.stepId]?.outputText,
                },
              }));
              const label = stepMap[event.stepId]?.title || event.stepId;
              const content = event.outputUrl ? `${label} complete: ${event.outputUrl}` : `${label} complete.`;
              setMessages((prev) => [...prev, { role: 'assistant', content }]);
            } else if (event.type === 'step_error') {
              setStepStates((prev) => ({
                ...prev,
                [event.stepId]: { status: 'error', error: event.error },
              }));
              setRunError(event.error);
            } else if (event.type === 'done') {
              setRunState(event.status === 'success' ? 'done' : 'idle');
              if (event.status === 'success') {
                const outputs = event.outputs && typeof event.outputs === 'object'
                  ? Object.values(event.outputs as Record<string, any>)
                  : [];
                const urls = outputs
                  .map((o: any) => (o?.url as string | undefined) || null)
                  .filter((u): u is string => Boolean(u));
                const recap = urls.length ? `Workflow finished. Outputs: ${urls.join(', ')}` : 'Workflow finished.';
                setMessages((prev) => [...prev, { role: 'assistant', content: recap }]);
              }
            }
          }
        }
      }
    } catch (err: any) {
      setRunError(err?.message || 'Run failed');
      setRunState('idle');
    } finally {
      streamRef.current = null;
    }
  };

  const stepOutputList = useMemo(() => Object.entries(stepStates)
    .filter(([, state]) => state.outputUrl || state.outputText)
    .map(([id, state]) => ({ id, url: state.outputUrl, text: state.outputText })), [stepStates]);

  const templateMessages: Array<{ title: string; prompt: string }> = [
    { title: 'Video from still', prompt: 'Use my uploaded image, keep the brand text and animate it for a 6s 16:9 spot.' },
    { title: 'Product showcase', prompt: 'Create a premium hero image of the product on a marble pedestal, then animate a sweeping dolly shot.' },
    { title: 'Voiceover + lipsync', prompt: 'Transcribe the audio, generate a concise VO, and lipsync it onto the clip.' },
    { title: 'Ad remix', prompt: 'Remove the background from the video, enhance the subject, and generate a new soundtrack.' },
  ];

  return (
    <div className="assistant-shell">
      <div className="assistant-header">
        <div>
          <p className="eyebrow">Assistant Workflow</p>
          <h2>Plan → Configure → Run</h2>
          <p className="muted">Chat on the left, configure + track on the right.</p>
        </div>
        <div className="assistant-actions">
          <button className="ghost" type="button" onClick={() => generatePlan()} disabled={planLoading || !userId}>
            {planLoading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
            Generate plan
          </button>
          <button className="primary" type="button" onClick={() => runWorkflow()} disabled={!planReady || runState === 'running' || !userId}>
            {runState === 'running' ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
            Run workflow
          </button>
        </div>
      </div>

      <div className="assistant-layout">
        <section className="assistant-main">
          <div className="chat-feed">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="chat-message-meta">
                  <span>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                </div>
                <p>{msg.content}</p>
              </div>
            ))}
            {plan.steps.length > 0 && (
              <div className="plan-widget">
                <div className="plan-widget-header">
                  <span>Workflow</span>
                  <span className="chip subtle">{plan.steps.length} steps</span>
                </div>
                <div className="plan-widget-steps">
                  {plan.steps.map((step) => {
                    const state = stepStates[step.id] || { status: 'idle' };
                    const cfg = stepConfigs[step.id] || { model: step.model, inputs: step.inputs };
                    return (
                      <div key={step.id} className="plan-widget-item">
                        <div>
                          <div className="plan-widget-title">{step.title}</div>
                          <div className="plan-widget-sub">{cfg.model}</div>
                        </div>
                        <div className="plan-widget-actions">
                          <div className={`status-pill ${state.status}`}>
                            {state.status === 'complete' && <CheckCircle2 size={14} />}
                            {state.status === 'error' && <XCircle size={14} />}
                            {state.status === 'running' && <Loader2 size={14} className="spin" />}
                            <span className="status-label">{state.status}</span>
                          </div>
                          <button className="ghost" type="button" onClick={() => openConfigurator(step)}>
                            Edit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="attachment-row">
              {attachments.map((file, idx) => (
                <span key={idx} className="chip subtle">
                  <Paperclip size={14} /> {file.label || file.url}
                </span>
              ))}
            </div>
            <div className="template-row">
              {templateMessages.map((tpl) => (
                <button
                  key={tpl.title}
                  type="button"
                  className="chip"
                  onClick={() => {
                    const nextMessages: AssistantPlanMessage[] = [...messages, { role: 'user', content: tpl.prompt }];
                    setMessages(nextMessages);
                    generatePlan(nextMessages);
                  }}
                >
                  <Wand2 size={14} /> {tpl.title}
                </button>
              ))}
            </div>
            {runError && <div className="error-banner">{runError}</div>}
          </div>
          <div className="chat-composer">
            <textarea
              placeholder="Send a message..."
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="chat-composer-actions">
              <label className="ghost">
                <Upload size={16} />
                {uploading ? 'Uploading...' : 'Upload'}
                <input type="file" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
              </label>
              <button className="ghost" type="button" onClick={() => { setDraft(''); setMessages([]); }}>
                <RefreshCw size={14} /> Reset
              </button>
              <button className="primary" type="button" onClick={() => generatePlan()} disabled={planLoading || !userId}>
                {planLoading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                Plan
              </button>
            </div>
          </div>
        </section>

        <aside className="assistant-sidebar">
          <div className="sidebar-card">
            <div className="assistant-panel-header">
              <div className="label">Plan</div>
              <div className="tag">{plan.steps.length} steps</div>
            </div>
            <div className="plan-summary">
              <p>{plan.summary}</p>
              {!planReady && plan.steps.length > 0 && (
                <p className="muted">Complete required parameters for each step to enable Run.</p>
              )}
            </div>
            <div className="plan-steps">
              {plan.steps.map((step, idx) => {
                const state = stepStates[step.id] || { status: 'idle' };
                const cfg = stepConfigs[step.id] || { model: step.model, inputs: step.inputs };
                return (
                  <div key={step.id} className="plan-step">
                    <div className="plan-step-main">
                      <div className="plan-step-order">{idx + 1}</div>
                      <div>
                        <div className="plan-step-title">{step.title}</div>
                        <div className="plan-step-sub">
                          {step.tool} · {cfg.model}
                        </div>
                        <div className="chip-list">
                          <span className="chip subtle" onClick={() => openConfigurator(step)}>
                            <Settings2 size={12} /> Configure parameters
                          </span>
                          <span className="chip subtle">{step.outputType || TOOL_SPECS[step.tool]?.outputType || 'output'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="plan-step-actions">
                      <div className={`status-pill ${state.status}`}>
                        {state.status === 'complete' && <CheckCircle2 size={14} />}
                        {state.status === 'error' && <XCircle size={14} />}
                        {state.status === 'running' && <Loader2 size={14} className="spin" />}
                        <span className="status-label">{state.status}</span>
                      </div>
                      {state.error && <p className="muted">{state.error}</p>}
                      {state.status === 'error' && (
                        <button className="ghost" type="button" onClick={() => runWorkflow(step.id)}>
                          Retry step
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sidebar-card">
            <div className="assistant-panel-header">
              <div className="label">Outputs</div>
              <div className="tag">Live</div>
            </div>
            <div className="outputs-grid">
              {stepOutputList.length === 0 && <p className="muted">No outputs yet.</p>}
              {stepOutputList.map((out) => (
                <div key={out.id} className="output-card">
                  <div className="output-meta">
                    <span className="chip subtle">{out.id}</span>
                    <span className="chip subtle">{out.url ? 'Media' : 'Text'}</span>
                  </div>
                  {out.url ? (
                    <a href={out.url} target="_blank" rel="noreferrer" className="output-link">
                      <MessageSquare size={14} /> {out.url}
                    </a>
                  ) : (
                    <p className="muted">{out.text}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {activeStep && (
        <div className="modal-backdrop" onClick={() => setActiveStep(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Configure Step</p>
                <h3>{activeStep.title}</h3>
              </div>
              <button className="ghost" type="button" onClick={() => setActiveStep(null)}>
                Close
              </button>
            </div>
            <div className="form-control">
              <label>Model</label>
              <select
                value={(stepConfigs[activeStep.id]?.model || activeStep.model) as string}
                onChange={(e) => {
                  const nextModel = e.target.value;
                  const cfg = stepConfigs[activeStep.id] || { model: activeStep.model, inputs: activeStep.inputs };
                  const defaults = defaultsForModel(nextModel);
                  const preservedPrompt = cfg.inputs?.prompt || activeStep.inputs?.prompt || '';
                  updateStepConfig(activeStep.id, { model: nextModel, inputs: { ...defaults, prompt: preservedPrompt } });
                }}
              >
                {(activeStep.modelOptions || TOOL_SPECS[activeStep.tool]?.models.map((m) => m.id) || []).map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
            {(fieldsForModel(stepConfigs[activeStep.id]?.model || activeStep.model, activeStep.tool) || []).map((field) => {
              const cfg = stepConfigs[activeStep.id] || { model: activeStep.model, inputs: activeStep.inputs };
              const value = cfg.inputs?.[field.key] ?? activeStep.inputs?.[field.key] ?? '';
              return (
                <div key={field.key} className="form-control">
                  <label>
                    {field.label} {field.required && <span className="required">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={value}
                      onChange={(e) => updateStepConfig(activeStep.id, { ...cfg, inputs: { ...cfg.inputs, [field.key]: e.target.value } })}
                    />
                  ) : field.type === 'select' && field.options ? (
                    <select
                      value={value}
                      onChange={(e) => updateStepConfig(activeStep.id, { ...cfg, inputs: { ...cfg.inputs, [field.key]: e.target.value } })}
                    >
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={value}
                      onChange={(e) => updateStepConfig(activeStep.id, { ...cfg, inputs: { ...cfg.inputs, [field.key]: e.target.value } })}
                    />
                  )}
                  {field.helper && <p className="muted">{field.helper}</p>}
                </div>
              );
            })}
            <div className="modal-actions">
              <button className="ghost" type="button" onClick={() => setActiveStep(null)}>Close</button>
              <button className="primary" type="button" onClick={() => setActiveStep(null)}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
