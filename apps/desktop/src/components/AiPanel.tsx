import { Sparkles } from 'lucide-react';
import { useAppStore } from '../store';

export function AiPanel() {
  const rightOpen = useAppStore((state) => state.rightOpen);

  return (
    <aside className="ai-panel" aria-label="AI 面板" inert={!rightOpen}>
      <div className="ai-head">
        <Sparkles size={16} strokeWidth={1.5} />
        <span>AI 助手</span>
      </div>
      <div className="ai-body">
        <p>这一栏会用来向当前笔记提问。回答会附上可以点开的引用。</p>
        <p className="hint">模型、记忆和检索还没有接入。</p>
      </div>
      <form
        className="ai-composer"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <textarea placeholder="向这篇笔记提问" disabled rows={3} />
        <button className="button" type="submit" disabled>
          发送
        </button>
      </form>
    </aside>
  );
}
