'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseClient } from '../lib/supabaseClient';

const PUBLIC_PATHS: ReadonlySet<string> = new Set(['/auth', '/']);

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const ensureAuth = async () => {
      try {
        // Skip auth check on public paths
        if (PUBLIC_PATHS.has(pathname)) {
          if (isMounted) setIsChecked(true);
          return;
        }

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
          router.replace('/auth');
          return;
        }

        if (isMounted) setIsChecked(true);
      } catch {
        router.replace('/auth');
      }
    };

    void ensureAuth();

    const { data: authListener } = supabaseClient.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/auth');
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  // Optionally render nothing until auth check completes on protected routes
  if (!isChecked && !PUBLIC_PATHS.has(pathname)) return null;

  return <>{children}</>;
}


