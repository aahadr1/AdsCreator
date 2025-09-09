'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/billing/status', { cache: 'no-store' });
      const json = (await res.json()) as { isSubscribed?: boolean };
      setSubscribed(Boolean(json.isSubscribed));
    };
    void load();
  }, []);

  const subscribe = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const json = (await res.json()) as { url?: string };
      if (json.url) window.location.href = json.url;
    } finally {
      setLoading(false);
    }
  };

  const manage = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const json = (await res.json()) as { url?: string };
      if (json.url) window.location.href = json.url;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 640, margin: '40px auto' }}>
      <h1>Billing</h1>
      {subscribed === null ? (
        <p>Loading...</p>
      ) : subscribed ? (
        <>
          <p>You are on the paid plan.</p>
          <button type="button" onClick={manage} onKeyDown={(e) => e.key === 'Enter' && void manage()} disabled={loading}>
            Manage billing
          </button>
        </>
      ) : (
        <>
          <p>To use the app, subscribe to the paid plan.</p>
          <button type="button" onClick={subscribe} onKeyDown={(e) => e.key === 'Enter' && void subscribe()} disabled={loading}>
            {loading ? 'Redirecting…' : 'Subscribe'}
          </button>
        </>
      )}
    </div>
  );
}


