import { definePlugin } from '@ai-notes/plugin-sdk';

/** preview v1 最小插件：注册一个命令，并订阅笔记创建事件。 */
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
