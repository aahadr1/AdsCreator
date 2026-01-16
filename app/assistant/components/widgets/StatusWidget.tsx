'use client';

import { RefreshCw, Check, AlertCircle, Clock } from 'lucide-react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type StatusWidgetProps = {
  data: {
    status: string;
    progress?: number;
    message?: string;
  };
};

// -----------------------------------------------------------------------------
// Main Widget
// -----------------------------------------------------------------------------

export function StatusWidget({ data }: StatusWidgetProps) {
  const { status, progress, message } = data;

  const getIcon = () => {
    if (status === 'complete' || status === 'success') {
      return <Check size={20} />;
    }
    if (status === 'error' || status === 'failed') {
      return <AlertCircle size={20} />;
    }
    if (status === 'processing' || status === 'generating') {
      return <RefreshCw size={20} className="spin" />;
    }
    return <Clock size={20} />;
  };

  const getStatusClass = () => {
    if (status === 'complete' || status === 'success') return 'status-success';
    if (status === 'error' || status === 'failed') return 'status-error';
    if (status === 'processing' || status === 'generating') return 'status-processing';
    return 'status-pending';
  };

  return (
    <div className={`widget widget-status ${getStatusClass()}`}>
      <div className="status-icon">
        {getIcon()}
      </div>
      <div className="status-content">
        <span className="status-label">{status}</span>
        {message && <span className="status-message">{message}</span>}
      </div>
      {progress !== undefined && progress > 0 && progress < 100 && (
        <div className="status-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-text">{progress}%</span>
        </div>
      )}
    </div>
  );
}

export default StatusWidget;
