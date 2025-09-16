'use client';

import React, { useEffect, useState } from 'react';
import { 
  Zap, 
  Clock, 
  TrendingUp, 
  Calendar,
  Activity,
  ArrowUpRight,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  DollarSign
} from 'lucide-react';
import { useCredits } from '../lib/creditContext';
import { CreditUsage, CreditTransaction, formatCredits, MODEL_COSTS } from '../types/credits';
import { supabaseClient as supabase } from '../lib/supabaseClient';

interface CreditHistory {
  usage: CreditUsage[];
  transactions: CreditTransaction[];
  history: Array<CreditUsage | CreditTransaction>;
}

export function CreditManagement() {
  const { credits, loading: creditsLoading, refreshCredits } = useCredits();
  const [history, setHistory] = useState<CreditHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(`/api/credits/history?user_id=${encodeURIComponent(user.id)}`);
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setHistory(data);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load credit history');
      console.error('Failed to load credit history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleRefresh = async () => {
    await Promise.all([refreshCredits(), loadHistory()]);
  };

  if (creditsLoading) {
    return (
      <div className="credit-management loading">
        <div className="loading-spinner"></div>
        <p>Loading credit information...</p>
      </div>
    );
  }

  if (!credits) {
    return (
      <div className="credit-management error">
        <AlertTriangle size={48} />
        <h3>Failed to load credits</h3>
        <p>Please refresh the page and try again.</p>
        <button className="btn" onClick={handleRefresh}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
    );
  }

  const daysUntilReset = Math.ceil(
    (new Date(credits.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="credit-management">
      <div className="credit-management-header">
        <h1>
          <Zap size={28} />
          Credit Management
          <span className="subtitle">Monitor and manage your AI credits</span>
        </h1>
        <button className="btn secondary" onClick={handleRefresh}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Credit Overview */}
      <div className="credit-overview">
        <div className="credit-overview-card main">
          <div className="credit-overview-header">
            <h2>Current Period</h2>
            <span className={`tier-badge ${credits.subscription_tier}`}>
              {credits.subscription_tier.toUpperCase()}
            </span>
          </div>
          
          <div className="credit-overview-stats">
            <div className="stat-large">
              <div className="stat-value">{formatCredits(credits.remaining_credits)}</div>
              <div className="stat-label">Credits Remaining</div>
            </div>
            
            <div className="stat-small">
              <div className="stat-value">{formatCredits(credits.used_credits)}</div>
              <div className="stat-label">Used</div>
            </div>
            
            <div className="stat-small">
              <div className="stat-value">{formatCredits(credits.monthly_limit)}</div>
              <div className="stat-label">Monthly Limit</div>
            </div>
          </div>
          
          <div className="credit-progress-large">
            <div className="progress-bar">
              <div 
                className={`progress-fill ${
                  credits.used_credits / credits.monthly_limit >= 0.9 
                    ? 'critical' 
                    : credits.used_credits / credits.monthly_limit >= 0.75 
                    ? 'warning' 
                    : 'good'
                }`}
                style={{ 
                  width: `${Math.min((credits.used_credits / credits.monthly_limit) * 100, 100)}%` 
                }}
              />
            </div>
            <div className="progress-info">
              <span>{((credits.used_credits / credits.monthly_limit) * 100).toFixed(1)}% used</span>
              <span>{daysUntilReset} days until reset</span>
            </div>
          </div>
        </div>

        <div className="credit-overview-actions">
          <div className="overview-action-card">
            <Calendar size={24} />
            <div className="action-content">
              <h3>Next Reset</h3>
              <p>{new Date(credits.current_period_end).toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="overview-action-card">
            <TrendingUp size={24} />
            <div className="action-content">
              <h3>Upgrade Plan</h3>
              <p>Get more credits</p>
            </div>
            <a href="/billing" className="btn small">
              Upgrade
              <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      </div>

      {/* Credit Pricing */}
      <div className="credit-pricing">
        <h2>Credit Costs by Tool</h2>
        <div className="pricing-grid">
          {Object.entries(MODEL_COSTS).map(([modelKey, modelInfo]) => (
            <div key={modelKey} className="pricing-item">
              <div className="pricing-header">
                <h4>{modelInfo.name}</h4>
                <span className={`category-badge ${modelInfo.category}`}>
                  {modelInfo.category}
                </span>
              </div>
              <div className="pricing-content">
                <div className="credit-cost">
                  <Zap size={16} />
                  <span>{modelInfo.credits} credits</span>
                </div>
                {modelInfo.provider && (
                  <div className="provider">via {modelInfo.provider}</div>
                )}
                {modelInfo.description && (
                  <div className="description">{modelInfo.description}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Usage History */}
      <div className="credit-history">
        <h2>Recent Activity</h2>
        
        {historyLoading ? (
          <div className="history-loading">
            <RefreshCw size={20} className="spinning" />
            <span>Loading history...</span>
          </div>
        ) : historyError ? (
          <div className="history-error">
            <AlertTriangle size={20} />
            <span>{historyError}</span>
            <button className="btn small" onClick={loadHistory}>Retry</button>
          </div>
        ) : !history?.history?.length ? (
          <div className="history-empty">
            <Activity size={48} />
            <h3>No activity yet</h3>
            <p>Start using AI tools to see your credit usage here.</p>
          </div>
        ) : (
          <div className="history-list">
            {history.history.slice(0, 20).map((item, index) => {
              const isUsage = 'model_name' in item;
              const date = new Date(item.created_at);
              
              return (
                <div key={`${item.id}-${index}`} className="history-item">
                  <div className="history-icon">
                    {isUsage ? (
                      <Zap size={16} className="usage-icon" />
                    ) : item.type === 'reset' ? (
                      <RefreshCw size={16} className="reset-icon" />
                    ) : item.type === 'bonus' ? (
                      <CheckCircle size={16} className="bonus-icon" />
                    ) : (
                      <DollarSign size={16} className="transaction-icon" />
                    )}
                  </div>
                  
                  <div className="history-content">
                    <div className="history-title">
                      {isUsage ? (
                        `Used ${item.credits_used} credits for ${MODEL_COSTS[item.model_name]?.name || item.model_name}`
                      ) : (
                        item.description
                      )}
                    </div>
                    <div className="history-meta">
                      <Clock size={12} />
                      <span>{date.toLocaleString()}</span>
                      {isUsage && item.task_id && (
                        <>
                          <span>•</span>
                          <span>Task {item.task_id.slice(0, 8)}...</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="history-credits">
                    {isUsage ? (
                      <span className="credits-used">-{item.credits_used}</span>
                    ) : item.type === 'reset' ? (
                      <span className="credits-reset">Reset</span>
                    ) : item.credits > 0 ? (
                      <span className="credits-added">+{item.credits}</span>
                    ) : (
                      <span className="credits-used">{item.credits}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
