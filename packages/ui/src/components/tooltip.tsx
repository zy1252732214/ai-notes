import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cx, useDomId } from '../lib.js';

type TooltipChildProps = {
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  'aria-describedby'?: string;
};

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement<TooltipChildProps>;
  side?: 'top' | 'bottom';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const tooltipId = useDomId('tooltip');
  const [open, setOpen] = useState(false);
  const child = Children.only(children);

  if (!isValidElement<TooltipChildProps>(child)) return child;

  const describedBy = [child.props['aria-describedby'], open ? tooltipId : undefined]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return (
    <span
      className="an-tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {cloneElement(child, {
        'aria-describedby': describedBy || undefined,
        onFocus: (event: FocusEvent<HTMLElement>) => {
          child.props.onFocus?.(event);
          setOpen(true);
        },
        onBlur: (event: FocusEvent<HTMLElement>) => {
          child.props.onBlur?.(event);
          setOpen(false);
        },
        onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
          child.props.onKeyDown?.(event);
          if (event.key === 'Escape') setOpen(false);
        },
      })}
      {open ? (
        <span
          role="tooltip"
          id={tooltipId}
          className={cx('an-tooltip__bubble', `an-tooltip__bubble--${side}`)}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
