'use client';

import React from 'react';
import { 
  Globe, 
  Search, 
  Eye, 
  Image as ImageIcon, 
  Video, 
  Mic, 
  Wand2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

type ToolExecutionCardProps = {
  toolName: string;
  displayMessage?: string;
  status: 'calling' | 'running' | 'complete' | 'error';
  progress?: number;
  params?: Record<string, any>;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
};

const toolIcons: Record<string, React.FC<any>> = {
  website_analyzer: Globe,
  competitor_analyst: Search,
  web_search: Search,
  image: ImageIcon,
  video: Video,
  tts: Mic,
  lipsync: Wand2,
  transcription: Mic,
  background_remove: ImageIcon,
  enhance: Wand2,
};

const toolDisplayNames: Record<string, string> = {
  website_analyzer: 'Website & Brand Analyzer',
  competitor_analyst: 'Competitor Ad Analyst',
  web_search: 'Web Search',
  image: 'Image Generation',
  video: 'Video Generation',
  tts: 'Text-to-Speech',
  lipsync: 'Lip Sync',
  transcription: 'Audio Transcription',
  background_remove: 'Background Removal',
  enhance: 'Image Enhancement',
};

const toolDefaultMessages: Record<string, string> = {
  website_analyzer: '🔍 Analyzing your brand website...',
  competitor_analyst: '🔎 Researching competitor ads...',
  web_search: '🌐 Searching the web...',
  image: '🎨 Generating image...',
  video: '🎬 Generating video...',
  tts: '🎙️ Generating voice...',
  lipsync: '👄 Syncing lips to audio...',
  transcription: '📝 Transcribing audio...',
  background_remove: '✂️ Removing background...',
  enhance: '✨ Enhancing image...',
};

export default function ToolExecutionCard({
  toolName,
  displayMessage,
  status,
  progress,
  params,
  result,
  error,
  startTime,
  endTime,
}: ToolExecutionCardProps) {
  const Icon = toolIcons[toolName] || Wand2;
  const displayName = toolDisplayNames[toolName] || toolName;
  const message = displayMessage || toolDefaultMessages[toolName] || 'Processing...';

  const elapsedTime = startTime && endTime 
    ? `${((endTime - startTime) / 1000).toFixed(1)}s`
    : startTime
    ? `${((Date.now() - startTime) / 1000).toFixed(0)}s`
    : null;

  const statusConfig = {
    calling: {
      icon: <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />,
      bgColor: 'bg-blue-900/30',
      borderColor: 'border-blue-500/30',
      textColor: 'text-blue-200',
      label: 'Initializing',
    },
    running: {
      icon: <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />,
      bgColor: 'bg-cyan-900/30',
      borderColor: 'border-cyan-500/30',
      textColor: 'text-cyan-200',
      label: 'Running',
    },
    complete: {
      icon: <CheckCircle2 className="w-5 h-5 text-green-400" />,
      bgColor: 'bg-green-900/30',
      borderColor: 'border-green-500/30',
      textColor: 'text-green-200',
      label: 'Complete',
    },
    error: {
      icon: <XCircle className="w-5 h-5 text-red-400" />,
      bgColor: 'bg-red-900/30',
      borderColor: 'border-red-500/30',
      textColor: 'text-red-200',
      label: 'Error',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`tool-execution-card rounded-lg border p-4 ${config.bgColor} ${config.borderColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={config.textColor}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm">{displayName}</h4>
            <div className="flex items-center space-x-2 mt-1">
              {config.icon}
              <span className="text-xs text-gray-400">{config.label}</span>
              {elapsedTime && (
                <>
                  <span className="text-xs text-gray-600">•</span>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400">{elapsedTime}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      <p className={`text-sm mb-3 ${config.textColor}`}>
        {message}
      </p>

      {/* Progress bar */}
      {(status === 'calling' || status === 'running') && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Progress</span>
            {progress !== undefined && (
              <span className="text-xs text-gray-400">{progress}%</span>
            )}
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            {progress !== undefined ? (
              <div
                className="bg-cyan-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            ) : (
              <div className="bg-cyan-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
            )}
          </div>
        </div>
      )}

      {/* Parameters (collapsible) */}
      {params && Object.keys(params).length > 0 && (
        <details className="mb-3">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-white transition-colors">
            View parameters
          </summary>
          <div className="mt-2 bg-gray-950 rounded p-3 text-xs">
            <pre className="text-gray-400 overflow-x-auto">
              {JSON.stringify(params, null, 2)}
            </pre>
          </div>
        </details>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-950/50 border border-red-500/30 rounded p-3 text-sm text-red-200">
          <div className="font-semibold mb-1">Error:</div>
          <div>{error}</div>
        </div>
      )}

      {/* Result preview */}
      {result && status === 'complete' && (
        <details className="mt-3" open={false}>
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-white transition-colors">
            View result
          </summary>
          <div className="mt-2 bg-gray-950 rounded p-3 text-xs max-h-48 overflow-y-auto">
            {typeof result === 'string' ? (
              <p className="text-gray-400">{result}</p>
            ) : result.analyses ? (
              // Competitor analyst result
              <div className="space-y-3">
                {result.analyses.map((analysis: any, idx: number) => (
                  <div key={idx} className="border-b border-gray-800 pb-2">
                    <div className="text-white font-medium mb-1">Video {idx + 1}</div>
                    <div className="text-gray-500 text-xs mb-1">{analysis.videoUrl}</div>
                    <div className="text-gray-400">{analysis.analysisSummary}</div>
                  </div>
                ))}
              </div>
            ) : result.analysisSummary ? (
              // Website analyzer result
              <div className="text-gray-400">{result.analysisSummary}</div>
            ) : (
              <pre className="text-gray-400 overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

