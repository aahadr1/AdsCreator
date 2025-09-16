'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseClient as supabase } from '../lib/supabaseClient';

const PUBLIC_PATHS = new Set<string>(['/auth', '/billing', '/']);

type SubState = {
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused' | 'unpaid' | 'none' | 'unknown';
};

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const ensureSubscription = async () => {
      try {
        if (PUBLIC_PATHS.has(pathname)) {
          if (isMounted) setChecked(true);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/auth');
          return;
        }

        const res = await fetch(`/api/me/subscription?user_id=${encodeURIComponent(user.id)}`);
        const json = (await res.json()) as SubState | { error?: string };
        const status = (json as SubState).status || 'unknown';
        const isActive = status === 'active' || status === 'trialing' || status === 'past_due';
        if (!isActive) {
          router.replace('/billing');
          return;
        }

        if (isMounted) setChecked(true);
      } catch {
        router.replace('/billing');
      }
    };

    void ensureSubscription();
    return () => { isMounted = false; };
  }, [pathname, router]);

  if (!checked && !PUBLIC_PATHS.has(pathname)) return null;
  return <>{children}</>;
}


