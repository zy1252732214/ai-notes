import { createRpcRequest, type Permission } from '@ai-notes/plugin-sdk';
import { describe, expect, it } from 'vitest';
import { authorize } from './authorize.js';

const read = [{ id: 'vault:read' }] as const satisfies readonly Permission[];
const scoped = [{ id: 'vault:read', folders: ['日记'] }] as const satisfies readonly Permission[];

describe('authorize', () => {
  it('拒绝没有声明的权限，并放行已经声明的调用', () => {
    const cases: {
      name: string;
      permissions: readonly Permission[];
      method: Parameters<typeof createRpcRequest>[2];
      params: Parameters<typeof createRpcRequest>[3];
      denied: boolean;
    }[] = [
      {
        name: 'vault:write create',
        permissions: read,
        method: 'vault.create',
        params: { path: 'a.md', content: '' },
        denied: true,
      },
      {
        name: 'vault:write modify',
        permissions: read,
        method: 'vault.modify',
        params: { path: 'a.md', content: 'x' },
        denied: true,
      },
      {
        name: 'vault:write delete',
        permissions: read,
        method: 'vault.delete',
        params: { path: 'a.md' },
        denied: true,
      },
      {
        name: 'vault:write rename',
        permissions: read,
        method: 'vault.rename',
        params: { from: 'a.md', to: 'b.md' },
        denied: true,
      },
      {
        name: 'vault:read',
        permissions: read,
        method: 'vault.read',
        params: { path: 'a.md' },
        denied: false,
      },
      {
        name: 'folder outside',
        permissions: scoped,
        method: 'vault.read',
        params: { path: '其他/a.md' },
        denied: true,
      },
      {
        name: 'folder inside',
        permissions: scoped,
        method: 'vault.read',
        params: { path: '日记/a.md' },
        denied: false,
      },
      {
        name: 'list whole vault when scoped',
        permissions: scoped,
        method: 'vault.list',
        params: {},
        denied: true,
      },
      {
        name: 'ai.chat',
        permissions: [],
        method: 'ai.chat',
        params: { messages: [{ role: 'user', content: 'hi' }] },
        denied: true,
      },
      {
        name: 'ai.complete',
        permissions: [],
        method: 'ai.complete',
        params: { prompt: 'hi' },
        denied: true,
      },
      {
        name: 'ai.chat granted',
        permissions: [{ id: 'ai:invoke' }],
        method: 'ai.chat',
        params: { messages: [{ role: 'user', content: 'hi' }] },
        denied: false,
      },
      {
        name: 'network missing',
        permissions: [],
        method: 'network.fetch',
        params: { url: 'https://example.com' },
        denied: true,
      },
      {
        name: 'network other host',
        permissions: [{ id: 'network', domains: ['api.example.com'] }],
        method: 'network.fetch',
        params: { url: 'https://evil.test/a' },
        denied: true,
      },
      {
        name: 'network wildcard',
        permissions: [{ id: 'network', domains: ['*.example.com'] }],
        method: 'network.fetch',
        params: { url: 'https://api.example.com/v1' },
        denied: false,
      },
      {
        name: 'ui:panel',
        permissions: [],
        method: 'views.registerSidebar',
        params: { id: 'side', title: '侧栏' },
        denied: true,
      },
      {
        name: 'ui:panel granted',
        permissions: [{ id: 'ui:panel' }],
        method: 'views.registerSidebar',
        params: { id: 'side', title: '侧栏' },
        denied: false,
      },
      {
        name: 'clipboard read',
        permissions: [],
        method: 'clipboard.read',
        params: {},
        denied: true,
      },
      {
        name: 'clipboard write',
        permissions: [],
        method: 'clipboard.write',
        params: { text: 'x' },
        denied: true,
      },
      {
        name: 'clipboard granted',
        permissions: [{ id: 'clipboard' }],
        method: 'clipboard.write',
        params: { text: 'x' },
        denied: false,
      },
      {
        name: 'command without extra permission',
        permissions: read,
        method: 'commands.register',
        params: { id: 'demo.ping', name: 'Ping' },
        denied: false,
      },
    ];

    for (const item of cases) {
      const request = createRpcRequest('demo', item.name, item.method, item.params);
      const decision = authorize(item.permissions, request);
      expect(decision.ok, item.name).toBe(!item.denied);
      if (!decision.ok && item.denied) expect(decision.code).toBe('permission_denied');
    }
  });
});
