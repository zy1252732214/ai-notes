import { PluginController } from '@ai-notes/plugin-host';

export const pluginController = new PluginController();

/** 在 React effect 之前监听，避免沙箱脚本同步发出的第一条 RPC 被丢掉。 */
export function installPluginBridge(): void {
  if (typeof window === 'undefined') return;
  const flag = '__aiNotesPluginBridge';
  const target = window as Window & { [flag]?: boolean };
  if (target[flag]) return;
  target[flag] = true;
  window.addEventListener('message', (event) => {
    const frames = document.querySelectorAll<HTMLIFrameElement>('iframe.plugin-frame');
    for (const frame of frames) {
      if (frame.contentWindow !== event.source) continue;
      const pluginId = frame.dataset.pluginId;
      if (pluginId) void pluginController.receive(pluginId, event.data);
    }
  });
}
