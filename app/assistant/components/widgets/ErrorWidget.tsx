'use client';

import { AlertTriangle, RefreshCw, ArrowLeft, HelpCircle } from 'lucide-react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ErrorWidgetProps = {
  data: {
    error: string;
    recoveryOptions: string[];
    details?: string;
  };
  onAction: (action: string, data?: any) => void;
};

// -----------------------------------------------------------------------------
// Main Widget
// -----------------------------------------------------------------------------

export function ErrorWidget({ data, onAction }: ErrorWidgetProps) {
  const { error, recoveryOptions, details } = data;

  const handleRecovery = (option: string) => {
    const actionMap: Record<string, string> = {
      'Try again': 'retry',
      'Retry': 'retry',
      'Go back': 'go_back',
      'Edit brief': 'edit_brief',
      'Change actor': 'change_actor',
      'Adjust prompt': 'adjust_prompt',
      'Contact support': 'contact_support',
    };

    onAction(actionMap[option] || 'retry', { originalError: error });
  };

  return (
    <div className="widget widget-error">
      <div className="error-icon">
        <AlertTriangle size={24} />
      </div>
      <div className="error-content">
        <h3>Something went wrong</h3>
        <p className="error-message">{error}</p>
        {details && (
          <details className="error-details">
            <summary>Technical details</summary>
            <pre>{details}</pre>
          </details>
        )}
      </div>
      <div className="error-actions">
        {recoveryOptions.map((option, i) => (
          <button
            key={i}
            className={i === 0 ? 'btn-primary' : 'btn-secondary'}
            onClick={() => handleRecovery(option)}
          >
            {option === 'Try again' || option === 'Retry' ? (
              <RefreshCw size={16} />
            ) : option === 'Go back' ? (
              <ArrowLeft size={16} />
            ) : (
              <HelpCircle size={16} />
            )}
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ErrorWidget;
