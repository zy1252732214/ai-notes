import { definePlugin } from '@ai-notes/plugin-sdk';

/** 给沙箱 iframe 加载的入口，逻辑与 main.ts 一致。 */
export default definePlugin({
  async onload(ctx) {
    ctx.subscriptions.add(
      ctx.app.commands.register({
        id: 'hello-notes.say-hello',
        name: '统计笔记数量',
        hotkey: { modifiers: ['Mod', 'Shift'], key: 'H' },
        callback: async () => {
          const entries = await ctx.app.vault.list();
          const count = entries.filter((entry) => entry.kind === 'note').length;
          console.log(`Vault 里有 ${count} 篇笔记`);
        },
      }),
    );

    ctx.subscriptions.add(
      ctx.app.events.subscribe('note:created', (event) => {
        console.log(`新笔记：${event.path}`);
      }),
    );
  },
});
