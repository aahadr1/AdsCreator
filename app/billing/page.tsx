'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';
import { CreditCard, Crown, ArrowRight } from 'lucide-react';

type SubInfo = {
  status?: string;
  plan_price_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
};

const BASIC_PRICE = process.env.NEXT_PUBLIC_PRICE_BASIC as string | undefined;
const PRO_PRICE = process.env.NEXT_PUBLIC_PRICE_PRO as string | undefined;

export default function BillingPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [info, setInfo] = useState<SubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'checkout-basic' | 'checkout-pro' | 'portal' | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        setUserId(user.id);
        const res = await fetch(`/api/me/subscription?user_id=${encodeURIComponent(user.id)}`);
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as SubInfo;
        setInfo(json);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load billing');
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, []);

  const planLabel = useMemo(() => {
    if (!info?.plan_price_id) return 'No plan';
    if (info.plan_price_id === BASIC_PRICE) return 'Basic';
    if (info.plan_price_id === PRO_PRICE) return 'Pro';
    return 'Unknown';
  }, [info]);

  const handleCheckout = async (priceId: string, kind: 'checkout-basic' | 'checkout-pro') => {
    try {
      if (!userId) return;
      setBusy(kind);
      const res = await fetch(`/api/billing/checkout?user_id=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, mode: 'subscription' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to start checkout');
      window.location.href = json.url as string;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start checkout');
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    try {
      if (!userId) return;
      setBusy('portal');
      const res = await fetch(`/api/billing/portal?user_id=${encodeURIComponent(userId)}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to open portal');
      window.location.href = json.url as string;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to open portal');
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="billing-page">
        <div className="loading-spinner" />
        <p>Loading billing...</p>
      </div>
    );
  }

  return (
    <div className="billing-page">
      <header className="billing-header" role="banner">
        <h1 className="billing-title">
          <CreditCard size={24} />
          Billing
          <span className="billing-subtitle">Manage your subscription</span>
        </h1>
      </header>

      {error ? (
        <div className="billing-error" role="alert">{error}</div>
      ) : null}

      <section className="current-plan" aria-labelledby="current-plan-heading">
        <h2 id="current-plan-heading">Current plan</h2>
        <div className="current-plan-card">
          <div className="current-plan-main">
            <div className="plan-name">
              <Crown size={18} />
              <span>{planLabel}</span>
            </div>
            <div className="plan-status">{info?.status || 'none'}</div>
          </div>
          <div className="current-plan-actions">
            <button
              className="btn"
              type="button"
              onClick={handlePortal}
              onKeyDown={(e) => e.key === 'Enter' ? void handlePortal() : undefined}
              aria-label="Manage subscription"
              disabled={!info?.stripe_customer_id || busy === 'portal'}
            >
              Manage
            </button>
          </div>
        </div>
      </section>

      <section className="plans" aria-labelledby="plans-heading">
        <h2 id="plans-heading">Plans</h2>
        <div className="plans-grid">
          <div className="plan-card" role="region" aria-label="Basic plan">
            <h3>Basic</h3>
            <p>All essentials to get started.</p>
            <button
              className="btn"
              type="button"
              onClick={() => handleCheckout(String(BASIC_PRICE), 'checkout-basic')}
              onKeyDown={(e) => e.key === 'Enter' ? void handleCheckout(String(BASIC_PRICE), 'checkout-basic') : undefined}
              aria-label="Choose Basic plan"
              disabled={!BASIC_PRICE || busy === 'checkout-basic'}
            >
              Select <ArrowRight size={14} />
            </button>
          </div>
          <div className="plan-card plan-pro" role="region" aria-label="Pro plan">
            <h3>Pro</h3>
            <p>Advanced features for power users.</p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => handleCheckout(String(PRO_PRICE), 'checkout-pro')}
              onKeyDown={(e) => e.key === 'Enter' ? void handleCheckout(String(PRO_PRICE), 'checkout-pro') : undefined}
              aria-label="Choose Pro plan"
              disabled={!PRO_PRICE || busy === 'checkout-pro'}
            >
              Upgrade <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}


