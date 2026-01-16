'use client';

import { useState } from 'react';
import {
  Film,
  Clock,
  Globe,
  Eye,
  Play,
  Download,
  Settings,
  ChevronDown,
} from 'lucide-react';
import type { ProjectSettings, ProjectCapabilities, AspectRatio, TargetDuration, Language } from '@/types/ugc';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type TopBarProps = {
  settings: ProjectSettings;
  capabilities: ProjectCapabilities;
  onSettingsChange: (updates: Partial<ProjectSettings>) => void;
  onPreview?: () => void;
  onExport?: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
};

// -----------------------------------------------------------------------------
// Dropdown Component
// -----------------------------------------------------------------------------

function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  icon: Icon,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  icon?: any;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <div className="topbar-dropdown" onBlur={() => setTimeout(() => setOpen(false), 150)}>
      <button
        className="topbar-dropdown-trigger"
        onClick={() => setOpen(!open)}
        title={label}
      >
        {Icon && <Icon size={14} />}
        <span>{selected?.label || String(value)}</span>
        <ChevronDown size={12} className={`dropdown-arrow ${open ? 'open' : ''}`} />
      </button>
      {open && (
        <div className="topbar-dropdown-menu">
          {options.map(opt => (
            <button
              key={String(opt.value)}
              className={`dropdown-item ${opt.value === value ? 'active' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// TopBar Component
// -----------------------------------------------------------------------------

export function TopBar({
  settings,
  capabilities,
  onSettingsChange,
  onPreview,
  onExport,
  primaryAction,
}: TopBarProps) {
  const aspectOptions: { value: AspectRatio; label: string }[] = [
    { value: '9:16', label: '9:16 (TikTok/Reels)' },
    { value: '1:1', label: '1:1 (Square)' },
    { value: '16:9', label: '16:9 (YouTube)' },
  ];

  const durationOptions: { value: TargetDuration; label: string }[] = [
    { value: 15, label: '15s' },
    { value: 30, label: '30s' },
    { value: 45, label: '45s' },
    { value: 60, label: '60s' },
  ];

  const languageOptions: { value: Language; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Français' },
    { value: 'es', label: 'Español' },
    { value: 'de', label: 'Deutsch' },
    { value: 'pt', label: 'Português' },
    { value: 'it', label: 'Italiano' },
    { value: 'nl', label: 'Nederlands' },
    { value: 'ar', label: 'العربية' },
    { value: 'zh', label: '中文' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
  ];

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-logo">
          <Film size={20} />
          <span>UGC Creator</span>
        </div>
      </div>

      <div className="topbar-center">
        <Dropdown
          value={settings.aspectRatio}
          options={aspectOptions}
          onChange={(v) => onSettingsChange({ aspectRatio: v })}
          icon={Film}
          label="Aspect Ratio"
        />

        <Dropdown
          value={settings.targetDuration}
          options={durationOptions}
          onChange={(v) => onSettingsChange({ targetDuration: v })}
          icon={Clock}
          label="Duration"
        />

        <Dropdown
          value={settings.language}
          options={languageOptions}
          onChange={(v) => onSettingsChange({ language: v })}
          icon={Globe}
          label="Language"
        />
      </div>

      <div className="topbar-right">
        {onPreview && capabilities.hasStoryboard && (
          <button className="topbar-btn topbar-btn-secondary" onClick={onPreview}>
            <Eye size={16} />
            Preview
          </button>
        )}

        {onExport && capabilities.hasFinalExport && (
          <button className="topbar-btn topbar-btn-secondary" onClick={onExport}>
            <Download size={16} />
            Export
          </button>
        )}

        {primaryAction && (
          <button
            className="topbar-btn topbar-btn-primary"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
          >
            <Play size={16} />
            {primaryAction.label}
          </button>
        )}
      </div>
    </header>
  );
}

export default TopBar;
