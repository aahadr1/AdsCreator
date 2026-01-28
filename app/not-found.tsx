'use client';

export default function NotFound() {
  return (
    <div className="container" style={{ gridTemplateColumns: '1fr' }}>
      <div className="panel" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '3rem', marginBottom: '1rem' }}>404</h2>
        <h3 style={{ marginBottom: '1rem' }}>Page Not Found</h3>
        <p style={{ marginBottom: '2rem', opacity: 0.7 }}>
          The page you're looking for doesn't exist.
        </p>
        <a href="/" className="btn">
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
