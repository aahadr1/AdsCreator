'use client';

import type { ResearchCompleteResponse, ResearchInProgressResponse } from '@/types/agentResponse';

type Props = {
  data: ResearchCompleteResponse | ResearchInProgressResponse;
};

export default function ResearchWidget({ data }: Props) {
  const isInProgress = data.responseType === 'research_in_progress';
  const isComplete = data.responseType === 'research_complete';

  return (
    <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
          {isInProgress ? (
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
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">
            {isInProgress ? 'Analyzing Competitors...' : 'Competitive Research Complete'}
          </h3>
          <p className="text-gray-300 text-sm">{data.message}</p>
        </div>
      </div>

      {/* In Progress */}
      {isInProgress && 'competitors' in data && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span>Researching:</span>
            <div className="flex flex-wrap gap-2">
              {data.competitors.map((competitor) => (
                <span key={competitor} className="px-2 py-1 bg-green-500/10 text-green-400 rounded-md text-xs">
                  {competitor}
                </span>
              ))}
            </div>
          </div>
          <p className="text-sm text-gray-400">{data.status}</p>
        </div>
      )}

      {/* Complete */}
      {isComplete && 'insights' in data && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-white">{data.insights.competitors_analyzed.length}</div>
              <div className="text-xs text-gray-400">Competitors</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-white">{data.insights.videos_analyzed}</div>
              <div className="text-xs text-gray-400">Videos Analyzed</div>
            </div>
          </div>

          {/* Key Patterns */}
          {data.insights.key_patterns && data.insights.key_patterns.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">📊 Key Patterns</h4>
              <ul className="space-y-2">
                {data.insights.key_patterns.map((pattern, index) => (
                  <li key={index} className="flex items-start space-x-2 text-sm text-gray-300">
                    <span className="text-green-400 mt-0.5">•</span>
                    <span>{pattern}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Top Hooks */}
          {data.insights.top_hooks && data.insights.top_hooks.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">🎯 Top Performing Hooks</h4>
              <div className="space-y-2">
                {data.insights.top_hooks.map((hook, index) => (
                  <div key={index} className="bg-gray-800/50 rounded-lg p-3 text-sm text-gray-300 italic">
                    &quot;{hook}&quot;
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          {data.insights.recommended_format && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-400 mb-1">💡 Recommended Format</h4>
              <p className="text-sm text-gray-300">{data.insights.recommended_format}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

