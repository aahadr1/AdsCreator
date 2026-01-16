'use client';

import type { WidgetBlock } from '@/types/ugc';
import { IntakeWidget } from './IntakeWidget';
import { ActorSelectionWidget } from './ActorSelectionWidget';
import { StoryboardWidget } from './StoryboardWidget';
import { QcmWidget } from './QcmWidget';
import { ClarificationWidget } from './ClarificationWidget';
import { ApprovalGateWidget } from './ApprovalGateWidget';
import { GenerationQueueWidget } from './GenerationQueueWidget';
import { AssemblyWidget } from './AssemblyWidget';
import { StatusWidget } from './StatusWidget';
import { ErrorWidget } from './ErrorWidget';
import { BriefSummaryWidget } from './BriefSummaryWidget';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type WidgetRendererProps = {
  block: WidgetBlock;
  onAction: (action: string, data?: any) => void;
};

// -----------------------------------------------------------------------------
// Main Renderer
// -----------------------------------------------------------------------------

export function WidgetRenderer({ block, onAction }: WidgetRendererProps) {
  switch (block.type) {
    case 'intake':
      return <IntakeWidget data={block.data} onAction={onAction} />;

    case 'brief_summary':
      return <BriefSummaryWidget data={block.data} onAction={onAction} />;

    case 'actor_selection':
      return <ActorSelectionWidget data={block.data} onAction={onAction} />;

    case 'clarification':
      return <ClarificationWidget data={block.data} onAction={onAction} />;

    case 'storyboard':
      return <StoryboardWidget data={block.data} onAction={onAction} />;

    case 'approval_gate':
      return <ApprovalGateWidget data={block.data} onAction={onAction} />;

    case 'generation_queue':
      return <GenerationQueueWidget data={block.data} onAction={onAction} />;

    case 'assembly':
      return <AssemblyWidget data={block.data} onAction={onAction} />;

    case 'qcm':
      return <QcmWidget data={block.data} onAction={onAction} />;

    case 'status':
      return <StatusWidget data={block.data} />;

    case 'error':
      return <ErrorWidget data={block.data} onAction={onAction} />;

    default:
      return (
        <div className="widget widget-unknown">
          <p>Unknown widget type: {block.type}</p>
        </div>
      );
  }
}

export default WidgetRenderer;
