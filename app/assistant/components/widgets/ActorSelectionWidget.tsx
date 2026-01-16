'use client';

import { useState } from 'react';
import {
  User,
  Check,
  RefreshCw,
  Eye,
  AlertTriangle,
  Sparkles,
  X,
} from 'lucide-react';
import type { ActorOption } from '@/types/ugc';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ActorSelectionWidgetProps = {
  data: {
    actors: ActorOption[];
    selectedActorId?: string;
    canRegenerate?: boolean;
    warningMessage?: string;
  };
  onAction: (action: string, data?: any) => void;
};

// -----------------------------------------------------------------------------
// Actor Card
// -----------------------------------------------------------------------------

function ActorCard({
  actor,
  selected,
  onSelect,
  onPreview,
  onRegenerate,
}: {
  actor: ActorOption;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onRegenerate: () => void;
}) {
  const isReady = actor.imageStatus === 'complete' && actor.imageUrl;
  const isProcessing = actor.imageStatus === 'processing';
  const isFailed = actor.imageStatus === 'failed';

  return (
    <div className={`actor-card ${selected ? 'selected' : ''} ${!isReady ? 'pending' : ''}`}>
      {/* Image */}
      <div className="actor-image" onClick={() => isReady && onPreview()}>
        {isReady && actor.imageUrl ? (
          <>
            <img src={actor.imageUrl} alt={actor.label} />
            <div className="actor-overlay">
              <Eye size={20} />
            </div>
          </>
        ) : isProcessing ? (
          <div className="actor-loading">
            <RefreshCw size={24} className="spin" />
            <span>Generating...</span>
          </div>
        ) : isFailed ? (
          <div className="actor-failed">
            <AlertTriangle size={24} />
            <span>Failed</span>
            <button onClick={onRegenerate}>Retry</button>
          </div>
        ) : (
          <div className="actor-placeholder">
            <User size={32} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="actor-info">
        <h4>{actor.label}</h4>
        <p>{actor.description}</p>
        {actor.personaTags && actor.personaTags.length > 0 && (
          <div className="actor-tags">
            {actor.personaTags.slice(0, 3).map((tag, i) => (
              <span key={i} className="tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="actor-actions">
        {selected ? (
          <button className="btn-selected" disabled>
            <Check size={16} />
            Selected
          </button>
        ) : (
          <button
            className="btn-select"
            onClick={onSelect}
            disabled={!isReady}
          >
            Select
          </button>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Preview Modal
// -----------------------------------------------------------------------------

function PreviewModal({
  actor,
  onClose,
}: {
  actor: ActorOption;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content preview-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={24} />
        </button>
        {actor.imageUrl && (
          <img src={actor.imageUrl} alt={actor.label} />
        )}
        <div className="preview-info">
          <h3>{actor.label}</h3>
          <p>{actor.description}</p>
          {actor.demographics && (
            <div className="preview-demographics">
              <span>{actor.demographics.ageRange}</span>
              <span>{actor.demographics.gender}</span>
              <span>{actor.demographics.style}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Widget
// -----------------------------------------------------------------------------

export function ActorSelectionWidget({ data, onAction }: ActorSelectionWidgetProps) {
  const { actors, selectedActorId, canRegenerate, warningMessage } = data;
  const [previewActor, setPreviewActor] = useState<ActorOption | null>(null);

  const handleSelect = (actorId: string) => {
    onAction('select_actor', { actorId });
  };

  const handleRegenerate = (actorId?: string) => {
    onAction('regenerate_actors', { actorId });
  };

  const handleGenerateMore = () => {
    onAction('generate_more_actors');
  };

  return (
    <div className="widget widget-actor-selection">
      {/* Warning Banner */}
      {warningMessage && (
        <div className="warning-banner">
          <AlertTriangle size={16} />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="widget-header">
        <Sparkles size={18} />
        <h3>Choose Your Creator</h3>
      </div>

      {/* Actor Grid */}
      <div className="actor-grid">
        {actors.map(actor => (
          <ActorCard
            key={actor.id}
            actor={actor}
            selected={actor.id === selectedActorId}
            onSelect={() => handleSelect(actor.id)}
            onPreview={() => setPreviewActor(actor)}
            onRegenerate={() => handleRegenerate(actor.id)}
          />
        ))}
      </div>

      {/* Global Actions */}
      {canRegenerate && (
        <div className="widget-actions">
          <button className="btn-secondary" onClick={handleGenerateMore}>
            <RefreshCw size={16} />
            Generate 3 More Options
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {previewActor && (
        <PreviewModal
          actor={previewActor}
          onClose={() => setPreviewActor(null)}
        />
      )}
    </div>
  );
}

export default ActorSelectionWidget;
