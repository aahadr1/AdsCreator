'use client';

import { useState, useEffect } from 'react';
import type { AgentPhaseResponse, Thought, PlanStep } from '@/types/agentPhases';
import LiveThinkingStream from './LiveThinkingStream';
import ToolExecutionCard from './ToolExecutionCard';

type Props = {
  data: AgentPhaseResponse;
  onQuestionAnswer?: (answers: Record<string, string>) => void;
  onRunWorkflow?: () => void;
};

export default function AgentPhaseDisplay({ data, onQuestionAnswer, onRunWorkflow }: Props) {
  const { activePhase, thinking, planning, executing, needsInput } = data;

  return (
    <div className="space-y-4">
      {/* Phase Indicator */}
      <PhaseIndicator activePhase={activePhase} />

      {/* Thinking Phase - Enhanced with LiveThinkingStream */}
      {thinking && (
        <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border border-indigo-500/30 rounded-xl overflow-hidden">
          <div className="px-4 py-4">
            {/* Show tool execution if active */}
            {thinking.currentToolExecution && (
              <div className="mb-4">
                <ToolExecutionCard
                  toolName={thinking.currentToolExecution.toolName}
                  displayMessage={thinking.currentToolExecution.displayMessage}
                  status="running"
                  progress={thinking.currentToolExecution.progress}
                />
              </div>
            )}
            
            {/* Live thinking stream */}
            {thinking.thoughts && thinking.thoughts.length > 0 && (
              <LiveThinkingStream
                thoughts={thinking.thoughts}
                currentThought={thinking.currentThought}
                isStreaming={thinking.streamingEnabled && thinking.status === 'active'}
              />
            )}
          </div>
        </div>
      )}

      {/* Planning Phase */}
      {planning && (
        <PlanningPhaseDisplay 
          phase={planning} 
          isActive={activePhase === 'planning'}
        />
      )}

      {/* Ready State (Plan Complete, Ready to Execute) */}
      {activePhase === 'ready' && planning && (
        <ReadyToExecuteDisplay 
          plan={planning}
          onRun={onRunWorkflow}
        />
      )}

      {/* Executing Phase */}
      {executing && activePhase === 'executing' && (
        <ExecutingPhaseDisplay phase={executing} />
      )}

      {/* User Input Needed */}
      {needsInput && (
        <UserInputDisplay 
          input={needsInput}
          onAnswer={onQuestionAnswer}
        />
      )}
    </div>
  );
}

// ============================================================================
// Phase Indicator
// ============================================================================

function PhaseIndicator({ activePhase }: { activePhase: string }) {
  const phases = [
    { id: 'thinking', label: 'Thinking', icon: '🧠' },
    { id: 'planning', label: 'Planning', icon: '📋' },
    { id: 'ready', label: 'Ready', icon: '✅' },
    { id: 'executing', label: 'Executing', icon: '⚡' },
    { id: 'complete', label: 'Complete', icon: '🎉' },
  ];

  const currentIndex = phases.findIndex(p => p.id === activePhase);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50 rounded-xl">
      {phases.map((phase, index) => {
        const isActive = phase.id === activePhase;
        const isPast = index < currentIndex;
        const isFuture = index > currentIndex;

        return (
          <div key={phase.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                  isActive
                    ? 'bg-blue-500 ring-2 ring-blue-300 ring-offset-2 ring-offset-gray-900'
                    : isPast
                    ? 'bg-green-500/80'
                    : 'bg-gray-700'
                }`}
              >
                {isPast ? '✓' : phase.icon}
              </div>
              <span className={`text-xs mt-1 ${isActive ? 'text-white font-medium' : 'text-gray-500'}`}>
                {phase.label}
              </span>
            </div>
            {index < phases.length - 1 && (
              <div className={`w-12 h-0.5 mx-2 ${isPast ? 'bg-green-500' : 'bg-gray-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Note: ThinkingPhaseDisplay is now integrated into the main component above

// ============================================================================
// Planning Phase Display
// ============================================================================

function PlanningPhaseDisplay({ phase, isActive }: { phase: any; isActive: boolean }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-500/30 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <span className="text-xl">📋</span>
          <span className="font-semibold text-white">Execution Plan</span>
          <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-300 text-xs rounded-full">
            {phase.totalSteps || phase.steps?.length || 0} steps
          </span>
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

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {phase.summary && (
            <p className="text-sm text-gray-300">{phase.summary}</p>
          )}

          {/* Steps */}
          <div className="space-y-2">
            {phase.steps?.map((step: PlanStep, index: number) => (
              <div
                key={step.id}
                className="flex items-start space-x-3 p-3 bg-gray-800/50 rounded-lg"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white text-sm">{step.title}</span>
                    <span className="text-xs text-gray-500">{step.model}</span>
                  </div>
                  {step.description && (
                    <p className="text-xs text-gray-400 mt-1">{step.description}</p>
                  )}
                  {step.reasoning && (
                    <p className="text-xs text-emerald-400/70 mt-1 italic">
                      Why: {step.reasoning}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Estimated Time */}
          {phase.estimatedTotalTime && (
            <div className="flex items-center justify-between text-sm text-gray-400 pt-2 border-t border-gray-700">
              <span>Estimated time:</span>
              <span className="text-white font-medium">
                {formatDuration(phase.estimatedTotalTime)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Ready to Execute Display
// ============================================================================

function ReadyToExecuteDisplay({ plan, onRun }: { plan: any; onRun?: () => void }) {
  return (
    <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl p-6 text-center space-y-4">
      <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
        <span className="text-3xl">✅</span>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">Plan Ready!</h3>
        <p className="text-sm text-gray-300 mt-1">
          {plan.totalSteps || plan.steps?.length} steps prepared. Click to execute.
        </p>
      </div>
      <button
        onClick={onRun}
        className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg shadow-green-500/25"
      >
        ▶ Run Workflow
      </button>
    </div>
  );
}

// ============================================================================
// Executing Phase Display
// ============================================================================

function ExecutingPhaseDisplay({ phase }: { phase: any }) {
  const steps = Object.entries(phase.steps || {});
  const completedCount = steps.filter(([, s]: any) => s.status === 'complete').length;

  return (
    <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border border-amber-500/30 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-xl">⚡</span>
          <span className="font-semibold text-white">Executing</span>
        </div>
        <span className="text-sm text-gray-400">
          {completedCount} / {steps.length} complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      {/* Step statuses */}
      <div className="space-y-2">
        {steps.map(([id, step]: any, index) => (
          <div
            key={id}
            className={`flex items-center justify-between p-2 rounded-lg ${
              step.status === 'running'
                ? 'bg-amber-500/20 border border-amber-500/30'
                : step.status === 'complete'
                ? 'bg-green-500/10'
                : 'bg-gray-800/50'
            }`}
          >
            <div className="flex items-center space-x-2">
              {step.status === 'running' && (
                <svg className="animate-spin h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {step.status === 'complete' && <span className="text-green-400">✓</span>}
              {step.status === 'pending' && <span className="text-gray-500">○</span>}
              {step.status === 'error' && <span className="text-red-400">✗</span>}
              <span className={`text-sm ${step.status === 'running' ? 'text-white' : 'text-gray-400'}`}>
                Step {index + 1}
              </span>
            </div>
            {step.status === 'running' && step.progress !== undefined && (
              <span className="text-xs text-amber-400">{step.progress}%</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// User Input Display
// ============================================================================

function UserInputDisplay({ input, onAnswer }: { input: any; onAnswer?: any }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    if (onAnswer) onAnswer(answers);
  };

  if (input.type === 'question') {
    return (
      <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border border-blue-500/30 rounded-xl p-4 space-y-4">
        {input.data.questions?.map((q: any) => (
          <div key={q.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-200">{q.question}</label>
            {q.type === 'text' && (
              <input
                type="text"
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              />
            )}
            {q.type === 'choice' && (
              <div className="space-y-2">
                {q.options?.map((opt: string) => (
                  <label key={opt} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      className="text-blue-500"
                    />
                    <span className="text-gray-300">{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
        <button
          onClick={handleSubmit}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Continue
        </button>
      </div>
    );
  }

  return null;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

