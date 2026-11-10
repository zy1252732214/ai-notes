import { type ReactNode } from 'react';
import { cx } from '../lib.js';

export interface SettingsRowProps {
  label: string;
  description?: string;
  /** 右侧控件的 id，用来把可见标签关联到输入或开关。 */
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
  className,
}: SettingsRowProps) {
  return (
    <div className={cx('an-settings', className)}>
      <div className="an-settings__text">
        {htmlFor ? (
          <label className="an-settings__label" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span className="an-settings__label">{label}</span>
        )}
        {description ? <p className="an-settings__description">{description}</p> : null}
      </div>
      <div className="an-settings__control">{children}</div>
    </div>
  );
}
