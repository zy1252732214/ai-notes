import type { Backlink } from '@ai-notes/indexer';
import { IFRAME_SANDBOX } from '@ai-notes/plugin-host';
import { Sparkles } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { pluginController } from '../plugins/controller';
import { getNoteIndex } from '../search/client';
import { useAppStore } from '../store';

export function AiPanel() {
  const rightOpen = useAppStore((state) => state.rightOpen);
  const activePath = useAppStore((state) => state.activePath);
  const indexRevision = useAppStore((state) => state.indexRevision);
  const openNote = useAppStore((state) => state.openNote);
  const snapshot = useSyncExternalStore(pluginController.subscribe, pluginController.getSnapshot);
  const panels = snapshot.items.flatMap((item) =>
    item.panels.map((panel) => ({ ...panel, pluginName: item.name })),
  );
  const frames = snapshot.items.filter((item) => item.srcdoc);
  const [tab, setTab] = useState('ai');
  const [links, setLinks] = useState<Backlink[]>([]);
  const active = tab === 'ai' || panels.some((panel) => panel.id === tab) ? tab : 'ai';

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
      <div className="ai-head ai-tabs" role="tablist" aria-label="右侧面板">
        <button
          className={active === 'ai' ? 'ai-tab active' : 'ai-tab'}
          role="tab"
          aria-selected={active === 'ai'}
          onClick={() => setTab('ai')}
        >
          <Sparkles size={16} strokeWidth={1.5} />
          <span>AI 助手</span>
        </button>
        {panels.map((panel) => (
          <button
            key={`${panel.pluginId}:${panel.id}`}
            className={active === panel.id ? 'ai-tab active' : 'ai-tab'}
            role="tab"
            aria-selected={active === panel.id}
            onClick={() => setTab(panel.id)}
          >
            {panel.title}
          </button>
        ))}
      </div>
      {active === 'ai' ? (
        <>
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
        </>
      ) : (
        <div className="ai-body">
          <p>{panels.find((panel) => panel.id === active)?.pluginName}</p>
        </div>
      )}
      <div className={active === 'ai' ? 'plugin-stage parked' : 'plugin-stage'}>
        {frames.map((item) => (
          <iframe
            key={item.id}
            className={
              panels.some((panel) => panel.pluginId === item.id && panel.id === active)
                ? 'plugin-frame'
                : 'plugin-frame is-hidden'
            }
            sandbox={IFRAME_SANDBOX}
            srcDoc={item.srcdoc ?? ''}
            title={item.name}
            data-plugin-id={item.id}
            ref={(node) => {
              pluginController.setPoster(
                item.id,
                node?.contentWindow
                  ? (message) => node.contentWindow?.postMessage(message, '*')
                  : null,
              );
            }}
          />
        ))}
      </div>
    </aside>
  );
}
