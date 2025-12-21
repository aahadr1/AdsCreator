'use client';

import { useEffect } from 'react';
import { initFaviconPolling } from '../lib/taskStateManager';

/**
 * Provider component that initializes favicon polling
 * Add this to your root layout
 */
export function TaskStateProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initFaviconPolling();
  }, []);

  return <>{children}</>;
}

