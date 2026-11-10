import { createRpcRequest, type PluginManifest } from '@ai-notes/plugin-sdk';
import { describe, expect, it } from 'vitest';
import type { PluginServices } from './services.js';
import { PluginSession } from './session.js';

function manifest(permissions: PluginManifest['permissions']): PluginManifest {
  return {
    manifestVersion: 1,
    apiVersion: 'preview-v1',
    id: 'demo',
    name: 'Demo',
    version: '0.1.0',
    minAppVersion: '0.1.0',
    main: 'main.js',
    ...(permissions ? { permissions } : {}),
  };
}

function services(calls: { n: number }): PluginServices {
  const note = {
    path: 'a.md',
    title: 'a',
    createdAt: '2026-11-04T00:00:00Z',
    updatedAt: '2026-11-04T00:00:00Z',
    size: 0,
    frontmatter: {},
    tags: [],
    links: [],
  };
  return {
    listNotes: async () => {
      calls.n += 1;
      return [];
    },
    readNote: async () => {
      calls.n += 1;
      return '';
    },
    createNote: async () => {
      calls.n += 1;
      return note;
    },
    modifyNote: async () => {
      calls.n += 1;
      return note;
    },
    deleteNote: async () => {
      calls.n += 1;
    },
    renameNote: async () => {
      calls.n += 1;
    },
    metadata: async () => {
      calls.n += 1;
      return note;
    },
    searchNotes: async () => {
      calls.n += 1;
      return [];
    },
    activeNote: () => null,
    replaceSelection: async () => {
      calls.n += 1;
    },
    insertAtCursor: async () => {
      calls.n += 1;
    },
    readClipboard: async () => {
      calls.n += 1;
      return '';
    },
    writeClipboard: async () => {
      calls.n += 1;
    },
    fetch: async () => {
      calls.n += 1;
      return { status: 200, headers: {}, body: '' };
    },
    chat: async () => {
      calls.n += 1;
      return {
        message: { role: 'assistant', content: '' },
        citations: [],
        model: '',
        provider: '',
      };
    },
    complete: async () => {
      calls.n += 1;
      return { text: '', citations: [], model: '', provider: '' };
    },
  };
}

describe('PluginSession permissions', () => {
  it('越权时不调用宿主能力', async () => {
    const calls = { n: 0 };
    const session = new PluginSession(manifest([{ id: 'vault:read' }]), services(calls));
    const response = await session.handle(
      createRpcRequest('demo', '1', 'vault.create', { path: 'a.md', content: 'x' }),
    );
    expect(response?.kind).toBe('error');
    if (response?.kind === 'error') expect(response.error.code).toBe('permission_denied');
    expect(calls.n).toBe(0);
  });

  it('有 vault:read 时才会列出笔记', async () => {
    const calls = { n: 0 };
    const session = new PluginSession(manifest([{ id: 'vault:read' }]), services(calls));
    const response = await session.handle(createRpcRequest('demo', '2', 'vault.list', {}));
    expect(response?.kind).toBe('response');
    expect(calls.n).toBe(1);
  });

  it('没有 ui:panel 不能注册右侧面板，有权限则可以', async () => {
    const denied = new PluginSession(manifest([{ id: 'vault:read' }]), services({ n: 0 }));
    const deniedResponse = await denied.handle(
      createRpcRequest('demo', '3', 'views.registerSidebar', { id: 'side', title: '面板' }),
    );
    expect(deniedResponse?.kind).toBe('error');
    expect(denied.panels).toHaveLength(0);

    const allowed = new PluginSession(manifest([{ id: 'ui:panel' }]), services({ n: 0 }));
    const allowedResponse = await allowed.handle(
      createRpcRequest('demo', '4', 'views.registerSidebar', { id: 'side', title: '面板' }),
    );
    expect(allowedResponse?.kind).toBe('response');
    expect(allowed.panels.map((panel) => panel.title)).toEqual(['面板']);
  });

  it('vault.search 受 vault:read 约束，并按文件夹过滤', async () => {
    const calls = { n: 0 };
    const granted = services(calls);
    granted.searchNotes = async () => [
      {
        path: '日记/a.md',
        title: '今天',
        headingPath: '今天',
        startOffset: 1,
        endOffset: 4,
        snippet: '今天',
      },
      {
        path: '其他/b.md',
        title: '别的',
        headingPath: '',
        startOffset: 0,
        endOffset: 2,
        snippet: '别的',
      },
    ];
    const denied = await new PluginSession(manifest([]), granted).handle(
      createRpcRequest('demo', 's1', 'vault.search', { query: '今天' }),
    );
    expect(denied?.kind).toBe('error');
    expect(calls.n).toBe(0);

    const allowed = await new PluginSession(
      manifest([{ id: 'vault:read', folders: ['日记'] }]),
      granted,
    ).handle(createRpcRequest('demo', 's2', 'vault.search', { query: '今天' }));
    expect(allowed?.kind).toBe('response');
    if (allowed?.kind === 'response') {
      expect(allowed.result).toEqual([
        expect.objectContaining({ path: '日记/a.md', snippet: '今天' }),
      ]);
    }
  });

  it('拒绝伪造的插件 id', async () => {
    const calls = { n: 0 };
    const session = new PluginSession(manifest([{ id: 'vault:read' }]), services(calls));
    const response = await session.handle(
      createRpcRequest('other', '5', 'vault.read', { path: 'a.md' }),
    );
    expect(response?.kind).toBe('error');
    expect(calls.n).toBe(0);
  });
});
