'use client';

import React, { useState, useEffect } from 'react';
import { StreamingThought, Thought } from '@/types/agentPhases';
import { 
  Brain, 
  Search, 
  Lightbulb, 
  TrendingUp, 
  Target, 
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Globe,
  Eye,
  Wrench,
  AlertCircle,
  Sparkles,
  CheckCheck,
  RefreshCw
} from 'lucide-react';

type LiveThinkingStreamProps = {
  thoughts: (Thought | StreamingThought)[];
  currentThought?: string;
  isStreaming?: boolean;
  onThoughtClick?: (thoughtId: string) => void;
};

const thoughtIcons: Record<string, React.FC<any>> = {
  understanding: Brain,
  questioning: AlertCircle,
  researching: Search,
  analyzing: Eye,
  strategizing: Lightbulb,
  deciding: CheckCircle2,
  planning: Target,
  concluding: CheckCheck,
  executing_tool: Wrench,
  evaluating: TrendingUp,
  iterating: RefreshCw,
  error_handling: AlertCircle,
  optimizing: Sparkles,
  validating: CheckCheck,
  refining: Sparkles,
};

const thoughtColors: Record<string, string> = {
  understanding: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
  questioning: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300',
  researching: 'bg-green-500/20 border-green-500/30 text-green-300',
  analyzing: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
  strategizing: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
  deciding: 'bg-teal-500/20 border-teal-500/30 text-teal-300',
  planning: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
  concluding: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
  executing_tool: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300',
  evaluating: 'bg-pink-500/20 border-pink-500/30 text-pink-300',
  iterating: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
  error_handling: 'bg-red-500/20 border-red-500/30 text-red-300',
  optimizing: 'bg-violet-500/20 border-violet-500/30 text-violet-300',
  validating: 'bg-lime-500/20 border-lime-500/30 text-lime-300',
  refining: 'bg-fuchsia-500/20 border-fuchsia-500/30 text-fuchsia-300',
};

const getThoughtPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'critical':
      return 'border-l-4 border-l-red-500';
    case 'important':
      return 'border-l-4 border-l-yellow-500';
    default:
      return 'border-l-4 border-l-gray-600';
  }
};

const ThoughtCard: React.FC<{
  thought: Thought | StreamingThought;
  isExpanded: boolean;
  onToggle: () => void;
  isLatest?: boolean;
}> = ({ thought, isExpanded, onToggle, isLatest }) => {
  const Icon = thoughtIcons[thought.type] || Brain;
  const colorClass = thoughtColors[thought.type] || thoughtColors.understanding;
  const priorityClass = getThoughtPriorityColor(thought.priority);
  
  const isStreaming = 'isStreaming' in thought && thought.isStreaming;
  const displayContent = isStreaming ? thought.partialContent || thought.content : thought.content;
  
  const statusIcon = thought.status === 'complete' ? (
    <CheckCircle2 className="w-4 h-4 text-green-400" />
  ) : thought.status === 'active' ? (
    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
  ) : null;

  const elapsedTime = thought.duration
    ? `${(thought.duration / 1000).toFixed(1)}s`
    : isLatest && thought.timestamp
    ? `${((Date.now() - thought.timestamp) / 1000).toFixed(0)}s`
    : null;

  return (
    <div
      className={`
        thought-card rounded-lg border p-4 mb-3 transition-all duration-300
        ${colorClass} ${priorityClass}
        ${isLatest ? 'ring-2 ring-blue-500/50 shadow-lg' : ''}
        ${isStreaming ? 'animate-pulse' : ''}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="mt-0.5">
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-semibold text-white">{thought.title}</h4>
              {statusIcon}
              {elapsedTime && (
                <span className="text-xs text-gray-400">{elapsedTime}</span>
              )}
              {thought.priority && thought.priority !== 'info' && (
                <span className={`
                  text-xs px-2 py-0.5 rounded-full
                  ${thought.priority === 'critical' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}
                `}>
                  {thought.priority}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {displayContent}
              {isStreaming && <span className="animate-pulse">▋</span>}
            </p>
            
            {/* Tool execution indicator */}
            {thought.toolExecution && (
              <div className="mt-3 bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                <div className="flex items-center space-x-2 mb-2">
                  <Wrench className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-white">
                    Tool: {thought.toolExecution.toolName}
                  </span>
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full
                    ${thought.toolExecution.status === 'complete' ? 'bg-green-500/20 text-green-300' : 
                      thought.toolExecution.status === 'error' ? 'bg-red-500/20 text-red-300' :
                      'bg-blue-500/20 text-blue-300'}
                  `}>
                    {thought.toolExecution.status}
                  </span>
                </div>
                {thought.toolExecution.status === 'running' && (
                  <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2">
                    <div className="bg-cyan-500 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                )}
                <pre className="text-xs text-gray-400 bg-gray-950 rounded p-2 overflow-x-auto">
                  {JSON.stringify(thought.toolExecution.params, null, 2)}
                </pre>
                {thought.toolExecution.error && (
                  <div className="mt-2 text-xs text-red-400">
                    Error: {thought.toolExecution.error}
                  </div>
                )}
              </div>
            )}

            {/* Progress bar */}
            {thought.progress !== undefined && thought.progress < 100 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">Progress</span>
                  <span className="text-xs text-gray-400">{thought.progress}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${thought.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Expandable details */}
            {thought.details && thought.details.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={onToggle}
                  className="flex items-center space-x-1 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span>{isExpanded ? 'Hide' : 'Show'} details ({thought.details.length})</span>
                </button>
                {isExpanded && (
                  <ul className="mt-2 space-y-1 text-xs text-gray-400 ml-4">
                    {thought.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="text-blue-400 mt-0.5">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Nested thoughts (children) */}
            {thought.children && thought.children.length > 0 && (
              <div className="mt-3 ml-4 border-l-2 border-gray-700 pl-4 space-y-2">
                {thought.children.map((child) => (
                  <div key={child.id} className="text-xs">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-gray-500">{child.type}</span>
                      <span className="text-gray-400">{child.title}</span>
                    </div>
                    <p className="text-gray-500">{child.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function LiveThinkingStream({
  thoughts,
  currentThought,
  isStreaming,
  onThoughtClick,
}: LiveThinkingStreamProps) {
  const [expandedThoughts, setExpandedThoughts] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const toggleThought = (thoughtId: string) => {
    setExpandedThoughts((prev) => {
      const next = new Set(prev);
      if (next.has(thoughtId)) {
        next.delete(thoughtId);
      } else {
        next.add(thoughtId);
      }
      return next;
    });
  };

  // Auto-scroll to latest thought
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [thoughts, autoScroll]);

  if (thoughts.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-3" />
        <span>Initializing thinking process...</span>
      </div>
    );
  }

  return (
    <div className="live-thinking-stream">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-white">Thinking Process</h3>
          {isStreaming && (
            <span className="flex items-center space-x-1 text-xs text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Live</span>
            </span>
          )}
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`text-xs px-2 py-1 rounded ${
            autoScroll ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-700 text-gray-400'
          }`}
        >
          {autoScroll ? '✓ Auto-scroll' : 'Auto-scroll off'}
        </button>
      </div>

      {/* Current thought banner */}
      {currentThought && (
        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg flex items-center space-x-3">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <span className="text-sm text-blue-200">{currentThought}</span>
        </div>
      )}

      {/* Thoughts list */}
      <div ref={containerRef} className="max-h-[600px] overflow-y-auto pr-2 space-y-0">
        {thoughts.map((thought, idx) => (
          <ThoughtCard
            key={thought.id}
            thought={thought}
            isExpanded={expandedThoughts.has(thought.id)}
            onToggle={() => toggleThought(thought.id)}
            isLatest={idx === thoughts.length - 1}
          />
        ))}
      </div>

      {/* Summary stats */}
      <div className="mt-4 pt-3 border-t border-gray-700 flex items-center justify-between text-xs text-gray-400">
        <span>{thoughts.length} thoughts</span>
        {thoughts[0] && thoughts[thoughts.length - 1] && (
          <span>
            {((thoughts[thoughts.length - 1].timestamp - thoughts[0].timestamp) / 1000).toFixed(1)}s elapsed
          </span>
        )}
      </div>
    </div>
  );
}

