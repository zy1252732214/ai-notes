import { type ReactNode } from 'react';
import { cx } from '../lib.js';

export interface FieldControlProps {
  id: string;
  describedBy?: string;
  invalid: boolean;
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  labelHidden?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

export function Field({
  id,
  label,
  hint,
  error,
  labelHidden = false,
  className,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [errorId, hintId].filter((value): value is string => Boolean(value)).join(' ') || undefined;

  return (
    <div className={cx('an-field', error && 'an-field--error', className)}>
      <label
        id={`${id}-label`}
        className={cx('an-field__label', labelHidden && 'an-sr-only')}
        htmlFor={id}
      >
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} className="an-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="an-field__hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
