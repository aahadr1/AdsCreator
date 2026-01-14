'use client';

import { useState, useEffect } from 'react';
import type {
  ContentBlock,
  QuestionBlock,
  TextBlock,
  ThinkingBlock,
  ResearchBlock,
  StrategyBlock,
  ActionBlock,
  MediaBlock,
  MetricsBlock,
  TableBlock,
  TimelineBlock,
  ComparisonBlock,
  UgcAvatarPickerBlock,
  UgcStoryboardLinkBlock,
  UgcClipsResultBlock,
} from '@/types/dynamicContent';
import {
  isQuestionBlock,
  isTextBlock,
  isThinkingBlock,
  isResearchBlock,
  isStrategyBlock,
  isActionBlock,
  isMediaBlock,
  isMetricsBlock,
  isTableBlock,
  isTimelineBlock,
  isComparisonBlock,
  isUgcAvatarPickerBlock,
  isUgcStoryboardLinkBlock,
  isUgcClipsResultBlock,
} from '@/types/dynamicContent';

type Props = {
  block: ContentBlock;
  onAction?: (action: string, parameters?: Record<string, any>) => void;
};

export default function DynamicBlockRenderer({ block, onAction }: Props) {
  // Question Block
  if (isQuestionBlock(block)) {
    return <QuestionBlockComponent block={block} onAction={onAction} />;
  }

  // Text Block
  if (isTextBlock(block)) {
    return <TextBlockComponent block={block} />;
  }

  // Thinking Block
  if (isThinkingBlock(block)) {
    return <ThinkingBlockComponent block={block} />;
  }

  // Research Block
  if (isResearchBlock(block)) {
    return <ResearchBlockComponent block={block} />;
  }

  // Strategy Block
  if (isStrategyBlock(block)) {
    return <StrategyBlockComponent block={block} />;
  }

  // Action Block
  if (isActionBlock(block)) {
    return <ActionBlockComponent block={block} onAction={onAction} />;
  }

  // Media Block
  if (isMediaBlock(block)) {
    return <MediaBlockComponent block={block} />;
  }

  // Metrics Block
  if (isMetricsBlock(block)) {
    return <MetricsBlockComponent block={block} />;
  }

  // Table Block
  if (isTableBlock(block)) {
    return <TableBlockComponent block={block} />;
  }

  // Timeline Block
  if (isTimelineBlock(block)) {
    return <TimelineBlockComponent block={block} />;
  }

  // Comparison Block
  if (isComparisonBlock(block)) {
    return <ComparisonBlockComponent block={block} />;
  }

  // UGC Avatar Picker Block
  if (isUgcAvatarPickerBlock(block)) {
    return <UgcAvatarPickerBlockComponent block={block} onAction={onAction} />;
  }

  // UGC Storyboard Link Block
  if (isUgcStoryboardLinkBlock(block)) {
    return <UgcStoryboardLinkBlockComponent block={block} onAction={onAction} />;
  }

  // UGC Clips Result Block
  if (isUgcClipsResultBlock(block)) {
    return <UgcClipsResultBlockComponent block={block} />;
  }

  // Fallback: Generic renderer for unknown block types
  return <GenericBlockComponent block={block} />;
}

// Question Block Component
function QuestionBlockComponent({ block, onAction }: { block: QuestionBlock; onAction?: any }) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    if (onAction) {
      setSubmitting(true);
      onAction('submit_answers', { blockId: block.id, answers });
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-6 space-y-4">
      {block.data.title && (
        <h3 className="text-lg font-semibold text-white">{block.data.title}</h3>
      )}
      {block.data.description && (
        <p className="text-sm text-gray-300">{block.data.description}</p>
      )}
      
      <div className="space-y-4">
        {block.data.questions.map((q: any, idx: number) => (
          <div key={q.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-200">
              {idx + 1}. {q.question}
              {q.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            
            {q.type === 'text' || q.type === 'url' || q.type === 'number' ? (
              <input
                type={q.type === 'url' ? 'url' : q.type === 'number' ? 'number' : 'text'}
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                placeholder={q.placeholder}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : q.type === 'choice' && q.options ? (
              <div className="space-y-2">
                {q.options.map((option: string) => (
                  <label
                    key={option}
                    className="flex items-center space-x-3 p-3 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-750"
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={option}
                      checked={answers[q.id] === option}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      className="w-4 h-4 text-blue-500"
                    />
                    <span className="text-gray-200">{option}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : block.data.submitLabel || 'Continue'}
      </button>
    </div>
  );
}

// Text Block Component
function TextBlockComponent({ block }: { block: TextBlock }) {
  const styleClasses = {
    normal: 'text-gray-300',
    success: 'text-green-400 bg-green-900/20 border border-green-500/30 rounded-lg p-4',
    warning: 'text-yellow-400 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4',
    error: 'text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg p-4',
    info: 'text-blue-400 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4',
  } as Record<string, string>;

  return (
    <div className={styleClasses[block.data.style || 'normal']}>
      {block.data.format === 'markdown' ? (
        <div dangerouslySetInnerHTML={{ __html: block.data.content }} />
      ) : (
        <p>{block.data.content}</p>
      )}
    </div>
  );
}

// Thinking Block Component
function ThinkingBlockComponent({ block }: { block: ThinkingBlock }) {
  const [expanded, setExpanded] = useState(block.metadata?.defaultExpanded !== false);

  return (
    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <span className="text-xl">🤔</span>
          <span className="font-medium text-white">{block.data.title}</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {block.data.thoughts.map((thought: string, idx: number) => (
            <div key={idx} className="flex items-start space-x-2 text-sm text-gray-300">
              <span className="text-gray-500 mt-0.5">•</span>
              <span>{thought}</span>
            </div>
          ))}
          {block.data.decision && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="text-xs font-semibold text-blue-400 mb-1">Decision</div>
              <div className="text-sm text-gray-200">{block.data.decision}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Research Block Component
function ResearchBlockComponent({ block }: { block: ResearchBlock }) {
  const { status, sources, insights } = block.data;

  return (
    <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-xl p-6 space-y-4">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
          {status === 'in_progress' ? (
            <svg className="animate-spin h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <h3 className="text-lg font-semibold text-white">
          {status === 'in_progress' ? 'Researching...' : 'Research Complete'}
        </h3>
      </div>

      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sources.map((source: any, idx: number) => (
            <span key={idx} className="px-2 py-1 bg-green-500/10 text-green-400 rounded-md text-xs">
              {source.name}
            </span>
          ))}
        </div>
      )}

      {insights && (
        <div className="space-y-3">
          {insights.patterns && insights.patterns.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Key Patterns</h4>
              <ul className="space-y-1">
                {insights.patterns.map((pattern: string, idx: number) => (
                  <li key={idx} className="text-sm text-gray-300 flex items-start space-x-2">
                    <span className="text-green-400">•</span>
                    <span>{pattern}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StrategyBlockComponent({ block }: { block: StrategyBlock }) {
  return (
    <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-xl p-6 space-y-4">
      {block.data.title && <h3 className="text-lg font-semibold text-white">{block.data.title}</h3>}
      {block.data.sections.map((section: any) => (
        <div key={section.id} className="space-y-2">
          <h4 className="text-sm font-semibold text-purple-400">{section.title}</h4>
          {section.items.map((item: any, idx: number) => (
            <div key={idx} className="bg-gray-800/50 rounded-lg p-3 text-sm text-gray-300">
              <div className="font-medium">{item.label}</div>
              {item.description && <div className="text-xs text-gray-400 mt-1">{item.description}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ActionBlockComponent({ block, onAction }: { block: ActionBlock; onAction?: any }) {
  const styleClasses = {
    primary: 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600',
    secondary: 'bg-gray-700 hover:bg-gray-600',
    success: 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600',
    danger: 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600',
  } as Record<string, string>;

  return (
    <button
      onClick={() => onAction && onAction(block.data.action, block.data.parameters)}
      className={`px-6 py-3 text-white font-medium rounded-lg transition-all ${styleClasses[block.data.style || 'primary']}`}
    >
      {block.data.label}
    </button>
  );
}

function MediaBlockComponent({ block }: { block: MediaBlock }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {block.data.items.map((item: any, idx: number) => (
        <div key={idx} className="rounded-lg overflow-hidden">
          {item.type === 'image' && <img src={item.url} alt={item.caption} className="w-full" />}
          {item.type === 'video' && <video src={item.url} controls className="w-full" />}
        </div>
      ))}
    </div>
  );
}

function MetricsBlockComponent({ block }: { block: MetricsBlock }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {block.data.metrics.map((metric: any, idx: number) => (
        <div key={idx} className="bg-gray-800/50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{metric.value}</div>
          <div className="text-xs text-gray-400">{metric.label}</div>
        </div>
      ))}
    </div>
  );
}

function TableBlockComponent({ block }: { block: TableBlock }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-800/50">
          <tr>
            {block.data.headers.map((header: string, idx: number) => (
              <th key={idx} className="px-4 py-2 text-left text-gray-300 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.data.rows.map((row: any[], ridx: number) => (
            <tr key={ridx} className="border-t border-gray-700">
              {row.map((cell: any, cidx: number) => (
                <td key={cidx} className="px-4 py-2 text-gray-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineBlockComponent({ block }: { block: TimelineBlock }) {
  return (
    <div className="space-y-4">
      {block.data.events.map((event: any, idx: number) => (
        <div key={event.id} className="flex items-start space-x-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            {event.status === 'completed' ? '✓' : idx + 1}
          </div>
          <div className="flex-1">
            <div className="font-medium text-white">{event.title}</div>
            {event.description && <div className="text-sm text-gray-400">{event.description}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ComparisonBlockComponent({ block }: { block: ComparisonBlock }) {
  return (
    <div className="space-y-3">
      {block.data.items.map((item: any, idx: number) => (
        <div key={idx} className={`p-4 rounded-lg ${item.recommended ? 'bg-green-900/20 border border-green-500/30' : 'bg-gray-800/50'}`}>
          <div className="font-medium text-white mb-2">{item.label}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(item.attributes).map(([key, value]: [string, any]) => (
              <div key={key} className="text-gray-300">
                <span className="text-gray-500">{key}:</span> {String(value)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// UGC Avatar Picker Component
function UgcAvatarPickerBlockComponent({ block, onAction }: { block: UgcAvatarPickerBlock; onAction?: any }) {
  const [avatars, setAvatars] = useState(block.data.avatars);
  const [refinement, setRefinement] = useState(block.data.refinementPrompt || '');
  const [submitting, setSubmitting] = useState(false);

  // Poll for status
  useEffect(() => {
    const incomplete = avatars.filter((a: any) => a.status === 'processing' || a.status === 'pending');
    if (incomplete.length === 0) return;

    const interval = setInterval(async () => {
      let updated = false;
      const nextAvatars = [...avatars];

      for (let i = 0; i < nextAvatars.length; i++) {
        const avatar = nextAvatars[i];
        if (avatar.status === 'processing' || avatar.status === 'pending') {
          try {
            const res = await fetch(`/api/replicate/status?id=${avatar.jobId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.status === 'succeeded') {
                nextAvatars[i] = { ...avatar, status: 'complete', url: data.outputUrl || data.output };
                updated = true;
              } else if (data.status === 'failed' || data.status === 'canceled') {
                nextAvatars[i] = { ...avatar, status: 'failed' };
                updated = true;
              }
            }
          } catch (e) {
            console.error('Polling error', e);
          }
        }
      }

      if (updated) setAvatars(nextAvatars);
      if (nextAvatars.every((a: any) => a.status === 'complete' || a.status === 'failed')) {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [avatars]);

  const handleSelect = (avatar: any) => {
    if (!onAction) return;
    onAction('ugc_avatar_select', {
      avatarId: avatar.id,
      selectedAvatarUrl: avatar.url,
      context: refinement
    });
  };

  const handleRefine = () => {
    if (!onAction) return;
    setSubmitting(true);
    onAction('ugc_avatar_regenerate', {
      refinementPrompt: refinement
    });
  };

  return (
    <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-xl p-4 space-y-4">
      <h3 className="text-lg font-semibold text-white">Select Your Creator</h3>
      
      <div className="grid grid-cols-3 gap-3">
        {avatars.map((avatar: any) => (
          <div key={avatar.id} className="relative group aspect-[9/16] bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            {avatar.status === 'complete' && avatar.url ? (
              <>
                <img src={avatar.url} alt="Avatar" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
                  <button
                    onClick={() => handleSelect(avatar)}
                    className="px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-full hover:bg-blue-600 transition-colors"
                  >
                    Select
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                {avatar.status === 'failed' ? (
                  <span className="text-red-400 text-xs">Failed</span>
                ) : (
                  <svg className="animate-spin h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-gray-700/50">
        <label className="text-xs text-gray-400 mb-1 block">Refine Instructions (optional)</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={refinement}
            onChange={(e) => setRefinement(e.target.value)}
            placeholder="e.g. make them older, change background to office..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleRefine}
            disabled={submitting}
            className="px-3 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600 disabled:opacity-50"
          >
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}

// UGC Storyboard Link Component
function UgcStoryboardLinkBlockComponent({ block, onAction }: { block: UgcStoryboardLinkBlock; onAction?: any }) {
  const { storyboard } = block.data;
  
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400">
          <span className="text-xl">🎬</span>
        </div>
        <div>
          <h3 className="font-semibold text-white">Storyboard Ready</h3>
          <p className="text-xs text-gray-400">{storyboard.scenes.length} scenes generated</p>
        </div>
      </div>
      <button
        onClick={() => onAction && onAction('ugc_storyboard_open', { storyboard: block.data.storyboard, selectedAvatarUrl: block.data.selectedAvatarUrl })}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Open Editor
      </button>
    </div>
  );
}

// UGC Clips Result Component
function UgcClipsResultBlockComponent({ block }: { block: UgcClipsResultBlock }) {
  const [clips, setClips] = useState(block.data.clips);

  // Poll for status
  useEffect(() => {
    const incomplete = clips.filter((c: any) => c.status === 'processing' || c.status === 'pending');
    if (incomplete.length === 0) return;

    const interval = setInterval(async () => {
      let updated = false;
      const nextClips = [...clips];

      for (let i = 0; i < nextClips.length; i++) {
        const clip = nextClips[i];
        if (clip.status === 'processing' || clip.status === 'pending') {
          if (!clip.jobId) {
             nextClips[i] = { ...clip, status: 'failed' };
             updated = true;
             continue;
          }
          try {
            // Note: VEO jobs use Replicate status endpoint usually if generated via Replicate
            const res = await fetch(`/api/replicate/status?id=${clip.jobId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.status === 'succeeded') {
                const url = data.outputUrl || (typeof data.output === 'string' ? data.output : data.output?.url);
                nextClips[i] = { ...clip, status: 'complete', url };
                updated = true;
              } else if (data.status === 'failed' || data.status === 'canceled') {
                nextClips[i] = { ...clip, status: 'failed' };
                updated = true;
              }
            }
          } catch (e) {
            console.error('Polling error', e);
          }
        }
      }

      if (updated) setClips(nextClips);
      if (nextClips.every((c: any) => c.status === 'complete' || c.status === 'failed')) {
        clearInterval(interval);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [clips]);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-white px-1">Generated Clips</h3>
      <div className="grid grid-cols-2 gap-3">
        {clips.map((clip: any, idx: number) => (
          <div key={idx} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            <div className="aspect-[9/16] bg-black relative">
              {clip.status === 'complete' && clip.url ? (
                <video src={clip.url} controls className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
                  {clip.status === 'failed' ? (
                    <span className="text-red-400 text-xs">Generation Failed</span>
                  ) : (
                    <>
                      <svg className="animate-spin h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-xs">Generating...</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="p-2 text-xs text-gray-400 truncate border-t border-gray-700">
              Scene {idx + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Generic fallback renderer for unknown block types
function GenericBlockComponent({ block }: { block: ContentBlock }) {
  return (
    <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
      <div className="text-xs text-gray-500 mb-2">Block Type: {block.blockType}</div>
      <pre className="text-xs text-gray-400 overflow-auto">
        {JSON.stringify(block.data, null, 2)}
      </pre>
    </div>
  );
}
