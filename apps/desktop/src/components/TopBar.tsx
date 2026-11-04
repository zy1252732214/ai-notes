import { Moon, PanelLeft, PanelRight, Search, Sun } from 'lucide-react';
import { noteTitle, useAppStore } from '../store';
import { resolveTheme } from '../theme';

export function TopBar() {
  const vault = useAppStore((state) => state.vault);
  const tabs = useAppStore((state) => state.tabs);
  const activePath = useAppStore((state) => state.activePath);
  const leftOpen = useAppStore((state) => state.leftOpen);
  const rightOpen = useAppStore((state) => state.rightOpen);
  const themeMode = useAppStore((state) => state.themeMode);
  const toggleLeft = useAppStore((state) => state.toggleLeft);
  const toggleRight = useAppStore((state) => state.toggleRight);
  const setCommandOpen = useAppStore((state) => state.setCommandOpen);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const openNote = useAppStore((state) => state.openNote);
  const closeTab = useAppStore((state) => state.closeTab);
  const openDialog = useAppStore((state) => state.openDialog);
  const resolved = resolveTheme(themeMode);

  return (
    <header className="topbar">
      <div className="topbar-side">
        <button
          className="icon-button"
          aria-label={leftOpen ? '收起文件树' : '显示文件树'}
          aria-pressed={leftOpen}
          onClick={toggleLeft}
        >
          <PanelLeft size={16} strokeWidth={1.5} />
        </button>
        <span className="vault-name">{vault?.name ?? 'ai-notes'}</span>
      </div>
      <div className="tabs" role="tablist" aria-label="已打开的笔记">
        {tabs.map((tab) => {
          const active = tab.path === activePath;
          return (
            <div key={tab.path} className={active ? 'tab active' : 'tab'} role="presentation">
              <button
                className="tab-label"
                role="tab"
                aria-selected={active}
                onClick={() => void openNote(tab.path)}
              >
                {tab.dirty ? <span className="dirty-dot" aria-hidden="true" /> : null}
                {noteTitle(tab.path)}
              </button>
              <button
                className="tab-close"
                aria-label={`关闭${noteTitle(tab.path)}`}
                onClick={() => void closeTab(tab.path)}
              >
                ×
              </button>
            </div>
          );
        })}
        {vault ? (
          <button
            className="tab-add"
            aria-label="新建笔记"
            onClick={() => openDialog({ kind: 'create-note' })}
          >
            +
          </button>
        ) : null}
      </div>
      <div className="topbar-side topbar-end">
        <button className="command-button" onClick={() => setCommandOpen(true)}>
          <Search size={16} strokeWidth={1.5} />
          <span>搜索或跳转</span>
          <kbd>Ctrl K</kbd>
        </button>
        <button
          className="icon-button"
          aria-label="切换主题"
          onClick={() => setThemeMode(resolved === 'dark' ? 'light' : 'dark')}
        >
          {resolved === 'dark' ? (
            <Sun size={16} strokeWidth={1.5} />
          ) : (
            <Moon size={16} strokeWidth={1.5} />
          )}
        </button>
        <button
          className="icon-button"
          aria-label={rightOpen ? '收起 AI 面板' : '显示 AI 面板'}
          aria-pressed={rightOpen}
          onClick={toggleRight}
        >
          <PanelRight size={16} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
