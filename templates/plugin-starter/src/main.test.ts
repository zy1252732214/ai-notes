import manifest from '../manifest.json' with { type: 'json' };
import { formatManifestIssues, parseManifest } from '@ai-notes/plugin-host';
import type { Command, PluginContext, VaultEntry } from '@ai-notes/plugin-sdk';
import { describe, expect, it } from 'vitest';
import plugin, { countNotes, escapeHtml, greeting, renderStarter } from './main.js';

describe('Plugin Starter', () => {
  it('counts notes and escapes the sidebar message', () => {
    const entries: Pick<VaultEntry, 'kind'>[] = [
      { kind: 'note' },
      { kind: 'folder' },
      { kind: 'note' },
    ];
    expect(countNotes(entries)).toBe(2);
    expect(greeting(2)).toBe('笔记库里有 2 篇笔记');
    expect(renderStarter('<b>')).toContain('&lt;b&gt;');
    expect(escapeHtml('"&')).toBe('&quot;&amp;');
  });

  it('ships a manifest the host accepts', () => {
    const parsed = parseManifest(manifest);
    if (!parsed.ok) throw new Error(formatManifestIssues(parsed.issues));
    expect(parsed.manifest.id).toBe('plugin-starter');
    expect(parsed.manifest.main).toBe('dist/main.js');
  });

  it('registers a command that logs the note count', async () => {
    const commands: Command[] = [];
    const logs: string[] = [];
    const notes: VaultEntry[] = [
      { path: '欢迎.md', name: '欢迎.md', kind: 'note' },
      { path: '日常', name: '日常', kind: 'folder' },
    ];
    const ctx = {
      subscriptions: {
        add<T>(item: T): T {
          return item;
        },
      },
      app: {
        vault: { list: async () => notes },
        commands: {
          register(command: Command) {
            commands.push(command);
            return { dispose() {} };
          },
        },
        views: { registerSidebarPanel: () => ({ dispose() {} }) },
        events: { subscribe: () => ({ dispose() {} }) },
      },
    } as unknown as PluginContext;
    const previousLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map((item) => String(item)).join(' '));
    };
    try {
      await plugin.onload(ctx);
      expect(commands.map((command) => command.id)).toEqual(['plugin-starter.hello']);
      await commands[0]?.callback?.();
      expect(logs).toEqual(['笔记库里有 1 篇笔记']);
    } finally {
      console.log = previousLog;
    }
  });
});
