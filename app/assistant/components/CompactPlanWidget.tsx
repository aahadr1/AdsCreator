'use client';

import { useState } from 'react';
import type { AssistantPlan, AssistantPlanStep } from '../../../types/assistant';
import { fieldsForModel, defaultsForModel, TOOL_SPECS } from '../../../lib/assistantTools';
import { Play, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';

type StepState = {
  status: 'idle' | 'running' | 'complete' | 'error';
  outputUrl?: string | null;
  outputText?: string | null;
  error?: string | null;
};

type StepConfig = { model: string; inputs: Record<string, any> };

type CompactPlanWidgetProps = {
  plan: AssistantPlan;
  stepConfigs: Record<string, StepConfig>;
  stepStates: Record<string, StepState>;
  onRun?: () => void;
  canRun?: boolean;
  isRunning?: boolean;
  onStepClick?: (stepId: string) => void;
  onStepExpand?: (stepId: string) => void;
  onConfigChange?: (stepId: string, config: StepConfig) => void;
  expandedStepId?: string | null;
};

export default function CompactPlanWidget({
  plan,
  stepConfigs,
  stepStates,
  onRun,
  canRun = false,
  isRunning = false,
  onStepClick,
  onStepExpand,
  onConfigChange,
  expandedStepId,
}: CompactPlanWidgetProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editConfigs, setEditConfigs] = useState<Record<string, StepConfig>>({});

  if (!plan.steps.length) return null;

  const getStatusColor = (status: StepState['status']) => {
    switch (status) {
      case 'complete':
        return 'var(--status-good)';
      case 'running':
        return 'var(--accent)';
      case 'error':
        return 'var(--status-critical)';
      default:
        return 'var(--text-tertiary)';
    }
  };

  const getStatusIcon = (status: StepState['status']) => {
    switch (status) {
      case 'complete':
        return '✓';
      case 'running':
        return '⟳';
      case 'error':
        return '✗';
      default:
        return '○';
    }
  };

  return (
      <div 
        className="compact-plan-widget"
        onMouseDown={(e) => {
          // Prevent scroll when clicking inside widget
          if ((e.target as HTMLElement).closest('.compact-plan-step') || 
              (e.target as HTMLElement).closest('button') ||
              (e.target as HTMLElement).closest('input') ||
              (e.target as HTMLElement).closest('textarea') ||
              (e.target as HTMLElement).closest('select')) {
            e.preventDefault();
          }
        }}
      >
      <div className="compact-plan-widget-header">
        <div className="compact-plan-widget-title">
          <span>Workflow Plan</span>
          <span className="compact-plan-widget-badge">{plan.steps.length} steps</span>
        </div>
        <div className="compact-plan-widget-actions">
          <button
            className="compact-plan-widget-toggle"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCollapsed(!collapsed);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            type="button"
          >
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      {!collapsed && (
      <div 
        className="compact-plan-widget-content"
        onClick={(e) => {
          // Prevent clicks from bubbling up
          e.stopPropagation();
        }}
      >
        <div className="compact-plan-widget-steps">
            {plan.steps.map((step, idx) => {
              const state = stepStates[step.id] || { status: 'idle' };
              const config = stepConfigs[step.id] || { model: step.model, inputs: step.inputs };
              const isExpanded = expandedStepId === step.id;
              const statusColor = getStatusColor(state.status);
              const statusIcon = getStatusIcon(state.status);

              return (
                <div
                  key={step.id}
                  className={`compact-plan-step ${isExpanded ? 'expanded' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStepClick?.(step.id);
                  }}
                  onMouseDown={(e) => {
                    // Prevent default to avoid focus/scroll issues
                    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.compact-plan-step-main')) {
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="compact-plan-step-main">
                    <div className="compact-plan-step-number">{idx + 1}</div>
                    <div className="compact-plan-step-info">
                      <div className="compact-plan-step-title-row">
                        <span className="compact-plan-step-title">{step.title}</span>
                        <span
                          className="compact-plan-step-status"
                          style={{ color: statusColor }}
                        >
                          {statusIcon}
                        </span>
                      </div>
                      <div className="compact-plan-step-meta">
                        {step.tool} · {config.model}
                      </div>
                    </div>
                    <button
                      className="compact-plan-step-expand"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onStepExpand?.(step.id);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      type="button"
                    >
                      <Settings2 size={14} />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="compact-plan-step-details">
                      {editingStepId === step.id ? (
                        <CompactStepEditor
                          step={step}
                          config={editConfigs[step.id] || config}
                          onConfigChange={(newConfig) => {
                            setEditConfigs((prev) => ({ ...prev, [step.id]: newConfig }));
                          }}
                          onSave={() => {
                            const editedConfig = editConfigs[step.id] || config;
                            onConfigChange?.(step.id, editedConfig);
                            setEditingStepId(null);
                            setEditConfigs((prev) => {
                              const next = { ...prev };
                              delete next[step.id];
                              return next;
                            });
                          }}
                          onCancel={() => {
                            setEditingStepId(null);
                            setEditConfigs((prev) => {
                              const next = { ...prev };
                              delete next[step.id];
                              return next;
                            });
                          }}
                        />
                      ) : (
                        <>
                          <div className="compact-plan-step-detail-row">
                            <strong>Model:</strong>
                            <div className="compact-plan-step-value">{config.model}</div>
                          </div>
                          {(() => {
                            const fields = fieldsForModel(config.model || step.model, step.tool);
                            return fields.map((field) => {
                              const value = config.inputs?.[field.key] ?? '';
                              if (!value && !field.required) return null;
                              return (
                                <div key={field.key} className="compact-plan-step-detail-row">
                                  <strong>{field.label}:</strong>
                                  <div className="compact-plan-step-value">
                                    {typeof value === 'object' ? JSON.stringify(value) : String(value || '—')}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                          {state.error && (
                            <div className="compact-plan-step-error">
                              Error: {state.error}
                            </div>
                          )}
                          {(state.outputUrl || state.outputText) && (
                            <div className="compact-plan-step-output">
                              Output: {state.outputUrl ? 'Media generated' : state.outputText}
                            </div>
                          )}
                          <div className="compact-plan-step-actions">
                            <button
                              className="compact-plan-step-edit-button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingStepId(step.id);
                                setEditConfigs((prev) => ({ ...prev, [step.id]: { ...config } }));
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              type="button"
                            >
                              Edit Parameters
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {onRun && (
            <div className="compact-plan-widget-footer">
              <button
                className="compact-plan-run-button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRun?.();
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                disabled={!canRun || isRunning}
                type="button"
              >
                <Play size={14} />
                {isRunning ? 'Running...' : 'Run Workflow'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type CompactStepEditorProps = {
  step: AssistantPlanStep;
  config: StepConfig;
  onConfigChange: (config: StepConfig) => void;
  onSave: () => void;
  onCancel: () => void;
};

function CompactStepEditor({ step, config, onConfigChange, onSave, onCancel }: CompactStepEditorProps) {
  const fields = fieldsForModel(config.model || step.model, step.tool);
  const availableModels = step.modelOptions || TOOL_SPECS[step.tool]?.models.map(m => m.id) || [];

  const handleModelChange = (newModel: string) => {
    const defaults = defaultsForModel(newModel);
    const preservedPrompt = config.inputs?.prompt || '';
    onConfigChange({
      model: newModel,
      inputs: { ...defaults, prompt: preservedPrompt },
    });
  };

  return (
    <div className="compact-step-editor">
      <div className="compact-step-editor-field">
        <label>Model</label>
        <select
          value={config.model}
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
        const value = config.inputs?.[field.key] ?? '';
        return (
          <div key={field.key} className="compact-step-editor-field">
            <label>
              {field.label} {field.required && <span className="required">*</span>}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                rows={3}
                value={value}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    inputs: { ...config.inputs, [field.key]: e.target.value },
                  })
                }
              />
            ) : field.type === 'select' && field.options ? (
              <select
                value={value}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    inputs: { ...config.inputs, [field.key]: e.target.value },
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
                  onConfigChange({
                    ...config,
                    inputs: { ...config.inputs, [field.key]: e.target.value },
                  })
                }
              />
            )}
            {field.helper && (
              <div className="compact-step-editor-helper">{field.helper}</div>
            )}
          </div>
        );
      })}
      <div className="compact-step-editor-actions">
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          type="button"
        >
          Cancel
        </button>
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSave();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="primary" 
          type="button"
        >
          Save
        </button>
      </div>
    </div>
  );
}

