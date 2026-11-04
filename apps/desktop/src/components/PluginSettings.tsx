import { useSyncExternalStore } from 'react';
import { pluginController } from '../plugins/controller';
import { useAppStore } from '../store';

export function PluginSettings() {
  const open = useAppStore((state) => state.pluginsOpen);
  const setPluginsOpen = useAppStore((state) => state.setPluginsOpen);
  const vault = useAppStore((state) => state.vault);
  const snapshot = useSyncExternalStore(pluginController.subscribe, pluginController.getSnapshot);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={() => setPluginsOpen(false)}>
      <div
        className="modal plugin-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plugin-settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="plugin-settings-title">插件</h2>
        {!vault ? <p className="hint">先打开一个笔记库。</p> : null}
        {vault && snapshot.items.length === 0 ? <p className="hint">没有发现插件。</p> : null}
        <ul className="plugin-list">
          {snapshot.items.map((item) => (
            <li key={item.id}>
              <label>
                <input
                  type="checkbox"
                  checked={item.enabled}
                  disabled={!vault || item.error !== null}
                  onChange={(event) => {
                    void pluginController.setEnabled(item.id, event.target.checked);
                  }}
                />
                <span>
                  <strong>{item.name}</strong>
                  <span className="hint">{item.id}</span>
                </span>
              </label>
              {item.description ? <p>{item.description}</p> : null}
              {item.permissions.length > 0 ? (
                <p className="hint">权限：{item.permissions.join('、')}</p>
              ) : null}
              {item.error ? <p className="plugin-error">{item.error}</p> : null}
              {item.status === 'error' && !item.error ? (
                <p className="plugin-error">插件没有启动</p>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button className="button" type="button" onClick={() => setPluginsOpen(false)}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
