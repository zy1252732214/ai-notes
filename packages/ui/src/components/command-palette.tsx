import { useEffect, useMemo, useRef, useState } from 'react';
import { cx, useDomId } from '../lib.js';
import { Overlay } from './overlay.js';

export interface CommandItem {
  id: string;
  title: string;
  hint?: string;
  keywords?: string;
  disabled?: boolean;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: readonly CommandItem[];
  onSelect: (item: CommandItem) => void;
  label?: string;
  placeholder?: string;
  emptyLabel?: string;
}

function matches(item: CommandItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${item.title} ${item.hint ?? ''} ${item.keywords ?? ''}`.toLowerCase().includes(needle);
}

function firstEnabled(items: readonly CommandItem[]): number {
  const index = items.findIndex((item) => !item.disabled);
  return index >= 0 ? index : 0;
}

export function CommandPalette({
  open,
  onClose,
  items,
  onSelect,
  label = '命令面板',
  placeholder = '搜索笔记或命令',
  emptyLabel = '没有匹配的命令',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useDomId('palette');
  const itemsRef = useRef(items);
  const wasOpen = useRef(false);
  itemsRef.current = items;

  const visible = useMemo(() => items.filter((item) => matches(item, query)), [items, query]);
  const itemKey = items
    .map((item) =>
      [item.id, item.title, item.hint ?? '', item.keywords ?? '', item.disabled ? '1' : '0'].join(
        '\u0000',
      ),
    )
    .join('\n');

  useEffect(() => {
    if (open && !wasOpen.current) {
      setQuery('');
      setActiveIndex(firstEnabled(itemsRef.current));
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    setActiveIndex(firstEnabled(visible));
    // `itemKey` 代表列表内容。调用方每次渲染新建数组时，不把高亮打回第一项。
  }, [query, itemKey]);

  useEffect(() => {
    if (!open) return;
    const item = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    item?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex, visible]);

  const choose = (item: CommandItem | undefined) => {
    if (!item || item.disabled) return;
    onSelect(item);
    onClose();
  };

  const move = (delta: number) => {
    if (visible.length === 0) return;
    setActiveIndex((current) => {
      let index = current;
      for (let step = 0; step < visible.length; step += 1) {
        index = (index + delta + visible.length) % visible.length;
        if (!visible[index]?.disabled) return index;
      }
      return current;
    });
  };

  return (
    <Overlay
      open={open}
      onClose={onClose}
      label={label}
      className="an-palette"
      initialFocusRef={inputRef}
      placement="top"
    >
      <input
        ref={inputRef}
        className="an-palette__input"
        value={query}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          visible[activeIndex] ? `${listId}-option-${visible[activeIndex]?.id}` : undefined
        }
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            move(1);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            move(-1);
          } else if (event.key === 'Home') {
            event.preventDefault();
            const first = visible.findIndex((item) => !item.disabled);
            setActiveIndex(first >= 0 ? first : 0);
          } else if (event.key === 'End') {
            event.preventDefault();
            const last = visible.findLastIndex((item) => !item.disabled);
            setActiveIndex(last >= 0 ? last : 0);
          } else if (event.key === 'Enter') {
            event.preventDefault();
            choose(visible[activeIndex]);
          }
        }}
      />
      <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="an-palette__list">
        {visible.length === 0 ? <li className="an-palette__empty">{emptyLabel}</li> : null}
        {visible.map((item, index) => {
          const active = index === activeIndex;
          return (
            <li key={item.id} role="presentation">
              <button
                type="button"
                id={`${listId}-option-${item.id}`}
                role="option"
                data-active={active ? 'true' : 'false'}
                aria-selected={active}
                disabled={item.disabled}
                className={cx('an-palette__item', active && 'an-palette__item--active')}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(item)}
              >
                <span>{item.title}</span>
                {item.hint ? <span className="an-palette__hint">{item.hint}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </Overlay>
  );
}
