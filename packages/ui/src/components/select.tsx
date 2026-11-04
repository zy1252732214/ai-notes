import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { UiIcon } from '../icons.js';
import { cx, useDomId } from '../lib.js';
import { Field } from './field.js';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  error?: string;
  /** 外面已经有可见标签时，把字段标签只留给读屏。 */
  labelHidden?: boolean;
  id?: string;
  name?: string;
  className?: string;
}

function enabledIndexes(options: readonly SelectOption[]): number[] {
  const indexes: number[] = [];
  options.forEach((option, index) => {
    if (!option.disabled) indexes.push(index);
  });
  return indexes;
}

function moveIndex(options: readonly SelectOption[], current: number, delta: number): number {
  const indexes = enabledIndexes(options);
  if (indexes.length === 0) return current;
  const position = indexes.indexOf(current);
  const start = position === -1 ? (delta > 0 ? -1 : 0) : position;
  const next = indexes[(start + delta + indexes.length) % indexes.length];
  return next ?? current;
}

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = '请选择',
  disabled = false,
  hint,
  error,
  labelHidden = false,
  id,
  name,
  className,
}: SelectProps) {
  const generatedId = useDomId('select');
  const fieldId = id ?? generatedId;
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        const initial = selectedIndex >= 0 ? selectedIndex : (enabledIndexes(options)[0] ?? 0);
        setActiveIndex(initial);
        setOpen(true);
        return;
      }
      setActiveIndex((current) => moveIndex(options, current, event.key === 'ArrowDown' ? 1 : -1));
      return;
    }
    if (event.key === 'Home' && open) {
      event.preventDefault();
      const first = enabledIndexes(options)[0];
      if (first !== undefined) setActiveIndex(first);
      return;
    }
    if (event.key === 'End' && open) {
      event.preventDefault();
      const indexes = enabledIndexes(options);
      const last = indexes[indexes.length - 1];
      if (last !== undefined) setActiveIndex(last);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        const initial = selectedIndex >= 0 ? selectedIndex : (enabledIndexes(options)[0] ?? 0);
        setActiveIndex(initial);
        setOpen(true);
        return;
      }
      choose(activeIndex);
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'Tab') setOpen(false);
  };

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
        <div ref={rootRef} className={cx('an-select', open && 'an-select--open')}>
          {name ? <input type="hidden" name={name} value={value} /> : null}
          <button
            type="button"
            id={fieldId}
            className={cx('an-select__trigger', invalid && 'an-select__trigger--invalid')}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-labelledby={`${fieldId}-label ${fieldId}-value`}
            aria-activedescendant={open ? `${fieldId}-option-${activeIndex}` : undefined}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onClick={() => {
              if (disabled) return;
              setOpen((current) => {
                const next = !current;
                if (next) {
                  const initial =
                    selectedIndex >= 0 ? selectedIndex : (enabledIndexes(options)[0] ?? 0);
                  setActiveIndex(initial);
                }
                return next;
              });
            }}
            onKeyDown={onKeyDown}
          >
            <span
              id={`${fieldId}-value`}
              className={cx('an-select__value', !selected && 'an-select__value--placeholder')}
            >
              {selected?.label ?? placeholder}
            </span>
            <UiIcon name="chevron-right" />
          </button>
          {open ? (
            <ul id={listId} role="listbox" aria-labelledby={fieldId} className="an-select__menu">
              {options.map((option, index) => {
                const optionId = `${fieldId}-option-${index}`;
                const active = index === activeIndex;
                return (
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      id={optionId}
                      role="option"
                      aria-selected={option.value === value}
                      aria-disabled={option.disabled || undefined}
                      disabled={option.disabled}
                      className={cx('an-select__option', active && 'an-select__option--active')}
                      onMouseEnter={() => {
                        if (!option.disabled) setActiveIndex(index);
                      }}
                      onClick={() => choose(index)}
                    >
                      <span>{option.label}</span>
                      {option.value === value ? <UiIcon name="check" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </Field>
  );
}
