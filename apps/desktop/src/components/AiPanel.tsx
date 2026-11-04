import type { Backlink } from '@ai-notes/indexer';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getNoteIndex } from '../search/client';
import { useAppStore } from '../store';

export function AiPanel() {
  const rightOpen = useAppStore((state) => state.rightOpen);
  const activePath = useAppStore((state) => state.activePath);
  const indexRevision = useAppStore((state) => state.indexRevision);
  const openNote = useAppStore((state) => state.openNote);
  const [links, setLinks] = useState<Backlink[]>([]);

  useEffect(() => {
    const index = getNoteIndex();
    if (!index || !activePath) {
      setLinks([]);
      return;
    }
    let cancelled = false;
    void index
      .backlinks(activePath)
      .then((rows) => {
        if (!cancelled) setLinks(rows);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activePath, indexRevision]);

  return (
    <aside className="ai-panel" aria-label="AI 面板" inert={!rightOpen}>
      <div className="ai-head">
        <Sparkles size={16} strokeWidth={1.5} />
        <span>AI 助手</span>
      </div>
      <div className="ai-body">
        <p>这一栏会用来向当前笔记提问。回答会附上可以点开的引用。</p>
        <p className="hint">命令面板可以全文搜索当前笔记库。</p>
        <p>反向链接</p>
        {activePath && links.length > 0 ? (
          <ul className="backlinks">
            {links.map((link) => (
              <li key={`${link.path}:${link.kind}`}>
                <button type="button" onClick={() => void openNote(link.path)}>
                  {link.title || link.path}
                </button>
                <span className="hint">{link.path}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">
            {activePath ? '还没有笔记指向这里。' : '打开一篇笔记后显示反向链接。'}
          </p>
        )}
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
