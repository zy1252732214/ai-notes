import { useState, type ReactNode } from 'react';
import { UiIcon } from '../icons.js';
import { cx, useDomId } from '../lib.js';

export interface PanelProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function Panel({
  title,
  children,
  defaultOpen = true,
  open,
  onOpenChange,
  className,
}: PanelProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const expanded = open ?? uncontrolled;
  const bodyId = useDomId('panel');
  const titleId = useDomId('panel-title');

  const setExpanded = (next: boolean) => {
    onOpenChange?.(next);
    if (open === undefined) setUncontrolled(next);
  };

  return (
    <section
      className={cx('an-panel', expanded && 'an-panel--open', className)}
      aria-labelledby={titleId}
    >
      <h3 className="an-panel__heading">
        <button
          type="button"
          className="an-panel__header"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded(!expanded)}
        >
          <UiIcon name="chevron-right" />
          <span id={titleId}>{title}</span>
        </button>
      </h3>
      <div id={bodyId} className="an-panel__body" hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}
