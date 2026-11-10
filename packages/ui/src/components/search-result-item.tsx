import { type ReactNode } from 'react';
import { cx } from '../lib.js';

export interface SearchResultItemProps {
  title: string;
  path?: string;
  snippet?: ReactNode;
  active?: boolean;
  onSelect?: () => void;
  className?: string;
}

export function SearchResultItem({
  title,
  path,
  snippet,
  active = false,
  onSelect,
  className,
}: SearchResultItemProps) {
  return (
    <button
      type="button"
      className={cx('an-result', active && 'an-result--active', className)}
      aria-current={active ? 'true' : undefined}
      onClick={onSelect}
    >
      <span className="an-result__title">{title}</span>
      {path ? <span className="an-result__path">{path}</span> : null}
      {snippet ? <span className="an-result__snippet">{snippet}</span> : null}
    </button>
  );
}
