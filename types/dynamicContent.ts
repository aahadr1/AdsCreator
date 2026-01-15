/**
 * Dynamic Content Block System
 * 
 * This allows the assistant to compose ANY combination of content blocks
 * without being limited by predefined pipelines or response types.
 */

import type {
  UgcAvatarPickerBlock,
  UgcStoryboardLinkBlock,
  UgcClipsResultBlock,
} from './ugc';

export type {
  UgcAvatarPickerBlock,
  UgcStoryboardLinkBlock,
  UgcClipsResultBlock
} from './ugc';

export type BlockMetadata = {
  timestamp?: string;
  source?: string;
  priority?: 'low' | 'medium' | 'high';
  collapsible?: boolean;
  defaultExpanded?: boolean;
};

export type BaseBlock<TBlockType extends string = string, TData = Record<string, any>> = {
  id: string;
  blockType: TBlockType;
  data: TData;
  metadata?: BlockMetadata;
};

export type QuestionBlock = BaseBlock<
  'question',
  {
    questions: Array<{
      id: string;
      question: string;
      type: 'text' | 'url' | 'choice' | 'multiselect' | 'number' | 'date';
      options?: string[];
      required?: boolean;
      placeholder?: string;
      defaultValue?: string;
      validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        message?: string;
      };
    }>;
    title?: string;
    description?: string;
    submitLabel?: string;
    submitAction?: string;
  }
>;

export type TextBlock = BaseBlock<
  'text',
  {
    content: string;
    format?: 'plain' | 'markdown' | 'html';
    style?: 'normal' | 'success' | 'warning' | 'error' | 'info';
  }
>;

export type ThinkingBlock = BaseBlock<
  'thinking',
  {
    title: string;
    thoughts: string[];
    decision?: string;
    reasoning?: string;
  }
>;

export type ResearchBlock = BaseBlock<
  'research',
  {
    status: 'in_progress' | 'complete' | 'partial';
    sources: Array<{
      name: string;
      type: 'competitor' | 'web' | 'library' | 'analysis';
      url?: string;
    }>;
    insights?: {
      summary?: string;
      patterns?: string[];
      recommendations?: string[];
      dataPoints?: Array<{
        label: string;
        value: string | number;
        context?: string;
      }>;
      quotes?: string[];
      visuals?: string[]; // URLs to screenshots/images
    };
  }
>;

export type StrategyBlock = BaseBlock<
  'strategy',
  {
    title?: string;
    sections: Array<{
      id: string;
      title: string;
      type: 'audience' | 'angle' | 'route' | 'testing' | 'custom';
      items: Array<{
        label: string;
        description?: string;
        tags?: string[];
        metadata?: Record<string, any>;
      }>;
    }>;
  }
>;

export type ActionBlock = BaseBlock<
  'action',
  {
    label: string;
    action: string; // Action identifier
    style?: 'primary' | 'secondary' | 'success' | 'danger';
    icon?: string;
    parameters?: Record<string, any>;
    confirmation?: {
      required: boolean;
      message: string;
    };
  }
>;

export type MediaBlock = BaseBlock<
  'media',
  {
    items: Array<{
      url: string;
      type: 'image' | 'video' | 'audio';
      caption?: string;
      thumbnail?: string;
    }>;
    layout?: 'grid' | 'carousel' | 'list';
  }
>;

export type MetricsBlock = BaseBlock<
  'metrics',
  {
    metrics: Array<{
      label: string;
      value: string | number;
      change?: {
        value: number;
        direction: 'up' | 'down' | 'neutral';
      };
      format?: 'number' | 'currency' | 'percentage' | 'duration';
    }>;
    layout?: 'row' | 'grid';
  }
>;

export type TableBlock = BaseBlock<
  'table',
  {
    headers: string[];
    rows: Array<Array<string | number>>;
    sortable?: boolean;
    filterable?: boolean;
  }
>;

export type TimelineBlock = BaseBlock<
  'timeline',
  {
    events: Array<{
      id: string;
      timestamp: string;
      title: string;
      description?: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
      icon?: string;
    }>;
  }
>;

export type ComparisonBlock = BaseBlock<
  'comparison',
  {
    items: Array<{
      label: string;
      attributes: Record<string, string | number | boolean>;
      score?: number;
      recommended?: boolean;
    }>;
  }
>;

export type UnknownBlock = BaseBlock<string, Record<string, any>>;

// Base union for all content blocks
export type ContentBlock =
  | QuestionBlock
  | TextBlock
  | ThinkingBlock
  | ResearchBlock
  | StrategyBlock
  | ActionBlock
  | MediaBlock
  | MetricsBlock
  | TableBlock
  | TimelineBlock
  | ComparisonBlock
  | UgcAvatarPickerBlock
  | UgcStoryboardLinkBlock
  | UgcClipsResultBlock
  | UnknownBlock;

// Dynamic response that can contain any combination of blocks
export type DynamicResponse = {
  responseType: 'dynamic';
  blocks: ContentBlock[];
  metadata?: {
    conversationId?: string;
    requiresContinuation?: boolean;
    nextAction?: string;
  };
};

// Type guards
export function isQuestionBlock(block: ContentBlock): block is QuestionBlock {
  return block.blockType === 'question';
}

export function isTextBlock(block: ContentBlock): block is TextBlock {
  return block.blockType === 'text';
}

export function isThinkingBlock(block: ContentBlock): block is ThinkingBlock {
  return block.blockType === 'thinking';
}

export function isResearchBlock(block: ContentBlock): block is ResearchBlock {
  return block.blockType === 'research';
}

export function isStrategyBlock(block: ContentBlock): block is StrategyBlock {
  return block.blockType === 'strategy';
}

export function isActionBlock(block: ContentBlock): block is ActionBlock {
  return block.blockType === 'action';
}

export function isMediaBlock(block: ContentBlock): block is MediaBlock {
  return block.blockType === 'media';
}

export function isMetricsBlock(block: ContentBlock): block is MetricsBlock {
  return block.blockType === 'metrics';
}

export function isTableBlock(block: ContentBlock): block is TableBlock {
  return block.blockType === 'table';
}

export function isTimelineBlock(block: ContentBlock): block is TimelineBlock {
  return block.blockType === 'timeline';
}

export function isComparisonBlock(block: ContentBlock): block is ComparisonBlock {
  return block.blockType === 'comparison';
}

export function isUgcAvatarPickerBlock(block: ContentBlock): block is UgcAvatarPickerBlock {
  return block.blockType === 'ugc_avatar_picker';
}

export function isUgcStoryboardLinkBlock(block: ContentBlock): block is UgcStoryboardLinkBlock {
  return block.blockType === 'ugc_storyboard_link';
}

export function isUgcClipsResultBlock(block: ContentBlock): block is UgcClipsResultBlock {
  return block.blockType === 'ugc_clips_result';
}

export function isDynamicResponse(response: any): response is DynamicResponse {
  return response?.responseType === 'dynamic' && Array.isArray(response?.blocks);
}

// Helper to create blocks
export function createBlock<T extends ContentBlock['blockType']>(
  blockType: T,
  data: Extract<ContentBlock, { blockType: T }>['data'],
  metadata?: BlockMetadata
): Extract<ContentBlock, { blockType: T }> {
  return {
    id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    blockType,
    data,
    metadata,
  } as Extract<ContentBlock, { blockType: T }>;
}

