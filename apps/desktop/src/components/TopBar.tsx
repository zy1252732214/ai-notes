import { MessagesSquare, Plus, Search } from 'lucide-react';
import { useState } from 'react';
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
  const setSearchOpen = useAppStore((state) => state.setSearchOpen);
  const setSwitcherOpen = useAppStore((state) => state.setSwitcherOpen);
  const setPluginsOpen = useAppStore((state) => state.setPluginsOpen);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const dueCount = useAppStore((state) => state.dueCount);
  const setReviewOpen = useAppStore((state) => state.setReviewOpen);
  const openNote = useAppStore((state) => state.openNote);
  const closeTab = useAppStore((state) => state.closeTab);
  const openDialog = useAppStore((state) => state.openDialog);
  const resolved = resolveTheme(themeMode);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="tabs" role="tablist" aria-label="已打开的笔记">
        {!leftOpen ? (
          <button
            className="text-cmd"
            aria-label="显示文件树"
            aria-pressed={false}
            onClick={toggleLeft}
          >
            目录
          </button>
        ) : null}
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
                className="text-cmd tab-close"
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
            className="text-cmd"
            aria-label="新建笔记"
            onClick={() => openDialog({ kind: 'create-note' })}
          >
            <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
            新建
          </button>
        ) : null}
      </div>
      <div className="topbar-side topbar-end">
        {vault ? (
          <button
            className="text-cmd"
            aria-label={`开始复习，今日 ${dueCount} 张`}
            onClick={() => setReviewOpen(true)}
          >
            复习
            <span className={dueCount > 0 ? 'review-count' : 'review-count is-idle'}>
              {dueCount}
            </span>
          </button>
        ) : null}
        <button
          className="text-cmd command-trigger"
          title="Ctrl K"
          onClick={() => setCommandOpen(true)}
        >
          <Search size={14} strokeWidth={1.75} aria-hidden="true" />
          搜索
        </button>
        <div className={moreOpen ? 'more-menu is-open' : 'more-menu'}>
          <button
            className="text-cmd"
            aria-expanded={moreOpen}
            aria-controls="sheet-more"
            onClick={() => setMoreOpen((open) => !open)}
          >
            更多
          </button>
          <div id="sheet-more" className="more-menu-panel" hidden={!moreOpen}>
            <button
              className="text-cmd"
              title="Ctrl Shift F"
              aria-label="全文搜索"
              onClick={() => {
                setMoreOpen(false);
                setSearchOpen(true);
              }}
            >
              全文
            </button>
            <button
              className="text-cmd"
              title="Ctrl O"
              aria-label="快速切换"
              onClick={() => {
                setMoreOpen(false);
                setSwitcherOpen(true);
              }}
            >
              跳转
            </button>
            <button
              className="text-cmd"
              aria-label="插件"
              onClick={() => {
                setMoreOpen(false);
                setPluginsOpen(true);
              }}
            >
              插件
            </button>
            <button
              className="text-cmd"
              aria-label="切换主题"
              onClick={() => setThemeMode(resolved === 'dark' ? 'light' : 'dark')}
            >
              {resolved === 'dark' ? '浅色' : '深色'}
            </button>
          </div>
        </div>
        <button
          className={rightOpen ? 'text-cmd is-on' : 'text-cmd'}
          aria-label={rightOpen ? '收起 AI 面板' : '显示 AI 面板'}
          aria-pressed={rightOpen}
          onClick={toggleRight}
        >
          <MessagesSquare size={14} strokeWidth={1.75} aria-hidden="true" />
          问答
        </button>
      </div>
    </header>
  );
}
