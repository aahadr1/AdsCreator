'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabaseClient as supabase } from './supabaseClient';
import { UserCredits, SubscriptionTier, getCreditCost, CREDIT_LIMITS } from '../types/credits';

interface CreditContextType {
  credits: UserCredits | null;
  loading: boolean;
  error: string | null;
  refreshCredits: () => Promise<void>;
  useCredits: (modelName: string, taskId?: string) => Promise<boolean>;
  hasEnoughCredits: (modelName: string) => boolean;
  formatProgress: () => { percentage: number; status: 'good' | 'warning' | 'critical' };
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

interface CreditProviderProps {
  children: React.ReactNode;
}

export function CreditProvider({ children }: CreditProviderProps) {
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshCredits = useCallback(async () => {
    try {
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCredits(null);
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/credits/status?user_id=${encodeURIComponent(user.id)}`);
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setCredits(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credits');
      console.error('Failed to refresh credits:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const useCredits = useCallback(async (modelName: string, taskId?: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const creditCost = getCreditCost(modelName);
      
      const response = await fetch('/api/credits/use', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          model_name: modelName,
          credits: creditCost,
          task_id: taskId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const result = await response.json();
      
      if (result.success) {
        // Refresh credits to get updated values
        await refreshCredits();
        return true;
      } else {
        setError(result.error || 'Insufficient credits');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to use credits');
      console.error('Failed to use credits:', err);
      return false;
    }
  }, [refreshCredits]);

  const hasEnoughCredits = useCallback((modelName: string): boolean => {
    if (!credits) return false;
    const creditCost = getCreditCost(modelName);
    return credits.remaining_credits >= creditCost;
  }, [credits]);

  const formatProgress = useCallback((): { percentage: number; status: 'good' | 'warning' | 'critical' } => {
    if (!credits) return { percentage: 0, status: 'good' };
    
    const percentage = Math.min((credits.used_credits / credits.monthly_limit) * 100, 100);
    let status: 'good' | 'warning' | 'critical' = 'good';
    
    if (percentage >= 90) status = 'critical';
    else if (percentage >= 75) status = 'warning';
    
    return { percentage, status };
  }, [credits]);

  // Initialize credits on component mount
  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        refreshCredits();
      } else {
        setCredits(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshCredits]);

  const value: CreditContextType = {
    credits,
    loading,
    error,
    refreshCredits,
    useCredits,
    hasEnoughCredits,
    formatProgress,
  };

  return (
    <CreditContext.Provider value={value}>
      {children}
    </CreditContext.Provider>
  );
}

export function useCredits(): CreditContextType {
  const context = useContext(CreditContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditProvider');
  }
  return context;
}

// Hook for getting subscription tier from billing info
export function useSubscriptionTier(): { tier: SubscriptionTier; loading: boolean } {
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTier = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setTier('free');
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/me/subscription?user_id=${encodeURIComponent(user.id)}`);
        if (!response.ok) {
          setTier('free');
          setLoading(false);
          return;
        }

        const data = await response.json();
        const priceId = data.plan_price_id;
        
        // Map price ID to tier
        if (priceId === process.env.NEXT_PUBLIC_PRICE_PRO) {
          setTier('pro');
        } else if (priceId === process.env.NEXT_PUBLIC_PRICE_BASIC) {
          setTier('basic');
        } else {
          setTier('free');
        }
      } catch (err) {
        console.error('Failed to fetch subscription tier:', err);
        setTier('free');
      } finally {
        setLoading(false);
      }
    };

    fetchTier();
  }, []);

  return { tier, loading };
}
