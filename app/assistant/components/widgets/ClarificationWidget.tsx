'use client';

import { useState } from 'react';
import { HelpCircle, Check, Lock } from 'lucide-react';
import type { QcmOption } from '@/types/ugc';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ClarificationQuestion = {
  id: string;
  question: string;
  options?: QcmOption[];
  type?: 'select' | 'text' | 'toggle';
};

type ClarificationWidgetProps = {
  data: {
    questions: ClarificationQuestion[];
  };
  onAction: (action: string, data?: any) => void;
};

// -----------------------------------------------------------------------------
// Question Item
// -----------------------------------------------------------------------------

function QuestionItem({
  question,
  value,
  onChange,
}: {
  question: ClarificationQuestion;
  value: any;
  onChange: (value: any) => void;
}) {
  if (question.options && question.options.length > 0) {
    // Render as option buttons
    return (
      <div className="clarification-question">
        <label>{question.question}</label>
        <div className="clarification-options">
          {question.options.map(opt => (
            <button
              key={opt.id}
              className={`clarification-option ${value === opt.value ? 'selected' : ''}`}
              onClick={() => onChange(opt.value)}
            >
              {value === opt.value && <Check size={14} />}
              <span className="option-label">{opt.label}</span>
              {opt.description && (
                <span className="option-desc">{opt.description}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === 'toggle') {
    return (
      <div className="clarification-question">
        <label>
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
          />
          {question.question}
        </label>
      </div>
    );
  }

  // Default: text input
  return (
    <div className="clarification-question">
      <label>{question.question}</label>
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="Type your answer..."
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Widget
// -----------------------------------------------------------------------------

export function ClarificationWidget({ data, onAction }: ClarificationWidgetProps) {
  const { questions } = data;
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleLockDirection = () => {
    onAction('lock_direction', answers);
  };

  const handleRevise = () => {
    onAction('revise_direction', answers);
  };

  const allAnswered = questions.every(q => {
    const answer = answers[q.id];
    return answer !== undefined && answer !== null && answer !== '';
  });

  return (
    <div className="widget widget-clarification">
      <div className="widget-header">
        <HelpCircle size={18} />
        <h3>A few quick questions...</h3>
      </div>

      <div className="clarification-questions">
        {questions.map(question => (
          <QuestionItem
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={value => updateAnswer(question.id, value)}
          />
        ))}
      </div>

      <div className="clarification-actions">
        <button
          className="btn-primary"
          onClick={handleLockDirection}
          disabled={!allAnswered}
        >
          <Lock size={16} />
          Lock Direction
        </button>
        <button className="btn-secondary" onClick={handleRevise}>
          Revise Draft
        </button>
      </div>
    </div>
  );
}

export default ClarificationWidget;
