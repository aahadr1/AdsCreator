/* eslint-disable react/no-array-index-key */
'use client';

import '../globals.css';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';
import type { AssistantPlan, AssistantPlanMessage, AssistantMedia, AssistantPlanStep, AssistantRunEvent } from '../../types/assistant';
import { TOOL_SPECS, fieldsForModel, defaultsForModel } from '../../lib/assistantTools';
import MessageBubble from './components/MessageBubble';
import ChatInput from './components/ChatInput';
import CompactPlanWidget from './components/CompactPlanWidget';
import StepWidget from './components/StepWidget';
import ProgressWidget from './components/ProgressWidget';
import OutputPreview from './components/OutputPreview';
import ConversationSidebar from './components/ConversationSidebar';
import AssistantEditor from './components/AssistantEditor';
import { Menu, ChevronLeft, Edit, History } from 'lucide-react';
import type { EditorAsset } from '../../types/editor';

type StepConfig = { model: string; inputs: Record<string, any> };
type StepState = { 
  status: 'idle' | 'running' | 'complete' | 'error'; 
  outputUrl?: string | null; 
  outputText?: string | null; 
  error?: string | null;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  timestamp: Date;
  attachments?: AssistantMedia[];
  widgetType?: 'plan' | 'step' | 'progress' | 'output' | 'error' | 'phased';
  widgetData?: any;
};

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

const shouldGenerateWorkflowPlan = (text: string): boolean => {
  const t = (text || '').trim();
  if (!t) return false;
  if (/^\/(plan|workflow)\b/i.test(t)) return true;
  // Only treat as "asked for a plan" when the user explicitly requests a plan/workflow/steps to execute.
  const hasPlanNoun = /\b(plan|workflow|steps|step-by-step)\b/i.test(t);
  const hasRequestVerb = /\b(create|generate|make|build|give|show|draft|write|produce)\b/i.test(t);
  const looksLikeHowTo = /\b(step-by-step|steps to|workflow to)\b/i.test(t);
  return (hasPlanNoun && hasRequestVerb) || looksLikeHowTo;
};

const stripPlanCommand = (text: string): string => {
  const t = (text || '').trim();
  return t.replace(/^\/(plan|workflow)\b\s*/i, '').trim();
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
  if (!plan.steps.length) return 'I\'ve analyzed your request.';
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  const counts = media.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
  const attachmentParts = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`);
  const attachmentLine = attachmentParts.length ? `I see ${attachmentParts.join(' and ')} attached.` : '';
  const stepLookup = new Map(plan.steps.map((s) => [s.id, s]));
  const total = plan.steps.length;
  const sentences = plan.steps.slice(0, 3).map((step, idx) => {
    const intro = stepIntro(idx, total);
    const usesUpload = media.some((m) => inputsContainUrl(step.inputs, m.url || ''));
    const desc = ACTION_DESCRIPTIONS[step.tool] || { base: step.title ? step.title.toLowerCase() : `run ${step.tool}` };
    const action = usesUpload && desc.withUpload ? desc.withUpload : desc.base;
    return `${intro} I'll ${action}.`;
  });
  if (total > 3) {
    sentences.push(`...and ${total - 3} more step${total - 3 > 1 ? 's' : ''}.`);
  }
  return [attachmentLine, 'Here\'s the workflow I\'ll run:', ...sentences].filter(Boolean).join(' ');
};

export default function AssistantPage() {
  const [userId, setUserId] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! Ask me anything. If you want a runnable workflow, ask for a **workflow plan** (or start your message with `/plan ...`).",
      timestamp: new Date(),
    },
  ]);
  const [draft, setDraft] = useState<string>('');
  const [attachments, setAttachments] = useState<AssistantMedia[]>([]);
  const [plan, setPlan] = useState<AssistantPlan>(EMPTY_PLAN);
  const [planLoading, setPlanLoading] = useState(false);
  const [stepConfigs, setStepConfigs] = useState<Record<string, StepConfig>>({});
  const [stepStates, setStepStates] = useState<Record<string, StepState>>({});
  const [runState, setRunState] = useState<'idle' | 'running' | 'done'>('idle');
  const [runError, setRunError] = useState<string | null>(null);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start closed by default
  const [editorOpen, setEditorOpen] = useState(false);
  const streamRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, stepStates]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  const validateStep = (step: AssistantPlanStep, cfg: StepConfig): string[] => {
    const errors: string[] = [];
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
    if (step.tool === 'video' && cfg.model.includes('kling-v2.1') && !cfg.inputs?.start_image) {
      errors.push('Kling v2.1 requires start_image');
    }
    if (step.tool === 'image' && cfg.model === 'openai/gpt-image-1.5') {
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
    // Update the step widget in chat messages
    setChatMessages((prev) =>
      prev.map((msg) => {
        if (msg.widgetType === 'step' && msg.widgetData?.stepId === stepId) {
          return {
            ...msg,
            widgetData: { ...msg.widgetData, config: next },
          };
        }
        return msg;
      })
    );
  };

  // Handle clarification submissions
  const handleClarificationSubmit = async (answers: Record<string, string>) => {
    if (!userId) return;

    // Format answers as a message
    const answerText = Object.entries(answers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    addUserMessage(`Clarification answers:\n${answerText}`);

    setPlanLoading(true);
    setRunError(null);

    // Get all messages including the new answers
    const userMessages: AssistantPlanMessage[] = chatMessages
      .filter((m) => m.role === 'user')
      .map((m) => ({ role: 'user' as const, content: m.content || '' }));
    userMessages.push({ role: 'user', content: answerText });

    try {
      const res = await fetch('/api/assistant/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          conversation_id: conversationId,
          messages: userMessages,
          media: attachments,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const json = await res.json();

      if (json.responseType === 'phased') {
        addAssistantMessage(JSON.stringify(json), undefined, 'phased');
        await saveConversation();
        return;
      }

      const nextPlan: AssistantPlan = json.plan || json;
      if (!nextPlan?.summary || !Array.isArray(nextPlan.steps)) throw new Error('Invalid plan response');

      setPlan(nextPlan);
      const nextConfigs: Record<string, StepConfig> = {};
      const nextStates: Record<string, StepState> = {};
      for (const step of nextPlan.steps) {
        nextConfigs[step.id] = { model: step.model, inputs: { ...step.inputs } };
        nextStates[step.id] = { status: 'idle' };
      }
      setStepConfigs(nextConfigs);
      setStepStates(nextStates);

      const narrative = describePlanIntent(nextPlan, attachments, userMessages);
      addAssistantMessage(narrative);
      await saveConversation();
    } catch (error: any) {
      console.error('[Plan Error]:', error);
      addAssistantMessage(error.message || 'Failed to generate plan', 'error');
      setRunError(error.message || 'Unknown error');
    } finally {
      setPlanLoading(false);
    }
  };

  // Handle strategy proceed
  const handleStrategyProceed = async () => {
    if (!userId) return;

    addUserMessage('Create execution plan from this strategy');

    setPlanLoading(true);
    setRunError(null);

    const userMessages: AssistantPlanMessage[] = chatMessages
      .filter((m) => m.role === 'user')
      .map((m) => ({ role: 'user' as const, content: m.content || '' }));
    userMessages.push({ role: 'user', content: 'Create execution plan from this strategy' });

    try {
      const res = await fetch('/api/assistant/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          conversation_id: conversationId,
          messages: userMessages,
          media: attachments,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const json = await res.json();

      if (json.responseType === 'phased') {
        addAssistantMessage(JSON.stringify(json), undefined, 'phased');
        await saveConversation();
        return;
      }

      const nextPlan: AssistantPlan = json.plan || json;
      if (!nextPlan?.summary || !Array.isArray(nextPlan.steps)) throw new Error('Invalid plan response');

      setPlan(nextPlan);
      const nextConfigs: Record<string, StepConfig> = {};
      const nextStates: Record<string, StepState> = {};
      for (const step of nextPlan.steps) {
        nextConfigs[step.id] = { model: step.model, inputs: { ...step.inputs } };
        nextStates[step.id] = { status: 'idle' };
      }
      setStepConfigs(nextConfigs);
      setStepStates(nextStates);

      const narrative = describePlanIntent(nextPlan, attachments, userMessages);
      addAssistantMessage(narrative);
      await saveConversation();
    } catch (error: any) {
      console.error('[Plan Error]:', error);
      addAssistantMessage(error.message || 'Failed to generate plan', 'error');
      setRunError(error.message || 'Unknown error');
    } finally {
      setPlanLoading(false);
    }
  };

  // Handle dynamic actions from block renderer
  const handleDynamicAction = async (action: string, parameters?: Record<string, any>) => {
    if (!userId) return;

    // Handle different action types
    switch (action) {
      case 'submit_answers':
        // Similar to clarification submit
        if (parameters?.answers) {
          await handleClarificationSubmit(parameters.answers);
        }
        break;

      case 'create_workflow':
      case 'proceed':
      case 'continue':
        // Similar to strategy proceed
        await handleStrategyProceed();
        break;

      case 'research_competitor':
        // Trigger competitor research
        if (parameters?.brand) {
          const msg = `Research competitor: ${parameters.brand}`;
          addUserMessage(msg);
          setPlanLoading(true);
          setRunError(null);
          try {
            const history: AssistantPlanMessage[] = [
              ...chatMessages
                .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
                .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content || '' }))
                .filter((m) => m.content.trim().length > 0),
              { role: 'user', content: msg },
            ];
            await generatePlan(msg, [], history);
          } finally {
            setPlanLoading(false);
          }
        }
        break;

      case 'regenerate':
      case 'retry':
        // Regenerate last response
        setPlanLoading(true);
        setRunError(null);
        try {
          const history: AssistantPlanMessage[] = chatMessages
            .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content || '' }))
            .filter((m) => m.content.trim().length > 0);
          const lastUser = [...history].reverse().find((m) => m.role === 'user');
          const seed = lastUser?.content || 'Create a workflow plan';
          await generatePlan(seed, [], history);
        } finally {
          setPlanLoading(false);
        }
        break;

      default:
        // Generic action: send to assistant as user message
        const actionMessage = parameters 
          ? `${action}: ${JSON.stringify(parameters)}`
          : action;
        addUserMessage(actionMessage);
        setPlanLoading(true);
        setRunError(null);
        try {
          const history: AssistantPlanMessage[] = [
            ...chatMessages
              .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
              .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content || '' }))
              .filter((m) => m.content.trim().length > 0),
            { role: 'user', content: actionMessage },
          ];
          await generatePlan(actionMessage, [], history);
        } finally {
          setPlanLoading(false);
        }
        break;
    }
  };

  const sendChat = async (text: string, media: AssistantMedia[], history: AssistantPlanMessage[]) => {
    const res = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        messages: history,
        media,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    const message = typeof json?.message === 'string' ? json.message : '';
    if (!message.trim()) throw new Error('Empty response from assistant');
    addAssistantMessage(message);
    await saveConversation();
  };

  const generatePlan = async (text: string, media: AssistantMedia[], history: AssistantPlanMessage[]) => {
    if (!userId) {
      addAssistantMessage('Please sign in at /auth to generate a plan.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/assistant/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          media,
          user_id: userId,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      
      // Check if this is a phased response (thinking/questions) or a plan
      if (json.responseType === 'phased') {
        console.log('[Frontend] 📥 Received phased response (thinking phase)');
        // Store the phased response as a special assistant message
        addAssistantMessage(JSON.stringify(json), undefined, 'phased');
        await saveConversation();
        return; // Don't set plan yet, wait for user input or completion
      }
      
      const nextPlan: AssistantPlan = json.plan || json;
      
      // VERIFICATION: Log what we received from API
      console.log('[Frontend] 📥 Received plan from API:');
      console.log('[Frontend]   Summary:', nextPlan.summary);
      console.log('[Frontend]   Steps count:', nextPlan.steps?.length || 0);
      console.log('[Frontend]   Full plan JSON:', JSON.stringify(nextPlan, null, 2));
      
      if (!nextPlan.steps || !Array.isArray(nextPlan.steps)) {
        console.error('[Frontend] ❌ CRITICAL: Received plan with invalid steps!');
        console.error('[Frontend] Plan object:', nextPlan);
        throw new Error('Received plan with invalid steps from API');
      }
      
      if (nextPlan.steps.length === 0) {
        console.error('[Frontend] ❌ CRITICAL: Received plan with no steps!');
        throw new Error('Received plan with no steps from API');
      }
      
      nextPlan.steps.forEach((step, idx) => {
        console.log(`[Frontend]   ${idx + 1}. ${step.id} (${step.tool}) - ${step.model} - "${step.title}"`);
        console.log(`[Frontend]      Inputs:`, JSON.stringify(step.inputs || {}, null, 2));
        console.log(`[Frontend]      Dependencies:`, step.dependencies || []);
      });
      
      setPlan(nextPlan);

      const nextConfigs: Record<string, StepConfig> = {};
      const nextStates: Record<string, StepState> = {};
      for (const step of nextPlan.steps) {
        nextConfigs[step.id] = { model: step.model, inputs: { ...step.inputs } };
        nextStates[step.id] = { status: 'idle' };
      }
      setStepConfigs(nextConfigs);
      setStepStates(nextStates);

      const narrative = describePlanIntent(nextPlan, media, history);
      addAssistantMessage(narrative);

      // Save conversation to database
      await saveConversation();
    } catch (err: any) {
      addAssistantMessage(err?.message || 'Failed to generate plan. Please try again.', 'error');
    }
  };

  const handleSend = async () => {
    if (!userId) {
      addAssistantMessage('Please sign in at /auth to continue.', 'error');
      return;
    }

    const raw = draft.trim();
    const currentAttachments = [...attachments];
    if (!raw && currentAttachments.length === 0) return;

    const wantsPlan = shouldGenerateWorkflowPlan(raw);
    const cleaned = wantsPlan ? stripPlanCommand(raw) : raw;
    const userText = cleaned || (currentAttachments.length ? 'Analyze the attached media.' : '');

    // Add user message to UI
    addUserMessage(userText, currentAttachments.length > 0 ? currentAttachments : undefined);
    setDraft('');
    setAttachments([]);

    setPlanLoading(true);
    setRunError(null);

    // Build full message history (include assistant + user), plus the new user message.
    const history: AssistantPlanMessage[] = [
      ...chatMessages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content || '' }))
        .filter((m) => m.content.trim().length > 0),
      { role: 'user', content: userText },
    ];

    try {
      if (wantsPlan) {
        await generatePlan(userText, currentAttachments, history);
      } else {
        await sendChat(userText, currentAttachments, history);
      }
    } catch (error: any) {
      console.error('[Assistant Error]:', error);
      addAssistantMessage(error?.message || 'Request failed. Please try again.', 'error');
      setRunError(error?.message || 'Unknown error');
    } finally {
      setPlanLoading(false);
    }
  };

  const addUserMessage = (content: string, atts?: AssistantMedia[]) => {
    const msg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
      attachments: atts,
    };
    setChatMessages((prev) => [...prev, msg]);
  };

  const addAssistantMessage = (
    content: string,
    widgetType?: 'plan' | 'step' | 'progress' | 'output' | 'error' | 'phased',
    widgetData?: any
  ) => {
    const msg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: new Date(),
      widgetType,
      widgetData,
    };
    setChatMessages((prev) => [...prev, msg]);
  };

  // Collect workflow outputs as EditorAssets
  const getWorkflowAssets = useCallback((): EditorAsset[] => {
    const assets: EditorAsset[] = [];
    
    plan.steps.forEach((step) => {
      const state = stepStates[step.id];
      if (!state || state.status !== 'complete') return;

      if (state.outputUrl) {
        let type: EditorAsset['type'] = 'text';
        const url = state.outputUrl;
        
        if (step.outputType === 'image' || /\.(png|jpg|jpeg|gif|webp)/i.test(url)) {
          type = 'image';
        } else if (step.outputType === 'video' || /\.(mp4|webm|mov|avi)/i.test(url)) {
          type = 'video';
        } else if (step.outputType === 'audio' || /\.(mp3|wav|ogg|m4a)/i.test(url)) {
          type = 'audio';
        } else if (step.outputType === 'text' || state.outputText) {
          type = 'text';
        }

        assets.push({
          id: `workflow-${step.id}`,
          type,
          url: state.outputUrl,
          name: step.title || `Step ${step.id}`,
          source: 'workflow',
          sourceId: step.id,
        });
      } else if (state.outputText) {
        assets.push({
          id: `workflow-${step.id}-text`,
          type: 'text',
          url: `data:text/plain;base64,${btoa(state.outputText)}`,
          name: `${step.title || `Step ${step.id}`} (text)`,
          source: 'workflow',
          sourceId: step.id,
        });
      }
    });

    return assets;
  }, [plan, stepStates]);

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
    
    // Update global task state for favicon - workflow starting
    const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
    updateTaskStateFromJobStatus('running');

    // Add progress widget message
    const progressMsgId = `progress-${Date.now()}`;
    addAssistantMessage('Starting workflow execution...', 'progress', {
      current: 0,
      total: plan.steps.length,
    });

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

    // Get user messages for context
    const userMessages: AssistantPlanMessage[] = chatMessages
      .filter((m) => m.role === 'user')
      .map((m) => ({ role: 'user' as const, content: m.content || '' }));

    try {
      const res = await fetch('/api/assistant/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: payloadSteps,
          user_id: userId,
          plan_summary: plan.summary,
          user_messages: userMessages,
          previous_outputs: previousOutputs,
          conversation_id: conversationId,
        }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      streamRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';
      let completedSteps = 0;

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
              setStepStates((prev) => ({
                ...prev,
                [event.stepId]: { ...(prev[event.stepId] || { status: 'idle' }), status: 'running' },
              }));
              // Update global task state for favicon - step starting (keep in_progress)
              const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
              updateTaskStateFromJobStatus('running');
              // Update or create step widget message (avoid duplicates)
              setChatMessages((prev) => {
                const existingStepMsg = prev.find(
                  (msg) => msg.widgetType === 'step' && msg.widgetData?.step?.id === event.stepId
                );
                if (existingStepMsg) {
                  // Update existing message
                  return prev.map((msg) => {
                    if (msg.id === existingStepMsg.id) {
                      return {
                        ...msg,
                        widgetData: {
                          ...msg.widgetData,
                          state: { status: 'running' as const },
                        },
                      };
                    }
                    return msg;
                  });
                } else {
                  // Create new message only if it doesn't exist
                  const step = stepMap[event.stepId];
                  if (step) {
                    const cfg = stepConfigs[step.id] || { model: step.model, inputs: step.inputs };
                    const deps = (step.dependencies || [])
                      .map((id) => stepMap[id])
                      .filter(Boolean)
                      .map((s) => ({ id: s.id, title: s.title }));
                    return [
                      ...prev,
                      {
                        id: `step-${event.stepId}`,
                        role: 'assistant' as const,
                        content: `Starting: ${step.title}`,
                        timestamp: new Date(),
                        widgetType: 'step' as const,
                        widgetData: {
                          step,
                          config: cfg,
                          state: { status: 'running' as const },
                          stepIndex: plan.steps.findIndex((s) => s.id === step.id),
                          dependencies: deps,
                        },
                      },
                    ];
                  }
                }
                return prev;
              });
              // Update progress
              setChatMessages((prev) =>
                prev.map((msg) => {
                  if (msg.widgetType === 'progress') {
                    return {
                      ...msg,
                      widgetData: {
                        ...msg.widgetData,
                        current: completedSteps,
                        currentStepTitle: stepMap[event.stepId]?.title,
                      },
                    };
                  }
                  return msg;
                })
              );
            } else if (event.type === 'step_complete') {
              completedSteps++;
              setStepStates((prev) => ({
                ...prev,
                [event.stepId]: {
                  status: 'complete',
                  outputUrl: event.outputUrl ?? prev[event.stepId]?.outputUrl,
                  outputText: event.outputText ?? prev[event.stepId]?.outputText,
                },
              }));
              // Update global task state for favicon - step completed (still in_progress if more steps)
              // Will be updated to 'done' when workflow completes
              const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
              // Keep as in_progress until all steps are done
              updateTaskStateFromJobStatus('running');
              // Update existing step message instead of creating new one
              setChatMessages((prev) => {
                const existingStepMsg = prev.find(
                  (msg) => msg.widgetType === 'step' && msg.widgetData?.step?.id === event.stepId
                );
                if (existingStepMsg) {
                  return prev.map((msg) => {
                    if (msg.id === existingStepMsg.id) {
                      const step = stepMap[event.stepId];
                      const cfg = stepConfigs[step.id] || { model: step.model, inputs: step.inputs };
                      return {
                        ...msg,
                        content: `✓ ${step?.title || 'Step'} complete${event.outputUrl ? '' : '.'}`,
                        widgetData: {
                          ...msg.widgetData,
                          state: {
                            status: 'complete' as const,
                            outputUrl: event.outputUrl,
                            outputText: event.outputText,
                          },
                        },
                      };
                    }
                    return msg;
                  });
                }
                return prev;
              });
              // Update progress
              setChatMessages((prev) =>
                prev.map((msg) => {
                  if (msg.widgetType === 'progress') {
                    return {
                      ...msg,
                      widgetData: {
                        ...msg.widgetData,
                        current: completedSteps,
                      },
                    };
                  }
                  return msg;
                })
              );
            } else if (event.type === 'step_error') {
              setStepStates((prev) => ({
                ...prev,
                [event.stepId]: { status: 'error', error: event.error },
              }));
              // Update global task state for favicon - step failed
              const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
              updateTaskStateFromJobStatus('error');
              // Update existing step message instead of creating new one
              setChatMessages((prev) => {
                const existingStepMsg = prev.find(
                  (msg) => msg.widgetType === 'step' && msg.widgetData?.step?.id === event.stepId
                );
                if (existingStepMsg) {
                  return prev.map((msg) => {
                    if (msg.id === existingStepMsg.id) {
                      const step = stepMap[event.stepId];
                      return {
                        ...msg,
                        content: `✗ ${step?.title || 'Step'} failed: ${event.error}`,
                        widgetData: {
                          ...msg.widgetData,
                          state: { status: 'error' as const, error: event.error },
                        },
                      };
                    }
                    return msg;
                  });
                }
                return prev;
              });
            } else if (event.type === 'done') {
              setRunState(event.status === 'success' ? 'done' : 'idle');
              // Update global task state for favicon - workflow complete
              const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
              if (event.status === 'success') {
                updateTaskStateFromJobStatus('success');
                const outputs = event.outputs && typeof event.outputs === 'object'
                  ? Object.values(event.outputs as Record<string, any>)
                  : [];
                const urls = outputs
                  .map((o: any) => (o?.url as string | undefined) || null)
                  .filter((u): u is string => Boolean(u));
                addAssistantMessage(
                  urls.length
                    ? `Workflow complete! Generated ${urls.length} output${urls.length > 1 ? 's' : ''}.`
                    : 'Workflow complete!',
                  'output',
                  { showEditorButton: true }
                );
              } else {
                updateTaskStateFromJobStatus('error');
              }
              // Update progress to complete
              setChatMessages((prev) =>
                prev.map((msg) => {
                  if (msg.widgetType === 'progress') {
                    return {
                      ...msg,
                      widgetData: {
                        ...msg.widgetData,
                        current: plan.steps.length,
                      },
                    };
                  }
                  return msg;
                })
              );
            }
          }
        }
      }
    } catch (err: any) {
      addAssistantMessage(err?.message || 'Workflow execution failed.', 'error');
      setRunState('idle');
      // Update global task state for favicon - workflow failed
      const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
      updateTaskStateFromJobStatus('error');
    } finally {
      streamRef.current = null;
    }
  };

  const handleRetryStep = (stepId: string) => {
    runWorkflow(stepId);
  };

  const handleStepClick = (stepId: string) => {
    // Toggle expanded state in compact widget
    setExpandedStepId(expandedStepId === stepId ? null : stepId);
    
    // Also find or create step widget message in chat for full details
    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return;

    const stepWidgetMsg = chatMessages.find(
      (msg) => msg.widgetType === 'step' && msg.widgetData?.step?.id === stepId
    );

    if (stepWidgetMsg) {
      // Scroll to existing step widget
      const element = document.getElementById(`step-widget-${stepId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setChatMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === stepWidgetMsg.id && msg.widgetType === 'step') {
              return {
                ...msg,
                widgetData: {
                  ...msg.widgetData,
                  forceExpanded: true,
                },
              };
            }
            return msg;
          })
        );
      }
    } else {
      // Create a new step widget message if it doesn't exist
      const cfg = stepConfigs[stepId] || { model: step.model, inputs: step.inputs };
      const state = stepStates[stepId] || { status: 'idle' };
      const deps = (step.dependencies || [])
        .map((id) => plan.steps.find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => ({ id: s!.id, title: s!.title }));
      
      addAssistantMessage(`Step: ${step.title}`, 'step', {
        step,
        config: cfg,
        state,
        stepIndex: plan.steps.findIndex((s) => s.id === stepId),
        dependencies: deps,
        forceExpanded: true,
      });
      
      setTimeout(() => {
        const element = document.getElementById(`step-widget-${stepId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  const handleStepExpand = (stepId: string) => {
    // Open full step widget in chat
    handleStepClick(stepId);
  };

  const saveConversation = async () => {
    if (!userId) return;

    try {
      const conversationData = {
        user_id: userId,
        messages: chatMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          attachments: msg.attachments,
          timestamp: msg.timestamp.toISOString(),
        })),
        plan: plan.steps.length > 0 ? {
          summary: plan.summary,
          steps: plan.steps,
        } : null,
        title: chatMessages.find((m) => m.role === 'user')?.content?.slice(0, 100) || 'New Conversation',
      };

      if (conversationId) {
        // Update existing conversation
        const res = await fetch('/api/assistant/conversations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: conversationId,
            ...conversationData,
          }),
        });
        if (!res.ok) console.error('Failed to update conversation');
      } else {
        // Create new conversation
        const res = await fetch('/api/assistant/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(conversationData),
        });
        if (res.ok) {
          const data = await res.json();
          setConversationId(data.id);
        } else {
          console.error('Failed to save conversation');
        }
      }
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  };

  // Auto-save conversation when messages or plan change
  useEffect(() => {
    if (chatMessages.length > 1 && userId) {
      const timeoutId = setTimeout(() => {
        saveConversation();
      }, 2000); // Debounce: save 2 seconds after last change
      return () => clearTimeout(timeoutId);
    }
  }, [chatMessages, plan, userId]);

  const handleNewConversation = () => {
    setConversationId(null);
    setChatMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I can help you create workflows for image generation, video creation, text-to-speech, and more. What would you like to create?',
      timestamp: new Date(),
    }]);
    setPlan(EMPTY_PLAN);
    setStepConfigs({});
    setStepStates({});
    setDraft('');
    setAttachments([]);
  };

  const handleSelectConversation = async (id: string | null) => {
    if (!id) {
      handleNewConversation();
      return;
    }

    try {
      const res = await fetch(`/api/assistant/conversations?user_id=${userId}&id=${id}`);
      if (res.ok) {
        const conv = await res.json();
        setConversationId(conv.id);
        
        // Load messages
        const messages = (conv.messages || []).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp || conv.created_at),
        }));
        setChatMessages(messages.length > 0 ? messages : [{
          id: 'welcome',
          role: 'assistant',
          content: 'Hello! I can help you create workflows for image generation, video creation, text-to-speech, and more. What would you like to create?',
          timestamp: new Date(),
        }]);
        
        // Load plan
        if (conv.plan) {
          setPlan(conv.plan);
          // Restore step configs
          const configs: Record<string, StepConfig> = {};
          conv.plan.steps.forEach((step: AssistantPlanStep) => {
            configs[step.id] = {
              model: step.model,
              inputs: step.inputs || {},
            };
          });
          setStepConfigs(configs);
        }
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  return (
    <div className="assistant-page-layout">
      {userId && (
        <div className={`conversation-sidebar-wrapper ${sidebarOpen ? 'open' : ''}`}>
          <ConversationSidebar
            userId={userId}
            currentConversationId={conversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
          />
        </div>
      )}
      <div className={`chat-container ${userId && sidebarOpen ? 'with-sidebar' : ''}`}>
        {/* Topbar with title and buttons */}
        <div className="assistant-topbar">
          <div className="assistant-topbar-left">
            <button
              className="assistant-topbar-button"
              onClick={() => setEditorOpen(true)}
              title="Open Assistant Editor"
              type="button"
            >
              <Edit size={18} />
            </button>
          </div>
          <div className="assistant-topbar-center">
            <h1 className="assistant-title">Assistant</h1>
            {userId && (
              <button
                className="assistant-topbar-button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={sidebarOpen ? 'Hide chat history' : 'Show chat history'}
                type="button"
              >
                <History size={18} />
              </button>
            )}
          </div>
          <div className="assistant-topbar-right">
            {/* Reserved for future actions */}
          </div>
        </div>
        <div className="chat-messages" ref={chatEndRef}>
          {chatMessages.map((msg) => {
          let widgetContent: React.ReactNode = null;

          if (msg.widgetType === 'step' && msg.widgetData?.step) {
            const stepData = msg.widgetData;
            // Always use latest state and config from main state
            const currentConfig = stepConfigs[stepData.step.id] || stepData.config || { model: stepData.step.model, inputs: stepData.step.inputs };
            const currentState = stepStates[stepData.step.id] || stepData.state || { status: 'idle' };
            const shouldExpand = stepData.forceExpanded || currentState.status === 'running' || currentState.status === 'complete';
            widgetContent = (
              <div id={`step-widget-${stepData.step.id}`}>
                <StepWidget
                  step={stepData.step}
                  config={currentConfig}
                  state={currentState}
                  stepIndex={stepData.stepIndex ?? plan.steps.findIndex((s) => s.id === stepData.step.id)}
                  dependencies={stepData.dependencies || []}
                  onConfigChange={updateStepConfig}
                  onRetry={handleRetryStep}
                  defaultExpanded={shouldExpand}
                />
              </div>
            );
          } else if (msg.widgetType === 'progress' && msg.widgetData) {
            widgetContent = (
              <ProgressWidget
                current={msg.widgetData.current || 0}
                total={msg.widgetData.total || plan.steps.length}
                currentStepTitle={msg.widgetData.currentStepTitle}
              />
            );
          } else if (msg.widgetType === 'output' && msg.widgetData) {
            const outputData = msg.widgetData;
            if (outputData.step) {
              // Always use latest state and config from main state
              const currentConfig = stepConfigs[outputData.step.id] || outputData.config || { model: outputData.step.model, inputs: outputData.step.inputs };
              const currentState = stepStates[outputData.step.id] || outputData.state || { status: 'complete' };
              widgetContent = (
                <StepWidget
                  step={outputData.step}
                  config={currentConfig}
                  state={currentState}
                  stepIndex={outputData.stepIndex ?? plan.steps.findIndex((s) => s.id === outputData.step.id)}
                  dependencies={outputData.dependencies || []}
                  onConfigChange={updateStepConfig}
                  onRetry={handleRetryStep}
                  defaultExpanded={false} // Collapsed by default for minimalist view
                />
              );
            } else if (outputData.url || outputData.text) {
              widgetContent = (
                <OutputPreview
                  url={outputData.url}
                  text={outputData.text}
                  compact={true} // Compact by default
                />
              );
            }
            
            // Add "Show on Editor" button if workflow is complete and has outputs
            if (outputData.showEditorButton && runState === 'done' && getWorkflowAssets().length > 0) {
              widgetContent = (
                <div>
                  {widgetContent}
                  <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}>
                    <button
                      className="assistant-editor-open-button"
                      onClick={() => setEditorOpen(true)}
                      type="button"
                    >
                      <Edit size={16} />
                      Show on Editor
                    </button>
                  </div>
                </div>
              );
            }
          } else if (msg.widgetType === 'error') {
            widgetContent = (
              <div className="widget-card error-widget">
                <div className="error-widget-content">{msg.content}</div>
                      </div>
                    );
          }

            return (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                attachments={msg.attachments}
                onClarificationSubmit={handleClarificationSubmit}
                onStrategyProceed={handleStrategyProceed}
                onDynamicAction={handleDynamicAction}
                onRunWorkflow={runWorkflow}
              >
                {widgetContent}
              </MessageBubble>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
        {plan.steps.length > 0 && (
          <div className="compact-plan-widget-sticky">
            <CompactPlanWidget
              plan={plan}
              stepConfigs={stepConfigs}
              stepStates={stepStates}
              onRun={() => runWorkflow()}
              canRun={planReady}
              isRunning={runState === 'running'}
              onStepClick={handleStepClick}
              onStepExpand={handleStepExpand}
              onConfigChange={updateStepConfig}
              expandedStepId={expandedStepId}
            />
          </div>
        )}
        <div className="chat-input-wrapper-fixed">
          <ChatInput
            value={draft}
            onChange={setDraft}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            onSend={handleSend}
            disabled={!userId}
            loading={planLoading}
            placeholder={userId ? 'Send a message...' : 'Sign in to continue...'}
          />
        </div>
        </div>
      </div>

      <AssistantEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        initialAssets={getWorkflowAssets()}
      />
    </div>
  );
}
