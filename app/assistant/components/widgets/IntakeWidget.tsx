'use client';

import { useState } from 'react';
import {
  Package,
  Users,
  Target,
  Megaphone,
  Tag,
  AlertTriangle,
  Upload,
  ChevronDown,
  Plus,
  X,
} from 'lucide-react';
import type { CreativeBrief, ProductType, BrandTone, PrimaryGoal } from '@/types/ugc';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type IntakeWidgetProps = {
  data: {
    brief: Partial<CreativeBrief>;
    settings?: any;
  };
  onAction: (action: string, data?: any) => void;
};

// -----------------------------------------------------------------------------
// Chip Select
// -----------------------------------------------------------------------------

function ChipSelect({
  options,
  selected,
  onChange,
  multiple = false,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multiple?: boolean;
}) {
  const toggle = (value: string) => {
    if (multiple) {
      if (selected.includes(value)) {
        onChange(selected.filter(v => v !== value));
      } else {
        onChange([...selected, value]);
      }
    } else {
      onChange([value]);
    }
  };

  return (
    <div className="chip-select">
      {options.map(opt => (
        <button
          key={opt.value}
          className={`chip ${selected.includes(opt.value) ? 'active' : ''}`}
          onClick={() => toggle(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Multi-Input (for claims, etc.)
// -----------------------------------------------------------------------------

function MultiInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    if (input.trim() && !values.includes(input.trim())) {
      onChange([...values, input.trim()]);
      setInput('');
    }
  };

  const remove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="multi-input">
      <div className="multi-input-items">
        {values.map((v, i) => (
          <span key={i} className="multi-input-item">
            {v}
            <button onClick={() => remove(i)}><X size={12} /></button>
          </span>
        ))}
      </div>
      <div className="multi-input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
        />
        <button onClick={add} disabled={!input.trim()}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Widget
// -----------------------------------------------------------------------------

export function IntakeWidget({ data, onAction }: IntakeWidgetProps) {
  const [brief, setBrief] = useState<Partial<CreativeBrief>>(data.brief || {});
  const [expanded, setExpanded] = useState<string | null>('basic');

  const updateBrief = (updates: Partial<CreativeBrief>) => {
    setBrief(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = () => {
    onAction('submit_brief', brief);
  };

  const productTypeOptions: { value: ProductType; label: string }[] = [
    { value: 'physical', label: 'Physical Product' },
    { value: 'digital', label: 'Digital Product' },
    { value: 'service', label: 'Service' },
    { value: 'app', label: 'App' },
    { value: 'course', label: 'Course' },
  ];

  const toneOptions: { value: BrandTone; label: string }[] = [
    { value: 'playful', label: '😊 Playful' },
    { value: 'premium', label: '✨ Premium' },
    { value: 'clinical', label: '🔬 Clinical' },
    { value: 'edgy', label: '🔥 Edgy' },
    { value: 'minimal', label: '🎯 Minimal' },
    { value: 'bold', label: '💪 Bold' },
    { value: 'authentic', label: '💯 Authentic' },
  ];

  const goalOptions: { value: PrimaryGoal; label: string }[] = [
    { value: 'sales', label: 'Drive Sales' },
    { value: 'leads', label: 'Generate Leads' },
    { value: 'installs', label: 'App Installs' },
    { value: 'awareness', label: 'Brand Awareness' },
    { value: 'engagement', label: 'Engagement' },
  ];

  const ctaOptions = [
    'Shop now',
    'Learn more',
    'Get started',
    'Try free',
    'Download',
    'Sign up',
    'Book now',
    'Custom...',
  ];

  return (
    <div className="widget widget-intake">
      {/* Basic Info Section */}
      <div className={`intake-section ${expanded === 'basic' ? 'expanded' : ''}`}>
        <button
          className="section-toggle"
          onClick={() => setExpanded(expanded === 'basic' ? null : 'basic')}
        >
          <Package size={16} />
          <span>Product / Service</span>
          <ChevronDown size={14} className={expanded === 'basic' ? 'rotated' : ''} />
        </button>
        {expanded === 'basic' && (
          <div className="section-content">
            <div className="field">
              <label>Product/Service Name *</label>
              <input
                type="text"
                value={brief.productName || ''}
                onChange={e => updateBrief({ productName: e.target.value })}
                placeholder="e.g., SkinGlow Serum"
              />
            </div>

            <div className="field">
              <label>Type</label>
              <ChipSelect
                options={productTypeOptions}
                selected={brief.productType ? [brief.productType] : []}
                onChange={([v]) => updateBrief({ productType: v as ProductType })}
              />
            </div>

            <div className="field">
              <label>Description</label>
              <textarea
                value={brief.productDescription || ''}
                onChange={e => updateBrief({ productDescription: e.target.value })}
                placeholder="What does it do? Key features..."
                rows={3}
              />
            </div>

            <div className="field">
              <label>Landing Page URL</label>
              <input
                type="url"
                value={brief.landingPageUrl || ''}
                onChange={e => updateBrief({ landingPageUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Audience Section */}
      <div className={`intake-section ${expanded === 'audience' ? 'expanded' : ''}`}>
        <button
          className="section-toggle"
          onClick={() => setExpanded(expanded === 'audience' ? null : 'audience')}
        >
          <Users size={16} />
          <span>Target Audience</span>
          <ChevronDown size={14} className={expanded === 'audience' ? 'rotated' : ''} />
        </button>
        {expanded === 'audience' && (
          <div className="section-content">
            <div className="field">
              <label>Target Audience *</label>
              <textarea
                value={brief.targetAudience || ''}
                onChange={e => updateBrief({ targetAudience: e.target.value })}
                placeholder="e.g., Women 25-45 interested in skincare and anti-aging"
                rows={2}
              />
            </div>

            <div className="field">
              <label>Brand Tone</label>
              <ChipSelect
                options={toneOptions}
                selected={brief.brandTone || []}
                onChange={v => updateBrief({ brandTone: v as BrandTone[] })}
                multiple
              />
            </div>
          </div>
        )}
      </div>

      {/* Campaign Section */}
      <div className={`intake-section ${expanded === 'campaign' ? 'expanded' : ''}`}>
        <button
          className="section-toggle"
          onClick={() => setExpanded(expanded === 'campaign' ? null : 'campaign')}
        >
          <Target size={16} />
          <span>Campaign Goals</span>
          <ChevronDown size={14} className={expanded === 'campaign' ? 'rotated' : ''} />
        </button>
        {expanded === 'campaign' && (
          <div className="section-content">
            <div className="field">
              <label>Primary Goal</label>
              <ChipSelect
                options={goalOptions}
                selected={brief.primaryGoal ? [brief.primaryGoal] : []}
                onChange={([v]) => updateBrief({ primaryGoal: v as PrimaryGoal })}
              />
            </div>

            <div className="field">
              <label>Offer (if any)</label>
              <input
                type="text"
                value={brief.offer || ''}
                onChange={e => updateBrief({ offer: e.target.value })}
                placeholder="e.g., 20% off first order"
              />
            </div>

            <div className="field">
              <label>Call to Action</label>
              <select
                value={brief.cta || ''}
                onChange={e => updateBrief({ cta: e.target.value })}
              >
                <option value="">Select CTA...</option>
                {ctaOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {brief.cta === 'Custom...' && (
                <input
                  type="text"
                  value={brief.ctaCustom || ''}
                  onChange={e => updateBrief({ ctaCustom: e.target.value })}
                  placeholder="Enter custom CTA"
                  className="mt-2"
                />
              )}
            </div>

            <div className="field">
              <label>Key Claims</label>
              <MultiInput
                values={brief.keyClaims || []}
                onChange={v => updateBrief({ keyClaims: v })}
                placeholder="Add a claim..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Constraints Section */}
      <div className={`intake-section ${expanded === 'constraints' ? 'expanded' : ''}`}>
        <button
          className="section-toggle"
          onClick={() => setExpanded(expanded === 'constraints' ? null : 'constraints')}
        >
          <AlertTriangle size={16} />
          <span>Constraints (Optional)</span>
          <ChevronDown size={14} className={expanded === 'constraints' ? 'rotated' : ''} />
        </button>
        {expanded === 'constraints' && (
          <div className="section-content">
            <div className="field">
              <label>Must Say</label>
              <MultiInput
                values={brief.mustSay || []}
                onChange={v => updateBrief({ mustSay: v })}
                placeholder="Required phrases..."
              />
            </div>

            <div className="field">
              <label>Must NOT Say</label>
              <MultiInput
                values={brief.mustNotSay || []}
                onChange={v => updateBrief({ mustNotSay: v })}
                placeholder="Forbidden claims..."
              />
            </div>

            <div className="field">
              <label>Disclaimers</label>
              <MultiInput
                values={brief.disclaimers || []}
                onChange={v => updateBrief({ disclaimers: v })}
                placeholder="Required disclaimers..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="intake-actions">
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!brief.productName}
        >
          <Megaphone size={16} />
          Save Brief
        </button>
      </div>
    </div>
  );
}

export default IntakeWidget;
