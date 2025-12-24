'use client';

import { useState } from 'react';
import type { ClarificationNeededResponse, ClarificationQuestion } from '@/types/agentResponse';

type Props = {
  data: ClarificationNeededResponse;
  onSubmit: (answers: Record<string, string>) => void;
};

export default function ClarificationWidget({ data, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    // Validate required questions
    const missingRequired = data.questions
      .filter((q) => q.required)
      .some((q) => !answers[q.id] || answers[q.id].trim() === '');

    if (missingRequired) {
      alert('Please answer all required questions');
      return;
    }

    setIsSubmitting(true);
    onSubmit(answers);
  };

  const renderQuestion = (question: ClarificationQuestion, index: number) => {
    const value = answers[question.id] || '';

    return (
      <div key={question.id} className="space-y-2">
        <label className="block text-sm font-medium text-gray-200">
          {index + 1}. {question.question}
          {question.required && <span className="text-red-400 ml-1">*</span>}
        </label>

        {question.type === 'text' || question.type === 'url' ? (
          <input
            type={question.type === 'url' ? 'url' : 'text'}
            value={value}
            onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
            placeholder={question.placeholder || 'Your answer...'}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        ) : question.type === 'choice' && question.options ? (
          <div className="space-y-2">
            {question.options.map((option) => (
              <label
                key={option}
                className="flex items-center space-x-3 p-3 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors"
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                  className="w-4 h-4 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                />
                <span className="text-gray-200">{option}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">Quick Questions</h3>
          <p className="text-gray-300 text-sm">{data.message}</p>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-5">
        {data.questions.map((question, index) => renderQuestion(question, index))}
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
      >
        {isSubmitting ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Processing...</span>
          </>
        ) : (
          <>
            <span>Continue</span>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}

