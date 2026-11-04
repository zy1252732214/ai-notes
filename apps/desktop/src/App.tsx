import { useEffect, useState } from 'react';
import { AiPanel } from './components/AiPanel';
import { CommandPalette } from './components/CommandPalette';
import { EditorPane } from './components/EditorPane';
import { FileTree } from './components/FileTree';
import { NameDialog } from './components/NameDialog';
import { StatusBar } from './components/StatusBar';
import { TopBar } from './components/TopBar';
import { useAppStore } from './store';
import { applyTheme } from './theme';

export function App() {
  const themeMode = useAppStore((state) => state.themeMode);
  const leftOpen = useAppStore((state) => state.leftOpen);
  const rightOpen = useAppStore((state) => state.rightOpen);
  const setLeftOpen = useAppStore((state) => state.setLeftOpen);
  const setRightOpen = useAppStore((state) => state.setRightOpen);
  const narrow = useNarrowScreen();

  useEffect(() => {
    applyTheme(themeMode);
    if (themeMode !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [themeMode]);

  useEffect(() => {
    if (narrow) {
      setLeftOpen(false);
      setRightOpen(false);
    }
  }, [narrow, setLeftOpen, setRightOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      const store = useAppStore.getState();
      if (key === 's') {
        event.preventDefault();
        void store.saveActive();
      } else if (key === 'k') {
        event.preventDefault();
        store.setCommandOpen(!store.commandOpen);
      } else if (event.key === '\\') {
        event.preventDefault();
        store.toggleLeft();
      } else if (key === 'j') {
        event.preventDefault();
        store.toggleRight();
      }
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') void useAppStore.getState().saveActive();
    };
    const onUnload = (event: BeforeUnloadEvent) => {
      const dirty = useAppStore.getState().tabs.some((tab) => tab.dirty);
      if (!dirty) return;
      void useAppStore.getState().saveActive();
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  const workspaceClass = [
    'workspace',
    leftOpen ? 'left-open' : 'left-closed',
    rightOpen ? 'right-open' : 'right-closed',
  ].join(' ');

  return (
    <div className="app">
      <TopBar />
      <div className={workspaceClass}>
        {narrow && (leftOpen || rightOpen) ? (
          <button
            className="backdrop"
            aria-label="关闭侧栏"
            onClick={() => {
              setLeftOpen(false);
              setRightOpen(false);
            }}
          />
        ) : null}
        <FileTree />
        <EditorPane />
        <AiPanel />
      </div>
      <StatusBar />
      <CommandPalette />
      <NameDialog />
    </div>
  );
}

function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const onChange = () => setNarrow(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return narrow;
}
