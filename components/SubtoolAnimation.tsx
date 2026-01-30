'use client';

import { useEffect, useState } from 'react';
import styles from './SubtoolAnimation.module.css';

type SubtoolType = 'video_scenarist' | 'video_director' | 'storyboard_prompt_creator';
type SubtoolStatus = 'idle' | 'running' | 'completed' | 'failed';

interface SubtoolAnimationProps {
  subtool: SubtoolType;
  status: SubtoolStatus;
  progress?: number; // 0-100
  message?: string;
}

const SUBTOOL_CONFIG = {
  video_scenarist: {
    name: 'Video Scenarist',
    color: '#3b82f6', // Blue
    icon: 'script',
    description: 'Crafting scene descriptions...',
    completedMessage: 'Scene descriptions ready',
  },
  video_director: {
    name: 'Video Director',
    color: '#f59e0b', // Amber
    icon: 'director',
    description: 'Adding technical direction...',
    completedMessage: 'Technical direction complete',
  },
  storyboard_prompt_creator: {
    name: 'Storyboard Prompt Creator',
    color: '#10b981', // Green
    icon: 'image',
    description: 'Creating frame prompts...',
    completedMessage: 'Frame prompts ready',
  },
};

export function SubtoolAnimation({ subtool, status, progress = 0, message }: SubtoolAnimationProps) {
  const [animationPhase, setAnimationPhase] = useState(0);
  const config = SUBTOOL_CONFIG[subtool];
  
  useEffect(() => {
    if (status === 'running') {
      const interval = setInterval(() => {
        setAnimationPhase(prev => (prev + 1) % 3);
      }, 800);
      return () => clearInterval(interval);
    }
  }, [status]);
  
  if (status === 'idle') return null;
  
  return (
    <div className={styles.subtoolAnimation}>
      <div 
        className={styles.iconWrapper}
        style={{ borderColor: config.color }}
      >
        <SubtoolIcon 
          icon={config.icon} 
          color={config.color}
          isAnimating={status === 'running'}
          animationPhase={animationPhase}
        />
        
        {status === 'running' && (
          <div 
            className={styles.pulseRing}
            style={{ borderColor: config.color }}
          />
        )}
        
        {status === 'completed' && (
          <div className={styles.checkmark} style={{ backgroundColor: config.color }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path 
                d="M3 8L6 11L13 4" 
                stroke="white" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            </svg>
          </div>
        )}
        
        {status === 'failed' && (
          <div className={styles.errorMark} style={{ backgroundColor: '#ef4444' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path 
                d="M4 4L12 12M12 4L4 12" 
                stroke="white" 
                strokeWidth="2" 
                strokeLinecap="round" 
              />
            </svg>
          </div>
        )}
      </div>
      
      <div className={styles.info}>
        <h4 style={{ color: config.color }}>{config.name}</h4>
        <p className={styles.description}>
          {message || 
           (status === 'completed' ? config.completedMessage : config.description)}
        </p>
        
        {status === 'running' && progress > 0 && (
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ 
                width: `${progress}%`,
                backgroundColor: config.color 
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface SubtoolIconProps {
  icon: string;
  color: string;
  isAnimating: boolean;
  animationPhase: number;
}

function SubtoolIcon({ icon, color, isAnimating, animationPhase }: SubtoolIconProps) {
  const baseStyle = { 
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  
  if (icon === 'script') {
    return (
      <svg 
        width="32" 
        height="32" 
        viewBox="0 0 32 32" 
        fill="none"
        className={isAnimating ? styles.iconAnimating : ''}
      >
        <rect x="6" y="4" width="20" height="24" rx="2" {...baseStyle} />
        <line 
          x1="10" 
          y1="10" 
          x2={isAnimating ? (10 + animationPhase * 6) : 22} 
          y2="10" 
          {...baseStyle} 
        />
        <line 
          x1="10" 
          y1="15" 
          x2={isAnimating ? (10 + ((animationPhase + 1) % 3) * 6) : 22} 
          y2="15" 
          {...baseStyle} 
        />
        <line 
          x1="10" 
          y1="20" 
          x2={isAnimating ? (10 + ((animationPhase + 2) % 3) * 5) : 18} 
          y2="20" 
          {...baseStyle} 
        />
      </svg>
    );
  }
  
  if (icon === 'director') {
    return (
      <svg 
        width="32" 
        height="32" 
        viewBox="0 0 32 32" 
        fill="none"
        className={isAnimating ? styles.iconAnimating : ''}
      >
        <rect x="4" y="8" width="24" height="16" rx="2" {...baseStyle} />
        <circle 
          cx="16" 
          cy="16" 
          r={isAnimating ? (4 + animationPhase) : 4} 
          {...baseStyle} 
        />
        <path d="M4 8L8 4L24 4L28 8" {...baseStyle} />
      </svg>
    );
  }
  
  if (icon === 'image') {
    return (
      <svg 
        width="32" 
        height="32" 
        viewBox="0 0 32 32" 
        fill="none"
        className={isAnimating ? styles.iconAnimating : ''}
      >
        <rect x="4" y="4" width="24" height="24" rx="2" {...baseStyle} />
        <circle cx="12" cy="12" r="3" fill={color} />
        <path 
          d={`M4 ${isAnimating ? (24 - animationPhase * 2) : 24}L12 16L16 20L24 12L28 16V26C28 27.1 27.1 28 26 28H6C4.9 28 4 27.1 4 26V${isAnimating ? (24 - animationPhase * 2) : 24}Z`}
          fill={color} 
          opacity="0.3" 
        />
      </svg>
    );
  }
  
  return null;
}

interface SubtoolProgressProps {
  subtools: {
    scenarist: SubtoolStatus;
    director: SubtoolStatus;
    promptCreator: SubtoolStatus;
  };
  currentSubtool?: SubtoolType;
  progress?: number;
}

/**
 * Shows progress through all 3 subtools
 */
export function SubtoolProgress({ subtools, currentSubtool, progress }: SubtoolProgressProps) {
  return (
    <div className={styles.subtoolProgress}>
      <SubtoolAnimation
        subtool="video_scenarist"
        status={subtools.scenarist}
        progress={currentSubtool === 'video_scenarist' ? progress : undefined}
      />
      
      <div className={styles.arrow}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path 
            d="M5 12H19M19 12L12 5M19 12L12 19" 
            stroke="#9ca3af" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
        </svg>
      </div>
      
      <SubtoolAnimation
        subtool="video_director"
        status={subtools.director}
        progress={currentSubtool === 'video_director' ? progress : undefined}
      />
      
      <div className={styles.arrow}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path 
            d="M5 12H19M19 12L12 5M19 12L12 19" 
            stroke="#9ca3af" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
        </svg>
      </div>
      
      <SubtoolAnimation
        subtool="storyboard_prompt_creator"
        status={subtools.promptCreator}
        progress={currentSubtool === 'storyboard_prompt_creator' ? progress : undefined}
      />
    </div>
  );
}
