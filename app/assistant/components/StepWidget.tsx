'use client';

import { useState, useEffect } from 'react';
import type { AssistantPlanStep } from '../../../types/assistant';
import { fieldsForModel, defaultsForModel, TOOL_SPECS } from '../../../lib/assistantTools';
import { CheckCircle2, XCircle, Loader2, Settings2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import OutputPreview from './OutputPreview';

type StepState = { 
  status: 'idle' | 'running' | 'complete' | 'error'; 
  outputUrl?: string | null; 
  outputText?: string | null; 
  error?: string | null;
};

type StepConfig = { model: string; inputs: Record<string, any> };

type StepWidgetProps = {
  step: AssistantPlanStep;
  config: StepConfig;
  state: StepState;
  stepIndex: number;
  dependencies?: Array<{ id: string; title: string }>;
  onConfigChange: (stepId: string, config: StepConfig) => void;
  onRetry?: (stepId: string) => void;
  defaultExpanded?: boolean;
};

export default function StepWidget({
  step,
  config,
  state,
  stepIndex,
  dependencies = [],
  onConfigChange,
  onRetry,
  defaultExpanded = false,
}: StepWidgetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded || state.status === 'running' || state.status === 'complete');
  
  // Auto-expand when status changes to running or complete
  useEffect(() => {
    if (state.status === 'running' || state.status === 'complete' || state.status === 'error') {
      setExpanded(true);
    }
  }, [state.status]);
  const [editConfig, setEditConfig] = useState<StepConfig>(config);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const fields = fieldsForModel(editConfig.model || step.model, step.tool);
  const availableModels = step.modelOptions || TOOL_SPECS[step.tool]?.models.map(m => m.id) || [];

  const validate = (cfg: StepConfig): string[] => {
    const errors: string[] = [];
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

  const handleSave = () => {
    const errors = validate(editConfig);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    onConfigChange(step.id, editConfig);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditConfig(config);
    setValidationErrors([]);
    setIsEditing(false);
  };

  const handleModelChange = (newModel: string) => {
    const defaults = defaultsForModel(newModel);
    const preservedPrompt = editConfig.inputs?.prompt || '';
    setEditConfig({
      model: newModel,
      inputs: { ...defaults, prompt: preservedPrompt },
    });
  };

  const statusColors = {
    idle: 'var(--gray-500)',
    running: 'var(--accent)',
    complete: 'var(--status-good)',
    error: 'var(--status-critical)',
  };

  return (
    <div className="widget-card step-widget">
      <div className="step-widget-header">
        <div className="step-widget-main">
          <div className="step-widget-number">{stepIndex + 1}</div>
          <div className="step-widget-info">
            <div className="step-widget-title">{step.title}</div>
            <div className="step-widget-meta">
              {step.tool} · {config.model || step.model}
            </div>
            {dependencies.length > 0 && (
              <div className="step-widget-deps">
                Depends on: {dependencies.map(d => d.title).join(', ')}
              </div>
            )}
          </div>
        </div>
        <div className="step-widget-actions">
          <div 
            className="step-widget-status"
            style={{ color: statusColors[state.status] }}
          >
            {state.status === 'complete' && <CheckCircle2 size={14} />}
            {state.status === 'error' && <XCircle size={14} />}
            {state.status === 'running' && <Loader2 size={14} className="spin" />}
            <span className="step-widget-status-label">{state.status}</span>
          </div>
          {!isEditing && (
            <button
              className="step-widget-edit-button"
              onClick={() => {
                setIsEditing(true);
                setExpanded(true);
              }}
            >
              <Settings2 size={14} />
              Edit
            </button>
          )}
          {state.status === 'error' && onRetry && (
            <button
              className="step-widget-retry-button"
              onClick={() => onRetry(step.id)}
            >
              <RefreshCw size={14} />
              Retry
            </button>
          )}
          <button
            className="step-widget-expand-button"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="step-widget-content">
          {state.status === 'running' && (
            <div className="step-widget-progress">
              <div className="step-widget-progress-bar" />
            </div>
          )}

          {state.error && (
            <div className="step-widget-error">
              <XCircle size={14} />
              {state.error}
            </div>
          )}

          {isEditing ? (
            <div className="step-widget-editor">
              <div className="step-widget-editor-field">
                <label>Model</label>
                <select
                  value={editConfig.model}
                  onChange={(e) => handleModelChange(e.target.value)}
                >
                  {availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
              {fields.map((field) => {
                const value = editConfig.inputs?.[field.key] ?? '';
                return (
                  <div key={field.key} className="step-widget-editor-field">
                    <label>
                      {field.label} {field.required && <span className="required">*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        rows={3}
                        value={value}
                        onChange={(e) =>
                          setEditConfig({
                            ...editConfig,
                            inputs: { ...editConfig.inputs, [field.key]: e.target.value },
                          })
                        }
                      />
                    ) : field.type === 'select' && field.options ? (
                      <select
                        value={value}
                        onChange={(e) =>
                          setEditConfig({
                            ...editConfig,
                            inputs: { ...editConfig.inputs, [field.key]: e.target.value },
                          })
                        }
                      >
                        {field.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={value}
                        onChange={(e) =>
                          setEditConfig({
                            ...editConfig,
                            inputs: { ...editConfig.inputs, [field.key]: e.target.value },
                          })
                        }
                      />
                    )}
                    {field.helper && (
                      <div className="step-widget-editor-helper">{field.helper}</div>
                    )}
                  </div>
                );
              })}
              {validationErrors.length > 0 && (
                <div className="step-widget-validation-errors">
                  {validationErrors.map((err, idx) => (
                    <div key={idx}>{err}</div>
                  ))}
                </div>
              )}
              <div className="step-widget-editor-actions">
                <button onClick={handleCancel}>Cancel</button>
                <button onClick={handleSave} className="primary">
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {config.inputs?.prompt && (
                <div className="step-widget-prompt">
                  <strong>Prompt:</strong>
                  <div className="step-widget-prompt-text">{config.inputs.prompt}</div>
                </div>
              )}
              {(state.outputUrl || state.outputText) && (
                <div className="step-widget-output">
                  <OutputPreview
                    url={state.outputUrl}
                    text={state.outputText}
                    stepId={step.id}
                    stepTitle={step.title}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

