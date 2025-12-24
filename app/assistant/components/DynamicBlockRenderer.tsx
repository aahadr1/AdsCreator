'use client';

import { useState } from 'react';
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
        {block.data.questions.map((q, idx) => (
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
                {q.options.map((option) => (
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
  };

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
          {block.data.thoughts.map((thought, idx) => (
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

// Research Block Component (Simplified - reuse existing logic)
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
          {sources.map((source, idx) => (
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
                {insights.patterns.map((pattern, idx) => (
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

// Strategy, Action, Media, Metrics, Table, Timeline, Comparison components...
// (Simplified versions - can be expanded as needed)

function StrategyBlockComponent({ block }: { block: StrategyBlock }) {
  return (
    <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-xl p-6 space-y-4">
      {block.data.title && <h3 className="text-lg font-semibold text-white">{block.data.title}</h3>}
      {block.data.sections.map((section) => (
        <div key={section.id} className="space-y-2">
          <h4 className="text-sm font-semibold text-purple-400">{section.title}</h4>
          {section.items.map((item, idx) => (
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
  };

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
      {block.data.items.map((item, idx) => (
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
      {block.data.metrics.map((metric, idx) => (
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
            {block.data.headers.map((header, idx) => (
              <th key={idx} className="px-4 py-2 text-left text-gray-300 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.data.rows.map((row, ridx) => (
            <tr key={ridx} className="border-t border-gray-700">
              {row.map((cell, cidx) => (
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
      {block.data.events.map((event, idx) => (
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
      {block.data.items.map((item, idx) => (
        <div key={idx} className={`p-4 rounded-lg ${item.recommended ? 'bg-green-900/20 border border-green-500/30' : 'bg-gray-800/50'}`}>
          <div className="font-medium text-white mb-2">{item.label}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(item.attributes).map(([key, value]) => (
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

