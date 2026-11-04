import { type ButtonHTMLAttributes } from 'react';
import { cx } from '../lib.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cx(
        'an-button',
        `an-button--${variant}`,
        size === 'sm' && 'an-button--sm',
        className,
      )}
    >
      {children}
    </button>
  );
}
