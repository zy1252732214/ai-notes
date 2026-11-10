import { definePlugin } from '@ai-notes/plugin-sdk';
import type { PluginContext, VaultEntry } from '@ai-notes/plugin-sdk';

export const DAILY_FOLDER = '日记';

const DAILY_PATH = /^日记\/\d{4}-\d{2}-\d{2}\.md$/;

export function formatDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftDay(day: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error(`Invalid day: ${day}`);
  const value = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  value.setDate(value.getDate() + delta);
  return formatDay(value);
}

export function dailyNotePath(day: string): string {
  return `${DAILY_FOLDER}/${day}.md`;
}

export function dailyLink(day: string): string {
  return `[[${dailyNotePath(day)}]]`;
}

export function dailyNoteBody(day: string): string {
  return `---
tags: [日记]
---

# ${day}

## 计划

- 

## 记录

## 回顾

昨日：${dailyLink(shiftDay(day, -1))}
`;
}

export function recentDailyPaths(
  entries: readonly Pick<VaultEntry, 'path' | 'kind'>[],
  limit = 7,
): string[] {
  return entries
    .filter((entry) => entry.kind === 'note' && DAILY_PATH.test(entry.path))
    .map((entry) => entry.path)
    .sort((left, right) => (left < right ? 1 : left > right ? -1 : 0))
    .slice(0, limit);
}

export function excerpt(content: string, max = 180): string {
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
  const flat = body.replace(/\s+/g, ' ');
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max).trimEnd()}…`;
}

export interface DailyResult {
  day: string;
  path: string;
  status: 'created' | 'exists';
}

export async function createToday(ctx: PluginContext, now: Date): Promise<DailyResult> {
  const day = formatDay(now);
  const path = dailyNotePath(day);
  const entries = await ctx.app.vault.list({ folder: DAILY_FOLDER, recursive: true });
  if (entries.some((entry) => entry.path === path)) return { day, path, status: 'exists' };
  try {
    await ctx.app.vault.create(path, dailyNoteBody(day));
    return { day, path, status: 'created' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('已存在')) return { day, path, status: 'exists' };
    throw error;
  }
}

export interface DailyPanelModel {
  day: string;
  path: string;
  state: 'missing' | 'ready';
  excerpt: string;
  recent: readonly string[];
}

export async function loadDailyPanel(ctx: PluginContext, now: Date): Promise<DailyPanelModel> {
  const day = formatDay(now);
  const path = dailyNotePath(day);
  const entries = await ctx.app.vault.list({ folder: DAILY_FOLDER, recursive: true });
  const exists = entries.some((entry) => entry.path === path);
  const text = exists ? await ctx.app.vault.read(path) : '';
  return {
    day,
    path,
    state: exists ? 'ready' : 'missing',
    excerpt: exists ? excerpt(text) : '',
    recent: recentDailyPaths(entries),
  };
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
.day { margin: 8px 0 0; font-size: 28px; line-height: 1.2; font-weight: 600; letter-spacing: -0.03em; }
.status { margin: 8px 0 0; color: #57534e; }
.excerpt { margin: 12px 0 0; white-space: pre-wrap; }
ol { margin: 12px 0 0; padding-left: 18px; }
li { margin: 4px 0; }
.hint { margin: 12px 0 0; color: #736d61; font-size: 12px; }
@media (prefers-color-scheme: dark) {
  body { color: #f4f1ea; }
  .card { background: #1c1b19; border-color: #3a3834; }
  .kicker { color: #9dc7b8; }
  .status, .hint { color: #c4bfb4; }
}
`;

export function renderDaily(model: DailyPanelModel): string {
  const status = model.state === 'ready' ? '今天的笔记已经在库里' : '今天还没有笔记';
  const quote = model.excerpt ? `<p class="excerpt">${escapeHtml(model.excerpt)}</p>` : '';
  const recent =
    model.recent.length === 0
      ? ''
      : `<ol>${model.recent.map((path) => `<li>${escapeHtml(path)}</li>`).join('')}</ol>`;
  return `<style>${STYLES}</style>
<main class="card">
  <p class="kicker">今日</p>
  <h1 class="day">${escapeHtml(model.day)}</h1>
  <p class="status">${status}</p>
  ${quote}
  ${recent}
  <p class="hint">复制链接后，用快速切换输入日期即可打开。</p>
</main>`;
}

function paint(html: string): void {
  const body = globalThis.document?.body;
  if (!body) return;
  body.innerHTML = html;
}

export default definePlugin({
  async onload(ctx) {
    async function paintToday(now: Date): Promise<void> {
      paint(renderDaily(await loadDailyPanel(ctx, now)));
    }

    ctx.subscriptions.add(
      ctx.app.views.registerSidebarPanel({ id: 'daily-notes.panel', title: '今日' }),
    );
    ctx.subscriptions.add(
      ctx.app.commands.register({
        id: 'daily-notes.create',
        name: '创建今日笔记',
        hotkey: { modifiers: ['Mod', 'Alt'], key: 'D' },
        callback: async () => {
          const now = new Date();
          const result = await createToday(ctx, now);
          await paintToday(now);
          console.log(
            result.status === 'created' ? `已创建 ${result.path}` : `今日笔记已在 ${result.path}`,
          );
        },
      }),
    );
    ctx.subscriptions.add(
      ctx.app.commands.register({
        id: 'daily-notes.copy-link',
        name: '复制今日笔记链接',
        callback: async () => {
          const link = dailyLink(formatDay(new Date()));
          await ctx.app.clipboard.writeText(link);
          console.log(link);
        },
      }),
    );
    ctx.subscriptions.add(
      ctx.app.events.subscribe('note:created', (event) => {
        if (event.path.startsWith(`${DAILY_FOLDER}/`)) void paintToday(new Date());
      }),
    );
    await paintToday(new Date());
  },
});
