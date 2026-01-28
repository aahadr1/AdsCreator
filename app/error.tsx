'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="container" style={{ gridTemplateColumns: '1fr' }}>
      <div className="panel" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '3rem', marginBottom: '1rem' }}>500</h2>
        <h3 style={{ marginBottom: '1rem' }}>Something went wrong</h3>
        <p style={{ marginBottom: '2rem', opacity: 0.7 }}>
          An error occurred while processing your request.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button onClick={reset} className="btn">
            Try again
          </button>
          <a href="/" className="select" style={{ padding: '12px 24px' }}>
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
