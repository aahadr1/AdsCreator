'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';
import { CreditCard, Crown, ArrowRight, Zap, Check, Star } from 'lucide-react';
import { useCredits } from '../../lib/creditContext';

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
  const { credits } = useCredits();

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
    if (!info?.plan_price_id) return 'Free';
    if (info.plan_price_id === BASIC_PRICE) return 'Basic';
    if (info.plan_price_id === PRO_PRICE) return 'Pro';
    return 'Free';
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
    <div className="page-template account fade-in">
      <header className="page-hero">
        <div>
          <p className="page-eyebrow">Account</p>
          <h1>Plans & Billing</h1>
          <p className="page-description">Review your current plan, change tiers, and stay ahead of your credit usage.</p>
        </div>
        <div className="page-hero-actions">
          <button className="btn inline" type="button" onClick={handlePortal} disabled={busy === 'portal'}>
            {busy === 'portal' ? 'Loading...' : 'Manage subscription'}
          </button>
          <a href="/credits" className="hero-link">Credit Center</a>
        </div>
      </header>
      <div className="page-grid">
        <div className="page-main">
          <div className="billing-page">
        <div className="loading-spinner" />
        <p>Loading billing information...</p>
      </div>
    );
  }

  const currentPlan = planLabel;
  const isCurrentPlan = (plan: string) => currentPlan === plan;

  return (
    <div className="billing-page fade-in">
      <div className="billing-container">
        {/* Header */}
        <header className="billing-header">
          <div className="billing-header-content">
            <div className="billing-title-section">
              <CreditCard className="billing-icon" size={32} />
              <div>
                <h1 className="billing-title">Plans & Billing</h1>
                <p className="billing-subtitle">Choose the perfect plan for your creative needs</p>
              </div>
            </div>
            {credits && (
              <div className="current-credits">
                <Zap size={16} />
                <span>{credits.remaining_credits} credits remaining</span>
              </div>
            )}
          </div>
        </header>

        {error && (
          <div className="billing-error" role="alert">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Current Plan Status */}
        <section className="current-plan-section">
          <div className="current-plan-card">
            <div className="current-plan-info">
              <div className="current-plan-badge">
                <Crown size={16} />
                <span>Current Plan</span>
              </div>
              <div className="current-plan-details">
                <h3 className="current-plan-name">{currentPlan}</h3>
                <p className="current-plan-status">
                  Status: <span className={`status-${info?.status || 'active'}`}>{info?.status || 'Active'}</span>
                </p>
              </div>
            </div>
            {info?.stripe_customer_id && (
              <button
                className="btn btn-outline"
                type="button"
                onClick={handlePortal}
                disabled={busy === 'portal'}
              >
                {busy === 'portal' ? 'Loading...' : 'Manage Subscription'}
              </button>
            )}
          </div>
        </section>

        {/* Pricing Plans */}
        <section className="pricing-section">
          <div className="pricing-header">
            <h2>Choose Your Plan</h2>
            <p>Unlock powerful AI-driven content creation tools with our flexible pricing plans</p>
          </div>

          <div className="pricing-grid">
            {/* Free Plan */}
            <div className={`pricing-card ${isCurrentPlan('Free') ? 'current-plan' : ''}`}>
              <div className="pricing-card-header">
                <div className="plan-icon">
                  <Zap size={24} />
                </div>
                <h3 className="plan-name">Free</h3>
                <div className="plan-price">
                  <span className="price-amount">$0</span>
                  <span className="price-period">/month</span>
                </div>
                <p className="plan-description">Perfect for getting started</p>
              </div>

              <div className="pricing-card-body">
                <div className="credits-info">
                  <div className="credits-badge">
                    <Zap size={14} />
                    <span>100 credits/month</span>
                  </div>
                </div>

                <ul className="plan-features">
                  <li><Check size={16} /> Core lipsync features</li>
                  <li><Check size={16} /> Basic TTS (Text-to-Speech)</li>
                  <li><Check size={16} /> Image generation</li>
                  <li><Check size={16} /> Community support</li>
                  <li><Check size={16} /> Standard processing</li>
                </ul>
              </div>

              <div className="pricing-card-footer">
                {isCurrentPlan('Free') ? (
                  <div className="current-plan-indicator">
                    <Check size={16} />
                    <span>Current Plan</span>
                  </div>
                ) : (
                  <p className="plan-note">You&apos;re already on the free plan!</p>
                )}
              </div>
            </div>

            {/* Basic Plan */}
            <div className={`pricing-card ${isCurrentPlan('Basic') ? 'current-plan' : ''}`}>
              <div className="pricing-card-header">
                <div className="plan-icon">
                  <Crown size={24} />
                </div>
                <h3 className="plan-name">Basic</h3>
                <div className="plan-price">
                  <span className="price-amount">$19</span>
                  <span className="price-period">/month</span>
                </div>
                <p className="plan-description">Great for regular creators</p>
              </div>

              <div className="pricing-card-body">
                <div className="credits-info">
                  <div className="credits-badge credits-basic">
                    <Zap size={14} />
                    <span>500 credits/month</span>
                  </div>
                </div>

                <ul className="plan-features">
                  <li><Check size={16} /> Everything in Free</li>
                  <li><Check size={16} /> 5x more credits</li>
                  <li><Check size={16} /> Priority processing</li>
                  <li><Check size={16} /> Advanced TTS models</li>
                  <li><Check size={16} /> Email support</li>
                  <li><Check size={16} /> Export in HD quality</li>
                </ul>
              </div>

              <div className="pricing-card-footer">
                {isCurrentPlan('Basic') ? (
                  <div className="current-plan-indicator">
                    <Check size={16} />
                    <span>Current Plan</span>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => handleCheckout(String(BASIC_PRICE), 'checkout-basic')}
                    disabled={!BASIC_PRICE || busy === 'checkout-basic'}
                  >
                    {busy === 'checkout-basic' ? 'Loading...' : 'Upgrade to Basic'}
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Pro Plan */}
            <div className={`pricing-card pro-plan ${isCurrentPlan('Pro') ? 'current-plan' : ''}`}>
              <div className="plan-badge-ribbon">
                <Star size={14} />
                <span>Most Popular</span>
              </div>
              
              <div className="pricing-card-header">
                <div className="plan-icon">
                  <Star size={24} />
                </div>
                <h3 className="plan-name">Pro</h3>
                <div className="plan-price">
                  <span className="price-amount">$49</span>
                  <span className="price-period">/month</span>
                </div>
                <p className="plan-description">For professional creators</p>
              </div>

              <div className="pricing-card-body">
                <div className="credits-info">
                  <div className="credits-badge credits-pro">
                    <Zap size={14} />
                    <span>1,000 credits/month</span>
                  </div>
                </div>

                <ul className="plan-features">
                  <li><Check size={16} /> Everything in Basic</li>
                  <li><Check size={16} /> 10x more credits than Free</li>
                  <li><Check size={16} /> Advanced video generation (Veo)</li>
                  <li><Check size={16} /> Auto Edit Beta access</li>
                  <li><Check size={16} /> Premium TTS voices</li>
                  <li><Check size={16} /> Priority support</li>
                  <li><Check size={16} /> Commercial usage rights</li>
                  <li><Check size={16} /> API access</li>
                </ul>
              </div>

              <div className="pricing-card-footer">
                {isCurrentPlan('Pro') ? (
                  <div className="current-plan-indicator">
                    <Check size={16} />
                    <span>Current Plan</span>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => handleCheckout(String(PRO_PRICE), 'checkout-pro')}
                    disabled={!PRO_PRICE || busy === 'checkout-pro'}
                  >
                    {busy === 'checkout-pro' ? 'Loading...' : 'Upgrade to Pro'}
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Credit Information */}
        <section className="credits-info-section">
          <div className="credits-info-card">
            <div className="credits-info-header">
              <Zap size={24} />
              <h3>How Credits Work</h3>
            </div>
            <div className="credits-info-content">
              <p>Credits are consumed based on the AI model and features you use:</p>
              <ul className="credits-pricing">
                <li><strong>Text-to-Speech:</strong> 5-8 credits per generation</li>
                <li><strong>Image Generation:</strong> 3-6 credits per image</li>
                <li><strong>Video Generation:</strong> 15-25 credits per video</li>
                <li><strong>Lipsync Processing:</strong> 10-20 credits per video</li>
              </ul>
              <p className="credits-note">
                <strong>Note:</strong> Credits reset monthly and don&apos;t roll over. Upgrade anytime for more credits!
              </p>
            </div>
          </div>
        </section>
          </div>
        </div>
        <aside className="page-side-panel">
          <div className="side-panel-card">
            <h3>Current Plan</h3>
            <p>{currentPlan}</p>
            <p>Status: {info?.status || 'Active'}</p>
          </div>
          <div className="side-panel-card">
            <h3>Renewal</h3>
            <p>Stripe Customer: {info?.stripe_customer_id || '—'}</p>
            <p>Renews: {info?.current_period_end ? new Date(info.current_period_end).toLocaleDateString() : '—'}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
