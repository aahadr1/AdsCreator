'use client';

import { useState } from 'react';
import { FileText, Edit3, Check, X } from 'lucide-react';
import type { CreativeBrief } from '@/types/ugc';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type BriefSummaryWidgetProps = {
  data: {
    brief: Partial<CreativeBrief>;
    editable?: boolean;
  };
  onAction: (action: string, data?: any) => void;
};

// -----------------------------------------------------------------------------
// Main Widget
// -----------------------------------------------------------------------------

export function BriefSummaryWidget({ data, onAction }: BriefSummaryWidgetProps) {
  const { brief, editable = true } = data;
  const [isEditing, setIsEditing] = useState(false);

  const handleConfirm = () => {
    onAction('confirm_brief');
  };

  const handleEdit = () => {
    setIsEditing(true);
    onAction('edit_brief');
  };

  if (!brief.productName) {
    return (
      <div className="widget widget-brief-summary empty">
        <FileText size={24} />
        <p>No brief yet</p>
      </div>
    );
  }

  return (
    <div className="widget widget-brief-summary">
      <div className="brief-header">
        <FileText size={18} />
        <h3>Creative Brief</h3>
        {editable && (
          <button className="btn-icon" onClick={handleEdit} title="Edit">
            <Edit3 size={14} />
          </button>
        )}
      </div>

      <div className="brief-content">
        {/* Summary Paragraph */}
        <div className="brief-paragraph">
          <p>
            <strong>{brief.productName}</strong>
            {brief.productType && ` (${brief.productType})`}
            {brief.targetAudience && ` targeting ${brief.targetAudience}`}
            {brief.primaryGoal && `. Goal: ${brief.primaryGoal}`}
            {brief.offer && `. Offer: ${brief.offer}`}.
          </p>
        </div>

        {/* Key Details */}
        <div className="brief-details">
          {brief.brandTone && brief.brandTone.length > 0 && (
            <div className="detail-row">
              <span className="detail-label">Brand Tone:</span>
              <span className="detail-value">
                {brief.brandTone.join(', ')}
              </span>
            </div>
          )}

          {brief.cta && (
            <div className="detail-row">
              <span className="detail-label">CTA:</span>
              <span className="detail-value">{brief.cta}</span>
            </div>
          )}

          {brief.keyClaims && brief.keyClaims.length > 0 && (
            <div className="detail-row">
              <span className="detail-label">Claims:</span>
              <span className="detail-value">
                {brief.keyClaims.join(' • ')}
              </span>
            </div>
          )}

          {brief.mustSay && brief.mustSay.length > 0 && (
            <div className="detail-row">
              <span className="detail-label">Must Say:</span>
              <span className="detail-value">
                {brief.mustSay.join(' • ')}
              </span>
            </div>
          )}

          {brief.disclaimers && brief.disclaimers.length > 0 && (
            <div className="detail-row warning">
              <span className="detail-label">Disclaimers:</span>
              <span className="detail-value">
                {brief.disclaimers.join(' • ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="brief-actions">
        <button className="btn-primary" onClick={handleConfirm}>
          <Check size={16} />
          Confirm Brief
        </button>
        <button className="btn-secondary" onClick={handleEdit}>
          <Edit3 size={16} />
          Edit Brief
        </button>
      </div>
    </div>
  );
}

export default BriefSummaryWidget;
