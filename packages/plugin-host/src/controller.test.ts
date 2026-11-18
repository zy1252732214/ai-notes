import { PLUGIN_API_VERSION, RPC_PROTOCOL, createRpcRequest } from '@ai-notes/plugin-sdk';
import { describe, expect, it } from 'vitest';
import { PluginController } from './controller.js';
import { SANDBOX_SDK_SOURCE } from './sandboxSource.js';
import { installPluginFiles } from './discover.js';
import type { PluginServices } from './services.js';
import { MemoryPluginStorage } from './storage.js';

const manifest = {
  manifestVersion: 1,
  apiVersion: 'preview-v1',
  id: 'hello-notes',
  name: 'Hello Notes',
  version: '0.1.0',
  minAppVersion: '0.1.0',
  main: 'main.js',
  permissions: [{ id: 'vault:read' }],
};

const main = `import { definePlugin } from '@ai-notes/plugin-sdk';
export default definePlugin({ async onload() {} });
`;

function services(calls: { n: number }): PluginServices {
  const note = {
    path: 'a.md',
    title: 'a',
    createdAt: '',
    updatedAt: '',
    size: 0,
    frontmatter: {},
    tags: [],
    links: [],
  };
  const touch = async () => {
    calls.n += 1;
    return note;
  };
  return {
    listNotes: async () => [],
    readNote: async () => '',
    createNote: touch,
    modifyNote: touch,
    deleteNote: async () => undefined,
    renameNote: async () => undefined,
    metadata: touch,
    searchNotes: async () => [],
    activeNote: () => null,
    replaceSelection: async () => undefined,
    insertAtCursor: async () => undefined,
    readClipboard: async () => '',
    writeClipboard: async () => undefined,
    fetch: async () => ({ status: 200, headers: {}, body: '' }),
    chat: async () => ({
      message: { role: 'assistant', content: '' },
      citations: [],
      model: '',
      provider: '',
    }),
    complete: async () => ({ text: '', citations: [], model: '', provider: '' }),
  };
}

describe('PluginController', () => {
  it('发现已启用插件，注册命令，并拒绝写笔记', async () => {
    const storage = new MemoryPluginStorage();
    await installPluginFiles(storage, 'hello-notes', {
      'manifest.json': JSON.stringify(manifest),
      'main.js': main,
    });
    const calls = { n: 0 };
    const controller = new PluginController();
    await controller.attach(storage, services(calls));
    const item = controller.getSnapshot().items[0];
    expect(item?.id).toBe('hello-notes');
    expect(item?.enabled).toBe(true);
    expect(item?.srcdoc).toContain('hello-notes');
    expect(item?.srcdoc).toContain('globalThis.__aiNotes');

    await controller.receive(
      'hello-notes',
      createRpcRequest('hello-notes', 'cmd', 'commands.register', {
        id: 'hello-notes.say-hello',
        name: '统计笔记数量',
        hotkey: 'Mod+Shift+H',
      }),
    );
    expect(controller.commands().map((command) => command.name)).toEqual(['统计笔记数量']);

    await controller.receive(
      'hello-notes',
      createRpcRequest('hello-notes', 'write', 'vault.create', { path: 'a.md', content: 'x' }),
    );
    expect(calls.n).toBe(0);

    await controller.setEnabled('hello-notes', false);
    expect(controller.getSnapshot().items[0]?.enabled).toBe(false);
    expect(controller.getSnapshot().items[0]?.srcdoc).toBeNull();
    expect(await storage.read('plugin-state.json')).toContain('hello-notes');
  });

  it('把插件日志按级别交回宿主，普通日志不是错误', async () => {
    const storage = new MemoryPluginStorage();
    await installPluginFiles(storage, 'hello-notes', {
      'manifest.json': JSON.stringify(manifest),
      'main.js': main,
    });
    const logs: Array<{ message: string; level: string }> = [];
    const controller = new PluginController();
    await controller.attach(storage, services({ n: 0 }), {
      onLog: (message, level) => logs.push({ message, level }),
    });
    await controller.receive('hello-notes', {
      protocol: RPC_PROTOCOL,
      version: PLUGIN_API_VERSION,
      pluginId: 'hello-notes',
      id: 'log-1',
      kind: 'event',
      method: 'lifecycle:log',
      params: { message: '新笔记：验收来源.md', level: 'info' },
    });
    await controller.receive('hello-notes', {
      protocol: RPC_PROTOCOL,
      version: PLUGIN_API_VERSION,
      pluginId: 'hello-notes',
      id: 'log-2',
      kind: 'event',
      method: 'lifecycle:log',
      params: { message: '写不进去', level: 'error' },
    });
    expect(logs).toEqual([
      { message: '新笔记：验收来源.md', level: 'info' },
      { message: '写不进去', level: 'error' },
    ]);
    expect(SANDBOX_SDK_SOURCE).toContain("report('info', log, args)");
    expect(SANDBOX_SDK_SOURCE).toContain("report('error', error, args)");
  });
});
