import { type ButtonHTMLAttributes } from 'react';
import { cx, useDomId } from '../lib.js';

export interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'role'
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  /** 外面已经有可见标签时，把这段文字只留给读屏。 */
  labelHidden?: boolean;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  labelHidden = false,
  disabled = false,
  id,
  className,
  ...rest
}: SwitchProps) {
  const generatedId = useDomId('switch');
  const switchId = id ?? generatedId;
  const labelId = `${switchId}-label`;
  const descriptionId = description ? `${switchId}-description` : undefined;

  return (
    <div className={cx('an-switch', checked && 'an-switch--checked', className)}>
      <button
        {...rest}
        type="button"
        id={switchId}
        role="switch"
        className="an-switch__control"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="an-switch__track" aria-hidden="true">
          <span className="an-switch__thumb" />
        </span>
      </button>
      <span
        className={cx('an-switch__text', labelHidden && 'an-sr-only')}
        onClick={() => {
          if (!disabled) onChange(!checked);
        }}
      >
        <span id={labelId} className="an-switch__label">
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="an-switch__description">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
}
