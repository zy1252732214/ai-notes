import { countVisibleCharacters } from '@ai-notes/core';
import { useAppStore } from '../store';

export function StatusBar() {
  const tabs = useAppStore((state) => state.tabs);
  const activePath = useAppStore((state) => state.activePath);
  const saveError = useAppStore((state) => state.saveError);
  const cursor = useAppStore((state) => state.cursor);
  const active = tabs.find((tab) => tab.path === activePath) ?? null;
  const count = active ? countVisibleCharacters(active.content) : 0;
  const label = !active
    ? '未打开笔记'
    : saveError
      ? '保存失败'
      : active.dirty
        ? '未保存'
        : '已保存';
  const tone = saveError ? 'danger' : active?.dirty ? 'warning' : active ? 'success' : '';

  return (
    <footer className="statusbar">
      <span className={tone} title={saveError ?? undefined}>
        {saveError ? `${label}：${saveError}` : label}
      </span>
      <span className="status-path">{activePath ?? ''}</span>
      <span>
        {active ? `${count} 字` : ''}
        {active ? ` · ${cursor.line}:${cursor.column}` : ''}
      </span>
    </footer>
  );
}
