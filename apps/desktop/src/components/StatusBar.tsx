import { countVisibleCharacters } from '@ai-notes/core';
import { saveStatusLabel } from '../notices';
import { useAppStore } from '../store';

export function StatusBar() {
  const tabs = useAppStore((state) => state.tabs);
  const activePath = useAppStore((state) => state.activePath);
  const saveError = useAppStore((state) => state.saveError);
  const cursor = useAppStore((state) => state.cursor);
  const active = tabs.find((tab) => tab.path === activePath) ?? null;
  const count = active ? countVisibleCharacters(active.content) : 0;
  const label = saveStatusLabel({
    hasNote: active !== null,
    dirty: active?.dirty ?? false,
    saveError,
  });
  const tone = saveError ? 'danger' : active?.dirty ? 'warning' : active ? 'success' : '';

  return (
    <footer className="statusbar">
      <span className={tone} title={saveError ?? undefined}>
        {saveError ? `${label}：${saveError}` : label}
      </span>
      <span className="status-path">{activePath ?? ''}</span>
      <span className="status-meta">
        {active ? <span>{count} 字</span> : null}
        {active ? (
          <span>
            {cursor.line}:{cursor.column}
          </span>
        ) : null}
      </span>
    </footer>
  );
}
