import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib.js';

export type IconButtonVariant = 'default' | 'danger';
export type IconButtonSize = 'md' | 'sm';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 读屏名称。图标按钮没有可见文字，所以必填。 */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** 传入布尔值时变成切换按钮，并设置 `aria-pressed`。 */
  pressed?: boolean;
  children?: ReactNode;
}

export function IconButton({
  label,
  variant = 'default',
  size = 'md',
  pressed,
  className,
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      className={cx(
        'an-icon-button',
        variant === 'danger' && 'an-icon-button--danger',
        size === 'sm' && 'an-icon-button--sm',
        className,
      )}
    >
      {children}
    </button>
  );
}
