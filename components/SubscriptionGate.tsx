'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await fetch('/api/billing/status', { cache: 'no-store' });
        const json = (await res.json()) as { isSubscribed?: boolean };
        if (!mounted) return;
        if (json.isSubscribed) setAllowed(true);
        else router.replace('/billing');
      } catch {
        router.replace('/billing');
      }
    };
    void check();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (!allowed) return null;
  return <>{children}</>;
}


