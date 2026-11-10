import { definePlugin } from '@ai-notes/plugin-sdk';
import type { PluginContext } from '@ai-notes/plugin-sdk';

export interface NoteStats {
  path: string;
  title: string;
  /** Non-whitespace code points. Same definition as the desktop status bar. */
  characters: number;
  /** Han, kana, and hangul. Used for the reading-time estimate. */
  cjk: number;
  /** Latin letters and digits, split on punctuation. */
  words: number;
  /** Non-empty lines. */
  lines: number;
  /** At least 1 when the note has any visible character. */
  minutes: number;
}

const CJK = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/gu;
const LATIN_WORD = /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g;

export function noteTitle(path: string, content: string): string {
  const heading = content.match(/^#\s+(\S.*?)\s*$/m)?.[1];
  if (heading) return heading;
  const base = path.split('/').pop() ?? path;
  return base.replace(/\.md$/i, '');
}

export function countNote(path: string, content: string): NoteStats {
  const characters = Array.from(content.replace(/\s/g, '')).length;
  const cjk = content.match(CJK)?.length ?? 0;
  const words = content.match(LATIN_WORD)?.length ?? 0;
  const lines = content.split('\n').filter((line) => line.trim().length > 0).length;
  const estimate = cjk / 400 + words / 220;
  const minutes = characters === 0 ? 0 : Math.max(1, Math.round(estimate));
  return { path, title: noteTitle(path, content), characters, cjk, words, lines, minutes };
}

export function summaryLine(stats: NoteStats): string {
  const time = stats.minutes === 0 ? '0 分钟' : `约 ${stats.minutes} 分钟`;
  return `${stats.title} · ${stats.characters} 字 · ${stats.words} 词 · ${time}`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const STYLES = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
  margin: 0;
  background: transparent;
  color: #1c1917;
  font: 14px/1.5 -apple-system, "Inter", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", "Segoe UI", sans-serif;
}
.card {
  margin: 12px;
  padding: 16px;
  border: 1px solid #e6e1d8;
  border-radius: 12px;
  background: #fffcf9;
}
.kicker { margin: 0; color: #3c6e62; font-size: 12px; letter-spacing: 0.04em; }
h1 { margin: 8px 0 0; font-size: 18px; line-height: 1.35; }
.path { margin: 4px 0 0; color: #8a847c; font-size: 12px; word-break: break-all; }
.figure {
  margin: 16px 0 0;
  font-size: 42px;
  line-height: 1;
  font-weight: 600;
  letter-spacing: -0.03em;
}
.unit { margin: 2px 0 0; color: #57534e; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
.grid div { padding: 8px; border-radius: 8px; background: #f3f1ec; }
.grid b { display: block; font-size: 16px; }
.grid span { color: #57534e; font-size: 12px; }
.empty { margin: 12px 0 0; color: #57534e; }
@media (prefers-color-scheme: dark) {
  body { color: #f4f1ea; }
  .card { background: #1c1b19; border-color: #3a3834; }
  .kicker { color: #9dc7b8; }
  .path, .unit, .grid span, .empty { color: #c4bfb4; }
  .grid div { background: #2c2b28; }
}
`;

export function renderWordCount(stats: NoteStats | null): string {
  const body = stats
    ? `<p class="path">${escapeHtml(stats.path)}</p>
       <p class="figure">${stats.characters}</p>
       <p class="unit">字</p>
       <div class="grid">
         <div><b>${stats.words}</b><span>词</span></div>
         <div><b>${stats.lines}</b><span>行</span></div>
         <div><b>${stats.minutes}</b><span>分钟</span></div>
       </div>`
    : '<p class="empty">打开一篇笔记。保存之后，这里会显示字数。</p>';
  const title = stats ? escapeHtml(stats.title) : '字数';
  return `<style>${STYLES}</style><main class="card"><p class="kicker">字数</p><h1>${title}</h1>${body}</main>`;
}

function paint(html: string): void {
  const body = globalThis.document?.body;
  if (!body) return;
  body.innerHTML = html;
}

async function readShown(ctx: PluginContext, path: string): Promise<string> {
  const editor = await ctx.app.editor.getActiveEditor();
  if (editor && editor.notePath === path && typeof editor.getContent === 'function') {
    try {
      return await editor.getContent();
    } catch {
      // The current sandbox handle only carries notePath.
    }
  }
  return ctx.app.vault.read(path);
}

export default definePlugin({
  async onload(ctx) {
    let shown: string | null = null;

    async function refresh(path: string | null): Promise<NoteStats | null> {
      shown = path;
      if (!path) {
        paint(renderWordCount(null));
        return null;
      }
      const stats = countNote(path, await readShown(ctx, path));
      paint(renderWordCount(stats));
      return stats;
    }

    async function refreshActive(): Promise<NoteStats | null> {
      const editor = await ctx.app.editor.getActiveEditor();
      return refresh(editor?.notePath ?? null);
    }

    ctx.subscriptions.add(
      ctx.app.views.registerSidebarPanel({ id: 'word-count.panel', title: '字数' }),
    );
    ctx.subscriptions.add(
      ctx.app.commands.register({
        id: 'word-count.show',
        name: '统计当前笔记字数',
        hotkey: { modifiers: ['Mod', 'Alt'], key: 'W' },
        callback: async () => {
          const stats = await refreshActive();
          console.log(stats ? summaryLine(stats) : '没有打开笔记');
        },
      }),
    );
    ctx.subscriptions.add(
      ctx.app.commands.register({
        id: 'word-count.copy',
        name: '复制字数统计',
        callback: async () => {
          const stats = await refreshActive();
          if (!stats) {
            console.log('没有打开笔记');
            return;
          }
          const line = summaryLine(stats);
          await ctx.app.clipboard.writeText(line);
          console.log(line);
        },
      }),
    );
    ctx.subscriptions.add(
      ctx.app.events.subscribe('note:opened', (event) => {
        void refresh(event.path);
      }),
    );
    ctx.subscriptions.add(
      ctx.app.events.subscribe('note:modified', (event) => {
        if (event.path === shown) void refresh(event.path);
      }),
    );
    await refreshActive();
  },
});
