'use client';

import { CreditManagement } from '../../components/CreditManagement';

export default function CreditsPage() {
  return (
    <div className="page-template account fade-in">
      <header className="page-hero">
        <div>
          <p className="page-eyebrow">Account</p>
          <h1>Credit Management</h1>
          <p className="page-description">Track remaining balance, understand tool costs, and keep production unblocked.</p>
        </div>
        <div className="page-hero-actions">
          <a href="/billing" className="hero-link">Billing</a>
          <a href="/support" className="hero-link">Need help?</a>
        </div>
      </header>
      <div className="page-grid">
        <div className="page-main">
          <CreditManagement />
        </div>
        <aside className="page-side-panel">
          <div className="side-panel-card">
            <h3>Usage Tips</h3>
            <ul>
              <li>Set alerts when usage exceeds 75% of your plan.</li>
              <li>Review per-tool costs before launching a campaign.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
