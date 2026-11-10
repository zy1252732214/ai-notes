import { IconButton, Tabs } from '@ai-notes/ui';
import { Settings, Sparkles } from 'lucide-react';
import { useAppStore } from '../store';
import { AskPane } from './AskPane';
import { LinksPane } from './LinksPane';

export function AiPanel() {
  const rightOpen = useAppStore((state) => state.rightOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);

  return (
    <aside className="ai-panel" aria-label="AI 面板" inert={!rightOpen}>
      <div className="ai-head">
        <Sparkles size={16} strokeWidth={1.5} />
        <span>AI 助手</span>
        <span className="ai-head-spacer" />
        <IconButton label="模型设置" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings size={16} strokeWidth={1.5} />
        </IconButton>
      </div>
      <Tabs
        label="右侧面板"
        keepMounted
        tabs={[
          { id: 'ask', label: '问答', content: <AskPane /> },
          { id: 'links', label: '链接', content: <LinksPane /> },
        ]}
      />
    </aside>
  );
}
