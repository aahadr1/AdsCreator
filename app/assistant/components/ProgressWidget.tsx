'use client';

import { Loader2 } from 'lucide-react';

type ProgressWidgetProps = {
  current: number;
  total: number;
  currentStepTitle?: string;
};

export default function ProgressWidget({ current, total, currentStepTitle }: ProgressWidgetProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const isComplete = current >= total;

  return (
    <div className="widget-card progress-widget">
      <div className="progress-widget-header">
        <div className="progress-widget-title">
          <Loader2 size={16} className={isComplete ? '' : 'spin'} />
          <span>Workflow Progress</span>
        </div>
        <div className="progress-widget-stats">
          {current} / {total} steps
        </div>
      </div>
      <div className="progress-widget-bar-container">
        <div
          className="progress-widget-bar"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {currentStepTitle && !isComplete && (
        <div className="progress-widget-current">
          Currently running: <strong>{currentStepTitle}</strong>
        </div>
      )}
      {isComplete && (
        <div className="progress-widget-complete">
          ✓ All steps completed
        </div>
      )}
    </div>
  );
}

