/**
 * 跑在沙箱 iframe 里的插件 SDK。
 * 插件的 main.js 仍然 `import { definePlugin } from '@ai-notes/plugin-sdk'`，
 * import map 会把这个说明符指到下面这份脚本。
 */
export const SANDBOX_SDK_SOURCE = `
const pending = new Map();

function envelope(pluginId, id, kind, extra) {
  return Object.assign({
    protocol: 'ai-notes.plugin-rpc',
    version: 'preview-v1',
    pluginId,
    id,
    kind,
  }, extra);
}

function post(pluginId, message) {
  parent.postMessage(message, '*');
}

function rpc(pluginId, method, params) {
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    post(pluginId, envelope(pluginId, id, 'request', { method, params: params ?? {} }));
  });
}

function disposable(dispose) {
  let done = false;
  return {
    dispose() {
      if (done) return;
      done = true;
      dispose();
    },
  };
}

function hotkeyString(hotkey) {
  if (!hotkey) return undefined;
  if (typeof hotkey === 'string') return hotkey;
  return hotkey.modifiers.concat(hotkey.key).join('+');
}

export function definePlugin(definition) {
  return definition;
}

export async function boot(plugin, manifest) {
  const pluginId = manifest.id;
  const commands = new Map();
  const eventHandlers = new Map();
  const disposables = [];
  const log = console.log.bind(console);
  console.log = (...args) => {
    log(...args);
    post(pluginId, envelope(pluginId, 'log-' + Math.random().toString(36).slice(2), 'event', {
      method: 'lifecycle:log',
      params: { message: args.map((item) => String(item)).join(' ') },
    }));
  };

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.protocol !== 'ai-notes.plugin-rpc' || data.pluginId !== pluginId) return;
    if (data.kind === 'response') {
      const waiter = pending.get(data.id);
      pending.delete(data.id);
      waiter?.resolve(data.result);
      return;
    }
    if (data.kind === 'error') {
      const waiter = pending.get(data.id);
      pending.delete(data.id);
      const error = new Error(data.error?.message || '插件调用失败');
      error.code = data.error?.code;
      waiter?.reject(error);
      return;
    }
    if (data.kind === 'request' && data.method === 'command.invoke') {
      const command = commands.get(data.params?.commandId);
      Promise.resolve()
        .then(() => (command?.callback ? command.callback() : undefined))
        .then(() => post(pluginId, envelope(pluginId, data.id, 'response', { result: null })))
        .catch((error) => post(pluginId, envelope(pluginId, data.id, 'error', {
          error: { code: 'internal', message: error instanceof Error ? error.message : String(error) },
        })));
      return;
    }
    if (data.kind === 'event' && typeof data.method === 'string' && data.method.startsWith('note:')) {
      const handlers = eventHandlers.get(data.method);
      if (!handlers) return;
      const payload = data.method === 'note:renamed'
        ? { type: data.method, from: data.params?.from, to: data.params?.to }
        : { type: data.method, path: data.params?.path };
      handlers.forEach((handler) => handler(payload));
      return;
    }
    if (data.kind === 'event' && data.method === 'lifecycle:unload') {
      disposables.splice(0).forEach((item) => item.dispose());
    }
  });

  function track(call) {
    let registrationId = '';
    const pendingCall = call.then((result) => {
      registrationId = result?.registrationId || result?.subscriptionId || '';
      return result;
    });
    return { pendingCall, getId: () => registrationId };
  }

  const ctx = {
    apiVersion: 'preview-v1',
    manifest,
    permissions: manifest.permissions || [],
    subscriptions: {
      add(item) {
        disposables.push(item);
        return item;
      },
      dispose() {
        disposables.splice(0).forEach((item) => item.dispose());
      },
    },
    app: {
      vault: {
        read: (path) => rpc(pluginId, 'vault.read', { path }),
        list: (options) => rpc(pluginId, 'vault.list', options || {}),
        create: (path, content, options) => rpc(pluginId, 'vault.create', {
          path,
          content,
          overwrite: Boolean(options && options.overwrite),
        }),
        modify: (path, content) => rpc(pluginId, 'vault.modify', { path, content }),
        delete: (path) => rpc(pluginId, 'vault.delete', { path }),
        rename: (from, to) => rpc(pluginId, 'vault.rename', { from, to }),
        getMetadata: (path) => rpc(pluginId, 'vault.metadata', { path }),
        search: (query, options) => rpc(pluginId, 'vault.search', {
          query: query,
          limit: options && options.limit,
        }),
      },
      commands: {
        register(command) {
          commands.set(command.id, command);
          const hotkey = hotkeyString(command.hotkey);
          const params = { id: command.id, name: command.name };
          if (hotkey) params.hotkey = hotkey;
          const tracked = track(rpc(pluginId, 'commands.register', params));
          return disposable(() => {
            commands.delete(command.id);
            void tracked.pendingCall.then(() => {
              const registrationId = tracked.getId();
              if (registrationId) void rpc(pluginId, 'commands.unregister', { registrationId });
            });
          });
        },
      },
      views: {
        registerSidebarPanel(panel) {
          const tracked = track(rpc(pluginId, 'views.registerSidebar', {
            id: panel.id,
            title: panel.title,
          }));
          return disposable(() => {
            void tracked.pendingCall.then(() => {
              const registrationId = tracked.getId();
              if (registrationId) void rpc(pluginId, 'views.unregister', { registrationId });
            });
          });
        },
        registerTabView(view) {
          return ctx.app.views.registerSidebarPanel(view);
        },
        registerStatusBarItem(item) {
          return disposable(() => {
            void rpc(pluginId, 'views.registerStatusBar', { id: item.id, text: item.text });
          });
        },
        registerSettingsTab(tab) {
          return disposable(() => {
            void rpc(pluginId, 'views.registerSettings', { id: tab.id, title: tab.title });
          });
        },
        setStatusBarText(id, value) {
          void rpc(pluginId, 'views.setStatusBarText', { id, text: value });
        },
      },
      editor: {
        registerExtension() {
          return disposable(() => undefined);
        },
        registerCodeBlockRenderer() {
          return disposable(() => undefined);
        },
        getActiveEditor() {
          return rpc(pluginId, 'editor.getActive', {});
        },
      },
      ai: {
        chat: (request) => rpc(pluginId, 'ai.chat', request),
        complete: (request) => rpc(pluginId, 'ai.complete', request),
        registerTool(tool) {
          return disposable(() => {
            void rpc(pluginId, 'ai.registerTool', {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            });
          });
        },
      },
      events: {
        subscribe(type, handler) {
          const handlers = eventHandlers.get(type) || new Set();
          handlers.add(handler);
          eventHandlers.set(type, handlers);
          const tracked = track(rpc(pluginId, 'events.subscribe', { type }));
          return disposable(() => {
            handlers.delete(handler);
            void tracked.pendingCall.then(() => {
              const subscriptionId = tracked.getId();
              if (subscriptionId) void rpc(pluginId, 'events.unsubscribe', { subscriptionId });
            });
          });
        },
        unsubscribe(type, handler) {
          eventHandlers.get(type)?.delete(handler);
        },
      },
      clipboard: {
        readText: () => rpc(pluginId, 'clipboard.read', {}),
        writeText: (value) => rpc(pluginId, 'clipboard.write', { text: value }),
      },
      network: {
        fetch: (request) => rpc(pluginId, 'network.fetch', request),
      },
    },
  };

  try {
    const exported = plugin && Object.hasOwn(plugin, 'default') ? plugin.default : plugin;
    const definition = typeof exported === 'function' ? new exported(ctx) : exported;
    await definition.onload(ctx);
    post(pluginId, envelope(pluginId, 'ready', 'event', { method: 'lifecycle:ready', params: {} }));
  } catch (error) {
    post(pluginId, envelope(pluginId, 'boot', 'error', {
      error: { code: 'internal', message: error instanceof Error ? error.message : String(error) },
    }));
  }
}
`;
