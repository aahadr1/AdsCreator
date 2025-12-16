'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type Command = {
  label: string;
  href: string;
  description?: string;
  shortcut?: string;
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  commands: Command[];
};

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return commands;
    }
    const lower = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lower) ||
        (cmd.description ? cmd.description.toLowerCase().includes(lower) : false)
    );
  }, [commands, query]);

  const onSelect = (command: Command) => {
    onClose();
    router.push(command.href);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="command-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="command-panel" onClick={(event) => event.stopPropagation()}>
        <div className="command-search">
          <input
            ref={inputRef}
            type="search"
            placeholder="Search tools, tasks, and settings..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="command-hint">ESC</span>
        </div>
        <div className="command-results" role="listbox">
          {filtered.length === 0 && (
            <div className="command-empty">No matches. Try another search term.</div>
          )}
          {filtered.map((command) => (
            <button
              key={command.href}
              type="button"
              className="command-item"
              onClick={() => onSelect(command)}
            >
              <div className="command-item-text">
                <span className="command-item-label">{command.label}</span>
                {command.description && (
                  <span className="command-item-description">{command.description}</span>
                )}
              </div>
              {command.shortcut && <span className="command-item-shortcut">{command.shortcut}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
