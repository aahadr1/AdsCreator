'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Something went wrong</h2>
            <p style={{ marginBottom: '2rem', opacity: 0.7 }}>
              An unexpected error occurred.
            </p>
            <button 
              onClick={reset}
              style={{ 
                padding: '12px 24px', 
                background: '#000', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
