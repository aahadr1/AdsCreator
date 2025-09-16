'use client';

import React, { ReactElement, cloneElement } from 'react';
import { Zap, AlertCircle, Lock } from 'lucide-react';
import { useCredits } from '../lib/creditContext';
import { getCreditCost, MODEL_COSTS } from '../types/credits';

interface CreditGuardProps {
  modelName: string;
  children: ReactElement;
  disabled?: boolean;
  onInsufficientCredits?: () => void;
  showCost?: boolean;
  className?: string;
}

export function CreditGuard({
  modelName,
  children,
  disabled = false,
  onInsufficientCredits,
  showCost = true,
  className = '',
}: CreditGuardProps) {
  const { hasEnoughCredits, useCredits: consumeCredits, credits } = useCredits();
  const creditCost = getCreditCost(modelName);
  const modelInfo = MODEL_COSTS[modelName];
  const hasCredits = hasEnoughCredits(modelName);

  const handleClick = async (originalOnClick?: () => void | Promise<void>) => {
    if (disabled) return;
    
    if (!hasCredits) {
      onInsufficientCredits?.();
      return;
    }

    // Execute original onClick first
    if (originalOnClick) {
      await originalOnClick();
    }

    // Then consume credits (this will be called from the actual API calls)
    // We don't consume here to avoid double-charging
  };

  // Clone the child element and enhance it with credit checking
  const enhancedChild = cloneElement(children, {
    ...children.props,
    disabled: disabled || !hasCredits,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleClick(children.props.onClick);
    },
    className: `${children.props.className || ''} ${className} ${!hasCredits ? 'credit-insufficient' : ''}`.trim(),
    title: !hasCredits 
      ? `Insufficient credits. You need ${creditCost} credits but only have ${credits?.remaining_credits || 0} remaining.`
      : children.props.title || `Uses ${creditCost} credits`,
  });

  return (
    <div className="credit-guard">
      {showCost && (
        <div className={`credit-cost-display ${!hasCredits ? 'credit-insufficient' : ''}`}>
          <Zap size={12} />
          <span>{creditCost} credits</span>
          {modelInfo && (
            <span title={`${modelInfo.name} - ${modelInfo.description}`}>
              ({modelInfo.provider || 'AI'})
            </span>
          )}
        </div>
      )}
      
      {!hasCredits && (
        <div className="credit-insufficient-warning">
          <AlertCircle size={14} />
          <span>Insufficient credits ({credits?.remaining_credits || 0} remaining)</span>
        </div>
      )}
      
      <div className="credit-guard-content">
        {enhancedChild}
        {!hasCredits && (
          <div className="credit-lock-overlay">
            <Lock size={16} />
          </div>
        )}
      </div>
    </div>
  );
}

interface CreditCostDisplayProps {
  modelName: string;
  variant?: 'default' | 'compact' | 'detailed';
  showProvider?: boolean;
}

export function CreditCostDisplay({ 
  modelName, 
  variant = 'default',
  showProvider = false 
}: CreditCostDisplayProps) {
  const { hasEnoughCredits } = useCredits();
  const creditCost = getCreditCost(modelName);
  const modelInfo = MODEL_COSTS[modelName];
  const hasCredits = hasEnoughCredits(modelName);

  if (variant === 'compact') {
    return (
      <span className={`credit-cost-display compact ${!hasCredits ? 'credit-insufficient' : ''}`}>
        <Zap size={10} />
        {creditCost}
      </span>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={`credit-cost-detailed ${!hasCredits ? 'credit-insufficient' : ''}`}>
        <div className="credit-cost-header">
          <Zap size={14} />
          <span className="credit-amount">{creditCost} credits</span>
          {!hasCredits && <AlertCircle size={14} className="insufficient-icon" />}
        </div>
        {modelInfo && (
          <div className="credit-cost-info">
            <div className="model-name">{modelInfo.name}</div>
            {showProvider && modelInfo.provider && (
              <div className="model-provider">via {modelInfo.provider}</div>
            )}
            {modelInfo.description && (
              <div className="model-description">{modelInfo.description}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`credit-cost-display ${!hasCredits ? 'credit-insufficient' : ''}`}>
      <Zap size={12} />
      <span>{creditCost} credits</span>
      {showProvider && modelInfo?.provider && (
        <span className="provider">({modelInfo.provider})</span>
      )}
    </div>
  );
}

interface CreditBannerProps {
  type: 'warning' | 'critical';
  message?: string;
  showUpgrade?: boolean;
}

export function CreditBanner({ type, message, showUpgrade = true }: CreditBannerProps) {
  const { credits } = useCredits();

  const defaultMessages = {
    warning: `You're running low on credits! ${credits?.remaining_credits || 0} remaining this month.`,
    critical: `You're out of credits! ${credits?.remaining_credits || 0} remaining this month.`,
  };

  return (
    <div className={`credit-${type}-banner`}>
      <AlertCircle size={16} />
      <div className="banner-content">
        <div className="banner-message">
          {message || defaultMessages[type]}
        </div>
        {showUpgrade && (
          <div className="banner-actions">
            <a href="/billing" className="btn small">
              Upgrade Plan
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
