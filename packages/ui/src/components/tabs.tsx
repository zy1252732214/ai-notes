import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../lib.js';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  /** 读屏用来称呼这一组标签，例如「设置分区」。 */
  label: string;
  tabs: readonly TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** 保留未选中面板的 DOM，避免切走时丢掉内部状态。 */
  keepMounted?: boolean;
  className?: string;
}

function enabledTabs<T extends { disabled?: boolean }>(tabs: readonly T[]): T[] {
  return tabs.filter((tab) => !tab.disabled);
}

export function nextTabId(
  tabs: readonly { id: string; disabled?: boolean }[],
  currentId: string,
  key: string,
): string | null {
  const enabled = enabledTabs(tabs);
  if (enabled.length === 0) return null;
  if (key === 'Home') return enabled[0]?.id ?? null;
  if (key === 'End') return enabled[enabled.length - 1]?.id ?? null;
  const delta =
    key === 'ArrowRight' || key === 'ArrowDown'
      ? 1
      : key === 'ArrowLeft' || key === 'ArrowUp'
        ? -1
        : 0;
  if (delta === 0) return null;
  const index = enabled.findIndex((tab) => tab.id === currentId);
  const start = index === -1 ? 0 : index;
  const next = enabled[(start + delta + enabled.length) % enabled.length];
  return next?.id ?? null;
}

export function Tabs({
  label,
  tabs,
  value,
  defaultValue,
  onChange,
  keepMounted = false,
  className,
}: TabsProps) {
  const baseId = useId().replace(/:/g, '');
  const first = enabledTabs(tabs)[0]?.id ?? tabs[0]?.id ?? '';
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? first);
  const selected = value ?? uncontrolled;
  const active = tabs.find((tab) => tab.id === selected) ?? tabs[0];

  const select = (id: string) => {
    const tab = tabs.find((item) => item.id === id);
    if (!tab || tab.disabled) return;
    onChange?.(id);
    if (value === undefined) setUncontrolled(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = nextTabId(tabs, selected, event.key);
    if (!next || next === selected) return;
    event.preventDefault();
    select(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  };

  return (
    <div className={cx('an-tabs', className)}>
      <div role="tablist" aria-label={label} className="an-tabs__list" onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const isSelected = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              className={cx('an-tabs__tab', isSelected && 'an-tabs__tab--active')}
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => select(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {(keepMounted ? tabs : active ? [active] : []).map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          tabIndex={0}
          hidden={keepMounted && tab.id !== active?.id ? true : undefined}
          className="an-tabs__panel"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
