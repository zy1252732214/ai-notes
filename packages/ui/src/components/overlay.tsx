import { useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib.js';
import { useOverlay } from '../use-overlay.js';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  className: string;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  placement?: 'center' | 'top';
}

export function Overlay({
  open,
  onClose,
  label,
  labelledBy,
  describedBy,
  className,
  children,
  initialFocusRef,
  placement = 'center',
}: OverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useOverlay({ open, onClose, containerRef, initialFocusRef });

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cx('an-overlay', placement === 'top' && 'an-overlay--top')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
