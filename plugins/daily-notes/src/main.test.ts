import manifest from '../manifest.json' with { type: 'json' };
import { formatManifestIssues, parseManifest } from '@ai-notes/plugin-host';
import type { Command, NoteMetadata, PluginContext, VaultEntry } from '@ai-notes/plugin-sdk';
import { describe, expect, it } from 'vitest';
import plugin, {
  createToday,
  dailyNoteBody,
  dailyNotePath,
  excerpt,
  formatDay,
  recentDailyPaths,
  renderDaily,
  shiftDay,
} from './main.js';

const day = new Date(2026, 10, 10);

function metadata(path: string): NoteMetadata {
  return {
    path,
    title: path,
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
    size: 0,
    frontmatter: {},
    tags: [],
    links: [],
  };
}

function vault() {
  const notes = new Map<string, string>();
  const ctx = {
    app: {
      vault: {
        list: async (): Promise<VaultEntry[]> =>
          [...notes.keys()].map((path) => ({
            path,
            name: path.split('/').pop() ?? path,
            kind: 'note' as const,
          })),
        read: async (path: string) => {
          const text = notes.get(path);
          if (text === undefined) throw new Error('文件不存在');
          return text;
        },
        create: async (path: string, content: string) => {
          if (notes.has(path)) throw new Error('笔记已存在');
          notes.set(path, content);
          return metadata(path);
        },
      },
      clipboard: {
        writeText: async () => undefined,
      },
    },
  } as unknown as PluginContext;
  return { ctx, notes };
}

describe('daily note files', () => {
  it('formats a local date and steps across a leap day', () => {
    expect(formatDay(day)).toBe('2026-11-10');
    expect(shiftDay('2024-03-01', -1)).toBe('2024-02-29');
    expect(dailyNotePath('2026-11-10')).toBe('日记/2026-11-10.md');
  });

  it('writes a template that links yesterday and keeps an explicit heading', () => {
    const body = dailyNoteBody('2026-11-10');
    expect(body).toContain('# 2026-11-10');
    expect(body).toContain('昨日：[[日记/2026-11-09.md]]');
    expect(body).toContain('tags: [日记]');
  });

  it('lists recent diary notes newest first and ignores other files', () => {
    expect(
      recentDailyPaths([
        { path: '日记/2026-11-08.md', kind: 'note' },
        { path: '日记/2026-11-10.md', kind: 'note' },
        { path: '欢迎.md', kind: 'note' },
        { path: '日记', kind: 'folder' },
      ]),
    ).toEqual(['日记/2026-11-10.md', '日记/2026-11-08.md']);
  });

  it('drops frontmatter and escapes the excerpt', () => {
    const text = excerpt('---\ntags: [日记]\n---\n\n# 今天\n\n<script>alert(1)</script>');
    expect(text.startsWith('# 今天')).toBe(true);
    const html = renderDaily({
      day: '2026-11-10',
      path: '日记/2026-11-10.md',
      state: 'ready',
      excerpt: text,
      recent: ['日记/2026-11-10.md'],
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('今天的笔记已经在库里');
  });
});

describe('createToday', () => {
  it('creates the note once and leaves the existing body alone', async () => {
    const { ctx, notes } = vault();
    const created = await createToday(ctx, day);
    expect(created).toEqual({
      day: '2026-11-10',
      path: '日记/2026-11-10.md',
      status: 'created',
    });
    notes.set('日记/2026-11-10.md', '手写过的内容');
    const again = await createToday(ctx, day);
    expect(again.status).toBe('exists');
    expect(notes.get('日记/2026-11-10.md')).toBe('手写过的内容');
  });
});

describe('daily-notes plugin', () => {
  it('ships a manifest the host accepts', () => {
    const parsed = parseManifest(manifest);
    if (!parsed.ok) throw new Error(formatManifestIssues(parsed.issues));
    expect(parsed.manifest.id).toBe('daily-notes');
    expect(parsed.manifest.permissions?.map((item) => item.id)).toEqual([
      'vault:read',
      'vault:write',
      'clipboard',
      'ui:panel',
    ]);
  });

  it('creates today from the command and copies a wikilink', async () => {
    const notes = new Map<string, string>();
    const commands: Command[] = [];
    const copied: string[] = [];
    const logs: string[] = [];
    const ctx = {
      subscriptions: {
        add<T>(item: T): T {
          return item;
        },
        dispose() {},
      },
      app: {
        vault: {
          list: async () =>
            [...notes.keys()].map((path) => ({
              path,
              name: path.split('/').pop() ?? path,
              kind: 'note' as const,
            })),
          read: async (path: string) => {
            const text = notes.get(path);
            if (text === undefined) throw new Error('文件不存在');
            return text;
          },
          create: async (path: string, content: string) => {
            if (notes.has(path)) throw new Error('笔记已存在');
            notes.set(path, content);
            return metadata(path);
          },
        },
        commands: {
          register(command: Command) {
            commands.push(command);
            return { dispose() {} };
          },
        },
        views: { registerSidebarPanel: () => ({ dispose() {} }) },
        events: { subscribe: () => ({ dispose() {} }) },
        clipboard: {
          writeText: async (text: string) => {
            copied.push(text);
          },
        },
      },
    } as unknown as PluginContext;
    const previousLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map((item) => String(item)).join(' '));
    };
    try {
      await plugin.onload(ctx);
      const create = commands.find((command) => command.id === 'daily-notes.create');
      await create?.callback?.();
      const path = `日记/${formatDay(new Date())}.md`;
      expect(notes.has(path)).toBe(true);
      expect(logs.at(-1)).toBe(`已创建 ${path}`);
      await create?.callback?.();
      expect(logs.at(-1)).toBe(`今日笔记已在 ${path}`);
      const copy = commands.find((command) => command.id === 'daily-notes.copy-link');
      await copy?.callback?.();
      expect(copied.at(-1)).toBe(`[[${path}]]`);
    } finally {
      console.log = previousLog;
    }
  });
});
