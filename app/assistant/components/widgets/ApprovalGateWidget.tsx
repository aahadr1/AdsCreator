'use client';

import { Lock, AlertTriangle, ArrowLeft, Check, RefreshCw } from 'lucide-react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ApprovalGateWidgetProps = {
  data: {
    approved: boolean;
    storyboardVersion: number;
    sceneCount?: number;
    totalDuration?: number;
    warnings?: string[];
  };
  onAction: (action: string, data?: any) => void;
};

// -----------------------------------------------------------------------------
// Main Widget
// -----------------------------------------------------------------------------

export function ApprovalGateWidget({ data, onAction }: ApprovalGateWidgetProps) {
  const { approved, storyboardVersion, sceneCount, totalDuration, warnings } = data;

  if (approved) {
    return (
      <div className="widget widget-approval-gate approved">
        <div className="approval-icon">
          <Lock size={24} />
        </div>
        <div className="approval-content">
          <h3>Storyboard v{storyboardVersion} Locked</h3>
          <p>
            Your storyboard is approved and locked. Video generation can now proceed.
          </p>
          <p className="approval-note">
            Need to make changes? You can create a new version (v{storyboardVersion + 1}).
          </p>
        </div>
        <div className="approval-actions">
          <button
            className="btn-secondary"
            onClick={() => onAction('create_new_version')}
          >
            <RefreshCw size={16} />
            Create v{storyboardVersion + 1}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="widget widget-approval-gate pending">
      <div className="approval-icon">
        <AlertTriangle size={24} />
      </div>
      <div className="approval-content">
        <h3>Ready to Approve?</h3>
        <div className="approval-summary">
          {sceneCount && <p>📝 {sceneCount} scenes</p>}
          {totalDuration && <p>⏱️ {totalDuration} seconds total</p>}
        </div>

        {warnings && warnings.length > 0 && (
          <div className="approval-warnings">
            {warnings.map((warning, i) => (
              <div key={i} className="warning-item">
                <AlertTriangle size={14} />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        <p className="approval-note">
          ⚠️ After approval, you can still regenerate individual clips,
          but structural changes will create a new version.
        </p>
      </div>

      <div className="approval-actions">
        <button
          className="btn-primary"
          onClick={() => onAction('confirm_approval')}
        >
          <Check size={16} />
          Confirm Approval
        </button>
        <button
          className="btn-secondary"
          onClick={() => onAction('go_back')}
        >
          <ArrowLeft size={16} />
          Go Back
        </button>
      </div>
    </div>
  );
}

export default ApprovalGateWidget;
