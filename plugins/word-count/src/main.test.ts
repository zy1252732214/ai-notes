import manifest from '../manifest.json' with { type: 'json' };
import { formatManifestIssues, parseManifest } from '@ai-notes/plugin-host';
import type { Command, PluginContext } from '@ai-notes/plugin-sdk';
import { describe, expect, it } from 'vitest';
import plugin, { countNote, escapeHtml, renderWordCount, summaryLine } from './main.js';

describe('countNote', () => {
  it('counts visible characters the same way as an empty note', () => {
    expect(countNote('空.md', '')).toMatchObject({
      characters: 0,
      cjk: 0,
      words: 0,
      lines: 0,
      minutes: 0,
      title: '空',
    });
  });

  it('counts CJK, Latin words, and a mixed reading time', () => {
    const han = '汉'.repeat(400);
    const stats = countNote('笔记/草稿.md', `# 草稿\n\n${han}\n\nhello world\n`);
    expect(stats.title).toBe('草稿');
    expect(stats.cjk).toBe(402);
    expect(stats.words).toBe(2);
    expect(stats.lines).toBe(3);
    expect(stats.characters).toBe(413);
    expect(stats.minutes).toBe(1);
    expect(summaryLine(stats)).toBe('草稿 · 413 字 · 2 词 · 约 1 分钟');
  });

  it('rounds a longer Chinese note up to minutes', () => {
    expect(countNote('长.md', '字'.repeat(800)).minutes).toBe(2);
  });
});

describe('renderWordCount', () => {
  it('escapes the title and shows the character count', () => {
    const stats = countNote('a.md', '# <笔记>\n\n你好');
    const html = renderWordCount(stats);
    expect(html).toContain('&lt;笔记&gt;');
    expect(html).not.toContain('<笔记>');
    expect(html).toContain(`>${stats.characters}<`);
    expect(escapeHtml('"&')).toBe('&quot;&amp;');
  });

  it('explains the empty state', () => {
    expect(renderWordCount(null)).toContain('打开一篇笔记');
  });
});

describe('word-count plugin', () => {
  it('ships a manifest the host accepts', () => {
    const parsed = parseManifest(manifest);
    if (!parsed.ok) throw new Error(formatManifestIssues(parsed.issues));
    expect(parsed.manifest.id).toBe('word-count');
    expect(parsed.manifest.main).toBe('dist/main.js');
    expect(parsed.manifest.permissions?.map((item) => item.id)).toEqual([
      'vault:read',
      'clipboard',
      'ui:panel',
    ]);
  });

  it('prefers unsaved editor text, then falls back to the saved note', async () => {
    const notes = new Map<string, string>([['欢迎.md', '# 欢迎\n\n已保存']]);
    let content = '# 欢迎\n\n未保存的草稿';
    let failRead = false;
    const copied: string[] = [];
    const painted: string[] = [];
    const logs: string[] = [];
    const commands: Command[] = [];
    const ctx = {
      subscriptions: {
        add<T>(item: T): T {
          return item;
        },
      },
      app: {
        vault: {
          read: async (path: string) => notes.get(path) ?? '',
        },
        commands: {
          register(command: Command) {
            commands.push(command);
            return { dispose() {} };
          },
        },
        views: {
          registerSidebarPanel() {
            return { dispose() {} };
          },
        },
        editor: {
          getActiveEditor: async () =>
            failRead
              ? {
                  notePath: '欢迎.md',
                  getContent: async () => {
                    throw new Error('sandbox');
                  },
                }
              : { notePath: '欢迎.md', getContent: async () => content },
        },
        events: {
          subscribe() {
            return { dispose() {} };
          },
        },
        clipboard: {
          writeText: async (text: string) => {
            copied.push(text);
          },
        },
      },
    } as unknown as PluginContext;
    const previousDocument = globalThis.document;
    const previousLog = console.log;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        body: {
          set innerHTML(value: string) {
            painted.push(value);
          },
        },
      },
    });
    console.log = (...args: unknown[]) => {
      logs.push(args.map((item) => String(item)).join(' '));
    };
    try {
      await plugin.onload(ctx);
      expect(painted.at(-1)).toContain('>9<');
      const copy = commands.find((command) => command.id === 'word-count.copy');
      await copy?.callback?.();
      expect(copied).toEqual([summaryLine(countNote('欢迎.md', content))]);
      expect(copied).toEqual([logs.at(-1)]);

      failRead = true;
      content = '';
      const show = commands.find((command) => command.id === 'word-count.show');
      await show?.callback?.();
      expect(painted.at(-1)).toContain('>6<');
      expect(logs.at(-1)).toBe(summaryLine(countNote('欢迎.md', '# 欢迎\n\n已保存')));
    } finally {
      console.log = previousLog;
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: previousDocument,
      });
    }
  });
});
