'use client';

import { useState } from 'react';
import type { AssistantPlan, AssistantPlanStep } from '../../../types/assistant';
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
  expandedStepId,
}: CompactPlanWidgetProps) {
  const [collapsed, setCollapsed] = useState(false);

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
    <div className="compact-plan-widget">
      <div className="compact-plan-widget-header">
        <div className="compact-plan-widget-title">
          <span>Workflow Plan</span>
          <span className="compact-plan-widget-badge">{plan.steps.length} steps</span>
        </div>
        <div className="compact-plan-widget-actions">
          <button
            className="compact-plan-widget-toggle"
            onClick={() => setCollapsed(!collapsed)}
            type="button"
          >
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="compact-plan-widget-content">
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
                  onClick={() => onStepClick?.(step.id)}
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
                        e.stopPropagation();
                        onStepExpand?.(step.id);
                      }}
                      type="button"
                    >
                      <Settings2 size={14} />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="compact-plan-step-details">
                      <div className="compact-plan-step-detail-row">
                        <strong>Prompt:</strong>
                        <div className="compact-plan-step-prompt">
                          {config.inputs?.prompt || 'No prompt set'}
                        </div>
                      </div>
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
                onClick={onRun}
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

