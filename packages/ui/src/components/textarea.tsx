import { type TextareaHTMLAttributes } from 'react';
import { cx, useDomId } from '../lib.js';
import { Field } from './field.js';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
  /** 外面已经有可见标签时，把字段标签只留给读屏。 */
  labelHidden?: boolean;
}

export function Textarea({
  label,
  hint,
  error,
  labelHidden = false,
  id,
  className,
  rows = 4,
  ...rest
}: TextareaProps) {
  const generatedId = useDomId('textarea');
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
        <textarea
          {...rest}
          id={fieldId}
          rows={rows}
          className={cx('an-textarea', invalid && 'an-textarea--invalid')}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    </Field>
  );
}
