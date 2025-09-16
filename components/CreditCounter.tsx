'use client';

import React from 'react';
import { Zap, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useCredits } from '../lib/creditContext';
import { formatCredits } from '../types/credits';

export function CreditCounter() {
  const { credits, loading, error, formatProgress } = useCredits();

  if (loading) {
    return (
      <div className="credit-counter loading">
        <div className="credit-header">
          <Zap size={16} />
          <span>Credits</span>
        </div>
        <div className="credit-loading">
          <Clock size={14} />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !credits) {
    return (
      <div className="credit-counter error">
        <div className="credit-header">
          <Zap size={16} />
          <span>Credits</span>
        </div>
        <div className="credit-error">
          <AlertCircle size={14} />
          <span>Error</span>
        </div>
      </div>
    );
  }

  const { percentage, status } = formatProgress();

  return (
    <div className={`credit-counter ${status}`}>
      <div className="credit-header">
        <Zap size={16} />
        <span>Credits</span>
        {status === 'good' && <CheckCircle size={14} className="status-icon good" />}
        {status === 'warning' && <AlertCircle size={14} className="status-icon warning" />}
        {status === 'critical' && <AlertCircle size={14} className="status-icon critical" />}
      </div>
      
      <div className="credit-content">
        <div className="credit-stats">
          <div className="credit-remaining">
            <span className="credit-number">{formatCredits(credits.remaining_credits)}</span>
            <span className="credit-label">remaining</span>
          </div>
          <div className="credit-total">
            <span className="credit-used">{formatCredits(credits.used_credits)}</span>
            <span className="credit-separator">/</span>
            <span className="credit-limit">{formatCredits(credits.monthly_limit)}</span>
          </div>
        </div>
        
        <div className="credit-progress">
          <div className="progress-bar">
            <div 
              className={`progress-fill ${status}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="progress-text">
            {percentage.toFixed(0)}% used
          </div>
        </div>
        
        <div className="credit-tier">
          <span className={`tier-badge ${credits.subscription_tier}`}>
            {credits.subscription_tier.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
