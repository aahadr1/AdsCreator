'use client';

import type { StrategyCompleteResponse } from '@/types/agentResponse';

type Props = {
  data: StrategyCompleteResponse;
  onProceed: () => void;
};

export default function StrategyWidget({ data, onProceed }: Props) {
  const strategy = data.strategy;

  return (
    <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">Creative Strategy</h3>
            <p className="text-gray-300 text-sm">{data.message}</p>
          </div>
        </div>
      </div>

      {/* Audiences */}
      {strategy.audiences && strategy.audiences.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
            <span>👥</span>
            <span>Target Audiences</span>
          </h4>
          <div className="space-y-3">
            {strategy.audiences.map((audience, index) => (
              <div key={index} className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                <div className="font-medium text-white text-sm">{audience.segment}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-red-400">Pain:</span>
                    <span className="text-gray-300 ml-1">{audience.pain}</span>
                  </div>
                  <div>
                    <span className="text-green-400">Desire:</span>
                    <span className="text-gray-300 ml-1">{audience.desire}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Angles */}
      {strategy.angles && strategy.angles.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
            <span>🎯</span>
            <span>Strategic Angles</span>
          </h4>
          <div className="space-y-3">
            {strategy.angles.map((angle, index) => (
              <div key={index} className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-white text-sm">{angle.name}</div>
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                    {angle.platform}
                  </span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="text-gray-400">
                    <span className="font-medium">Hook:</span> {angle.hook_pattern}
                  </div>
                  <div className="text-gray-400">
                    <span className="font-medium">Format:</span> {angle.format}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Creative Routes */}
      {strategy.creative_routes && strategy.creative_routes.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
            <span>🎬</span>
            <span>Creative Routes</span>
          </h4>
          <div className="space-y-3">
            {strategy.creative_routes.map((route) => (
              <div key={route.route_id} className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-white text-sm">{route.format}</div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                      {route.platform}
                    </span>
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                      {route.variants} variants
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">{route.hypothesis}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Testing Matrix */}
      {strategy.testing_matrix && (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-purple-400">📊 Testing Plan</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{strategy.testing_matrix.total_ads}</div>
              <div className="text-xs text-gray-400">Total Ads</div>
            </div>
            <div className="col-span-2">
              <div className="text-sm font-medium text-white mb-1">Variables</div>
              <div className="flex flex-wrap gap-1 justify-center">
                {strategy.testing_matrix.variables.map((variable) => (
                  <span key={variable} className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                    {variable}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">
            <span className="font-medium">Goal:</span> {strategy.testing_matrix.expected_learnings}
          </p>
        </div>
      )}

      {/* Proceed Button */}
      <button
        onClick={onProceed}
        className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center space-x-2"
      >
        <span>Create Execution Plan</span>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
    </div>
  );
}

