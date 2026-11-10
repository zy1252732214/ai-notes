import { definePlugin } from '@ai-notes/plugin-sdk';
import type { PluginContext, VaultEntry } from '@ai-notes/plugin-sdk';

export function countNotes(entries: readonly Pick<VaultEntry, 'kind'>[]): number {
  return entries.filter((entry) => entry.kind === 'note').length;
}

export function greeting(count: number): string {
  return `笔记库里有 ${count} 篇笔记`;
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
  color: #1f1f23;
  font: 14px/1.45 -apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
}
.card {
  margin: 12px;
  padding: 16px;
  border: 1px solid #e4e4e8;
  border-radius: 14px;
  background: #fff;
}
.kicker { margin: 0; color: #8e4ec6; font-size: 12px; letter-spacing: 0.04em; }
.message { margin: 12px 0 0; font-size: 20px; font-weight: 600; }
@media (prefers-color-scheme: dark) {
  body { color: #f4f4f5; }
  .card { background: #1c1c21; border-color: #34343c; }
}
`;

export function renderStarter(message: string): string {
  return `<style>${STYLES}</style><main class="card"><p class="kicker">Plugin Starter</p><p class="message">${escapeHtml(message)}</p></main>`;
}

function paint(html: string): void {
  const body = globalThis.document?.body;
  if (!body) return;
  body.innerHTML = html;
}

async function refresh(ctx: PluginContext): Promise<string> {
  const message = greeting(countNotes(await ctx.app.vault.list()));
  paint(renderStarter(message));
  return message;
}

export default definePlugin({
  async onload(ctx) {
    ctx.subscriptions.add(
      ctx.app.views.registerSidebarPanel({ id: 'plugin-starter.panel', title: '示例' }),
    );
    ctx.subscriptions.add(
      ctx.app.commands.register({
        id: 'plugin-starter.hello',
        name: '示例：统计笔记数量',
        callback: async () => {
          console.log(await refresh(ctx));
        },
      }),
    );
    ctx.subscriptions.add(
      ctx.app.events.subscribe('note:created', () => {
        void refresh(ctx);
      }),
    );
    await refresh(ctx);
  },
});
