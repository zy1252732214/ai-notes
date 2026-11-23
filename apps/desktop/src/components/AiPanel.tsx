import { IFRAME_SANDBOX } from '@ai-notes/plugin-host';
import { useState, useSyncExternalStore } from 'react';
import { pluginController } from '../plugins/controller';
import { useAppStore } from '../store';
import { AskPane, retrievalLabel } from './AskPane';
import { LinksPane } from './LinksPane';

export function AiPanel() {
  const rightOpen = useAppStore((state) => state.rightOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const snapshot = useSyncExternalStore(pluginController.subscribe, pluginController.getSnapshot);
  const panels = snapshot.items.flatMap((item) =>
    item.panels.map((panel) => ({ ...panel, pluginName: item.name })),
  );
  const frames = snapshot.items.filter((item) => item.srcdoc);
  const [tab, setTab] = useState('ask');
  const active =
    tab === 'ask' || tab === 'links' || panels.some((panel) => panel.id === tab) ? tab : 'ask';
  const pluginPanel = panels.find((panel) => panel.id === active) ?? null;

  return (
    <aside className="ai-panel" aria-label="AI 面板" inert={!rightOpen}>
      <div className="ai-head">
        <div className="ai-tabs" role="tablist" aria-label="右侧面板">
          <button
            type="button"
            className={active === 'ask' ? 'ai-tab active is-current' : 'ai-tab'}
            role="tab"
            id="right-tab-ask"
            aria-label="问答"
            aria-selected={active === 'ask'}
            aria-controls="right-panel-ask"
            onClick={() => setTab('ask')}
          >
            问答
          </button>
          <button
            type="button"
            className={active === 'links' ? 'ai-tab active' : 'ai-tab'}
            role="tab"
            id="right-tab-links"
            aria-selected={active === 'links'}
            aria-controls="right-panel-links"
            onClick={() => setTab('links')}
          >
            链接
          </button>
          {panels.map((panel) => (
            <button
              key={`${panel.pluginId}:${panel.id}`}
              type="button"
              className={active === panel.id ? 'ai-tab active' : 'ai-tab'}
              role="tab"
              aria-selected={active === panel.id}
              onClick={() => setTab(panel.id)}
            >
              {panel.title}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="text-cmd"
          aria-label="设置"
          onClick={() => setSettingsOpen(true)}
        >
          设置
        </button>
        {active === 'ask' ? <p className="ai-status-line">{retrievalLabel()}</p> : null}
      </div>
      <div className="ai-panel-body" hidden={pluginPanel !== null}>
        <div
          role="tabpanel"
          id="right-panel-ask"
          aria-labelledby="right-tab-ask"
          className="an-tabs__panel"
          hidden={active !== 'ask'}
        >
          <AskPane />
        </div>
        <div
          role="tabpanel"
          id="right-panel-links"
          aria-labelledby="right-tab-links"
          className="an-tabs__panel"
          hidden={active !== 'links'}
        >
          <LinksPane />
        </div>
      </div>
      {pluginPanel ? (
        <div className="ai-body">
          <p>{pluginPanel.pluginName}</p>
        </div>
      ) : null}
      <div className={pluginPanel ? 'plugin-stage' : 'plugin-stage parked'}>
        {frames.map((item) => (
          <iframe
            key={item.id}
            className={
              pluginPanel?.pluginId === item.id ? 'plugin-frame' : 'plugin-frame is-hidden'
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
