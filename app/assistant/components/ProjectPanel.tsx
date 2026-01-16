'use client';

import { useState } from 'react';
import {
  FileText,
  User,
  Film,
  Video,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Edit3,
  RefreshCw,
  Eye,
  Download,
  History,
} from 'lucide-react';
import type {
  UgcProject,
  ProjectCapabilities,
  CreativeBrief,
  ActorOption,
  Scene,
  Clip,
} from '@/types/ugc';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ProjectPanelProps = {
  project: UgcProject | null;
  capabilities: ProjectCapabilities;
  onEditBrief?: () => void;
  onChangeActor?: () => void;
  onViewScene?: (sceneId: string) => void;
  onViewClip?: (clipId: string) => void;
  onViewHistory?: () => void;
};

// -----------------------------------------------------------------------------
// Status Badge
// -----------------------------------------------------------------------------

function StatusBadge({ status }: { status: 'ready' | 'pending' | 'processing' | 'error' }) {
  const config = {
    ready: { icon: CheckCircle, color: 'var(--color-success)', label: 'Ready' },
    pending: { icon: Clock, color: 'var(--color-muted)', label: 'Pending' },
    processing: { icon: RefreshCw, color: 'var(--color-primary)', label: 'Processing' },
    error: { icon: AlertCircle, color: 'var(--color-error)', label: 'Error' },
  };

  const { icon: Icon, color, label } = config[status];

  return (
    <span className="status-badge" style={{ color }}>
      <Icon size={12} className={status === 'processing' ? 'spin' : ''} />
      {label}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Capability Item
// -----------------------------------------------------------------------------

function CapabilityItem({
  label,
  ready,
  icon: Icon,
  onClick,
  detail,
}: {
  label: string;
  ready: boolean;
  icon: any;
  onClick?: () => void;
  detail?: string;
}) {
  return (
    <div
      className={`capability-item ${ready ? 'ready' : 'pending'} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
    >
      <div className="capability-icon">
        <Icon size={16} />
      </div>
      <div className="capability-content">
        <span className="capability-label">{label}</span>
        {detail && <span className="capability-detail">{detail}</span>}
      </div>
      <div className="capability-status">
        {ready ? (
          <CheckCircle size={14} className="status-ready" />
        ) : (
          <Clock size={14} className="status-pending" />
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Collapsible Section
// -----------------------------------------------------------------------------

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`panel-section ${open ? 'open' : 'collapsed'}`}>
      <button className="section-header" onClick={() => setOpen(!open)}>
        <Icon size={16} />
        <span>{title}</span>
        {badge}
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="section-content">{children}</div>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Brief Summary
// -----------------------------------------------------------------------------

function BriefSummary({
  brief,
  onEdit,
}: {
  brief?: Partial<CreativeBrief>;
  onEdit?: () => void;
}) {
  if (!brief?.productName) {
    return (
      <div className="brief-empty">
        <p>No brief yet. Start by describing your product!</p>
      </div>
    );
  }

  return (
    <div className="brief-summary">
      <div className="brief-header">
        <h4>{brief.productName}</h4>
        {onEdit && (
          <button className="btn-icon" onClick={onEdit} title="Edit brief">
            <Edit3 size={14} />
          </button>
        )}
      </div>
      <div className="brief-details">
        {brief.targetAudience && (
          <p><strong>Audience:</strong> {brief.targetAudience}</p>
        )}
        {brief.primaryGoal && (
          <p><strong>Goal:</strong> {brief.primaryGoal}</p>
        )}
        {brief.offer && (
          <p><strong>Offer:</strong> {brief.offer}</p>
        )}
        {brief.cta && (
          <p><strong>CTA:</strong> {brief.cta}</p>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Actor Card
// -----------------------------------------------------------------------------

function ActorCard({
  actor,
  selected,
  onChange,
}: {
  actor?: ActorOption;
  selected: boolean;
  onChange?: () => void;
}) {
  if (!actor) {
    return (
      <div className="actor-card empty">
        <User size={24} />
        <p>No actor selected</p>
      </div>
    );
  }

  return (
    <div className={`actor-card ${selected ? 'selected' : ''}`}>
      {actor.imageUrl ? (
        <img src={actor.imageUrl} alt={actor.label} className="actor-image" />
      ) : (
        <div className="actor-image-placeholder">
          {actor.imageStatus === 'processing' ? (
            <RefreshCw size={20} className="spin" />
          ) : (
            <User size={20} />
          )}
        </div>
      )}
      <div className="actor-info">
        <h5>{actor.label}</h5>
        <p>{actor.description}</p>
      </div>
      {onChange && (
        <button className="btn-small" onClick={onChange}>
          Change
        </button>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Scene List
// -----------------------------------------------------------------------------

function SceneList({
  scenes,
  clips,
  onViewScene,
}: {
  scenes: Scene[];
  clips: Clip[];
  onViewScene?: (sceneId: string) => void;
}) {
  if (scenes.length === 0) {
    return (
      <div className="scenes-empty">
        <p>No scenes yet</p>
      </div>
    );
  }

  return (
    <div className="scene-list">
      {scenes.map((scene, i) => {
        const clip = clips.find(c => c.sceneId === scene.id);
        let status: 'ready' | 'pending' | 'processing' | 'error' = 'pending';
        
        if (clip?.status === 'complete') status = 'ready';
        else if (clip?.status === 'processing') status = 'processing';
        else if (clip?.status === 'failed') status = 'error';
        else if (scene.isApproved) status = 'pending';

        return (
          <div
            key={scene.id}
            className="scene-item"
            onClick={() => onViewScene?.(scene.id)}
          >
            <div className="scene-thumbnail">
              {scene.keyframes[0]?.imageUrl ? (
                <img src={scene.keyframes[0].imageUrl} alt={`Scene ${i + 1}`} />
              ) : (
                <Film size={16} />
              )}
            </div>
            <div className="scene-info">
              <span className="scene-number">Scene {i + 1}</span>
              <span className="scene-beat">{scene.beatType}</span>
              <span className="scene-duration">{scene.duration}s</span>
            </div>
            <StatusBadge status={status} />
          </div>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function ProjectPanel({
  project,
  capabilities,
  onEditBrief,
  onChangeActor,
  onViewScene,
  onViewClip,
  onViewHistory,
}: ProjectPanelProps) {
  const selectedActor = project?.actors.find(a => a.id === project.selectedActorId);

  return (
    <aside className="project-panel">
      <div className="panel-header">
        <h3>{project?.name || 'New Project'}</h3>
        {onViewHistory && (
          <button className="btn-icon" onClick={onViewHistory} title="Version history">
            <History size={16} />
          </button>
        )}
      </div>

      {/* Capability Overview */}
      <Section title="Progress" icon={CheckCircle} defaultOpen={true}>
        <div className="capabilities-list">
          <CapabilityItem
            label="Brief"
            ready={capabilities.hasBrief}
            icon={FileText}
            onClick={onEditBrief}
            detail={project?.brief?.productName}
          />
          <CapabilityItem
            label="Actor"
            ready={capabilities.hasSelectedActor}
            icon={User}
            onClick={onChangeActor}
            detail={selectedActor?.label}
          />
          <CapabilityItem
            label="Storyboard"
            ready={capabilities.hasStoryboard}
            icon={Film}
            detail={project?.storyboard ? `${project.storyboard.scenes.length} scenes` : undefined}
          />
          <CapabilityItem
            label="Approved"
            ready={capabilities.isStoryboardApproved}
            icon={CheckCircle}
          />
          <CapabilityItem
            label="Videos"
            ready={capabilities.hasAllClipsReady}
            icon={Video}
            detail={project?.clips ? `${project.clips.filter(c => c.status === 'complete').length} ready` : undefined}
          />
          <CapabilityItem
            label="Final Export"
            ready={capabilities.hasFinalExport}
            icon={Download}
          />
        </div>
      </Section>

      {/* Brief Section */}
      {capabilities.hasBrief && (
        <Section title="Brief" icon={FileText} defaultOpen={false}>
          <BriefSummary brief={project?.brief} onEdit={onEditBrief} />
        </Section>
      )}

      {/* Actor Section */}
      {capabilities.hasSelectedActor && (
        <Section title="Creator" icon={User} defaultOpen={false}>
          <ActorCard
            actor={selectedActor}
            selected={true}
            onChange={onChangeActor}
          />
        </Section>
      )}

      {/* Scenes Section */}
      {capabilities.hasStoryboard && (
        <Section
          title="Scenes"
          icon={Film}
          defaultOpen={true}
          badge={
            <span className="section-badge">
              {project?.storyboard?.scenes.length || 0}
            </span>
          }
        >
          <SceneList
            scenes={project?.storyboard?.scenes || []}
            clips={project?.clips || []}
            onViewScene={onViewScene}
          />
        </Section>
      )}

      {/* Final Video */}
      {capabilities.hasFinalExport && project?.finalEdit?.finalVideoUrl && (
        <Section title="Final Video" icon={Video} defaultOpen={true}>
          <div className="final-video-preview">
            <video
              src={project.finalEdit.finalVideoUrl}
              controls
              className="video-player"
            />
            <a
              href={project.finalEdit.finalVideoUrl}
              download
              className="btn-primary"
            >
              <Download size={16} />
              Download
            </a>
          </div>
        </Section>
      )}
    </aside>
  );
}

export default ProjectPanel;
