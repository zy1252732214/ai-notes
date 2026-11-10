import { type InputHTMLAttributes } from 'react';
import { cx, useDomId } from '../lib.js';
import { Field } from './field.js';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  /** 外面已经有可见标签时，把字段标签只留给读屏。 */
  labelHidden?: boolean;
}

export function Input({
  label,
  hint,
  error,
  labelHidden = false,
  id,
  className,
  ...rest
}: InputProps) {
  const generatedId = useDomId('input');
  const fieldId = id ?? generatedId;

  return (
    <Field
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      labelHidden={labelHidden}
      className={className}
    >
      {({ describedBy, invalid }) => (
        <input
          {...rest}
          id={fieldId}
          className={cx('an-input', invalid && 'an-input--invalid')}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    </Field>
  );
}
