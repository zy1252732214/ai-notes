import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SearchResultItem } from '@ai-notes/ui';

export interface LookupEntry {
  id: string;
  title: string;
  path?: string;
  snippet?: ReactNode;
}

interface LookupDialogProps {
  open: boolean;
  label: string;
  placeholder: string;
  emptyLabel: string;
  query: string;
  onQueryChange: (query: string) => void;
  entries: readonly LookupEntry[];
  onSelect: (entry: LookupEntry) => void;
  onClose: () => void;
}

export function LookupDialog({
  open,
  label,
  placeholder,
  emptyLabel,
  query,
  onQueryChange,
  entries,
  onSelect,
  onClose,
}: LookupDialogProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  const signature = entries.map((entry) => entry.id).join('\n');

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query, signature]);

  useEffect(() => {
    if (!open) return;
    const node = document.getElementById(`${listId}-option-${active}`);
    node?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, listId, signature]);

  if (!open || typeof document === 'undefined') return null;

  const choose = (entry: LookupEntry | undefined) => {
    if (!entry) return;
    onSelect(entry);
  };

  const move = (delta: number) => {
    if (entries.length === 0) return;
    setActive((current) => (current + delta + entries.length) % entries.length);
  };

  return createPortal(
    <div className="an-overlay an-overlay--top" onMouseDown={onClose}>
      <div
        className="an-palette lookup-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            move(1);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            move(-1);
          } else if (event.key === 'Enter') {
            event.preventDefault();
            choose(entries[active]);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <input
          ref={inputRef}
          className="an-palette__input"
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <ul id={listId} role="listbox" aria-label={label} className="lookup-results">
          {entries.length === 0 ? <li className="an-palette__empty">{emptyLabel}</li> : null}
          {entries.map((entry, index) => (
            <li key={entry.id} id={`${listId}-option-${index}`} role="presentation">
              <SearchResultItem
                title={entry.title}
                path={entry.path}
                snippet={entry.snippet}
                active={index === active}
                onSelect={() => choose(entry)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
