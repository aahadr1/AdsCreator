'use client';

import { useState } from 'react';
import { Check, Circle, Square, CheckSquare } from 'lucide-react';
import type { QcmOption } from '@/types/ugc';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type QcmWidgetProps = {
  data: {
    question: string;
    options: QcmOption[];
    allowMultiple: boolean;
    required: boolean;
  };
  onAction: (action: string, data?: any) => void;
};

// -----------------------------------------------------------------------------
// Option Item
// -----------------------------------------------------------------------------

function OptionItem({
  option,
  selected,
  multiple,
  onToggle,
}: {
  option: QcmOption;
  selected: boolean;
  multiple: boolean;
  onToggle: () => void;
}) {
  const Icon = multiple
    ? (selected ? CheckSquare : Square)
    : (selected ? Check : Circle);

  return (
    <button
      className={`qcm-option ${selected ? 'selected' : ''}`}
      onClick={onToggle}
    >
      <span className="qcm-option-icon">
        <Icon size={18} />
      </span>
      <span className="qcm-option-content">
        <span className="qcm-option-label">{option.label}</span>
        {option.description && (
          <span className="qcm-option-description">{option.description}</span>
        )}
      </span>
    </button>
  );
}

// -----------------------------------------------------------------------------
// Main Widget
// -----------------------------------------------------------------------------

export function QcmWidget({ data, onAction }: QcmWidgetProps) {
  const { question, options, allowMultiple, required } = data;
  const [selected, setSelected] = useState<string[]>([]);

  const handleToggle = (optionId: string) => {
    if (allowMultiple) {
      setSelected(prev =>
        prev.includes(optionId)
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      setSelected([optionId]);
      // Auto-submit on single selection
      const option = options.find(o => o.id === optionId);
      if (option) {
        onAction('qcm_response', { selected: [optionId], value: option.value });
      }
    }
  };

  const handleSubmit = () => {
    if (selected.length === 0 && required) return;
    
    const selectedOptions = options.filter(o => selected.includes(o.id));
    const values = selectedOptions.map(o => o.value);
    
    onAction('qcm_response', {
      selected,
      values: allowMultiple ? values : values[0],
    });
  };

  return (
    <div className="widget widget-qcm">
      <div className="qcm-question">
        {question}
      </div>

      <div className="qcm-options">
        {options.map(option => (
          <OptionItem
            key={option.id}
            option={option}
            selected={selected.includes(option.id)}
            multiple={allowMultiple}
            onToggle={() => handleToggle(option.id)}
          />
        ))}
      </div>

      {/* Submit button for multiple selection */}
      {allowMultiple && (
        <div className="qcm-actions">
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={required && selected.length === 0}
          >
            <Check size={16} />
            Confirm Selection
          </button>
        </div>
      )}
    </div>
  );
}

export default QcmWidget;
