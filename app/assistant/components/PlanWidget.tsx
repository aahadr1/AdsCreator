'use client';

import { useState } from 'react';
import type { AssistantPlan } from '../../../types/assistant';
import { ChevronDown, ChevronUp, Play, Sparkles } from 'lucide-react';

type PlanWidgetProps = {
  plan: AssistantPlan;
  onRun?: () => void;
  canRun?: boolean;
  isRunning?: boolean;
  defaultExpanded?: boolean;
};

export default function PlanWidget({ 
  plan, 
  onRun, 
  canRun = false, 
  isRunning = false,
  defaultExpanded = true 
}: PlanWidgetProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="widget-card plan-widget">
      <div 
        className="plan-widget-header"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className="plan-widget-title">
          <Sparkles size={16} />
          <span>Workflow Plan</span>
          <span className="plan-widget-badge">{plan.steps.length} steps</span>
        </div>
        <div className="plan-widget-actions">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>
      {expanded && (
        <div className="plan-widget-content">
          <div className="plan-widget-summary">
            <p>{plan.summary}</p>
          </div>
          <div className="plan-widget-steps-list">
            {plan.steps.map((step, idx) => (
              <div key={step.id} className="plan-widget-step-item">
                <div className="plan-widget-step-number">{idx + 1}</div>
                <div className="plan-widget-step-info">
                  <div className="plan-widget-step-title">{step.title}</div>
                  <div className="plan-widget-step-meta">
                    {step.tool} · {step.model}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {onRun && (
            <div className="plan-widget-footer">
              <button
                className="plan-widget-run-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRun();
                }}
                disabled={!canRun || isRunning}
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

