import { Plugin, type PluginContext } from '@ai-notes/plugin-sdk';

/** 同一个插件的类写法。入口可以默认导出这个构造函数。 */
export class HelloNotesPlugin extends Plugin {
  constructor(ctx: PluginContext) {
    super(ctx);
  }

  override async onload(): Promise<void> {
    this.ctx.subscriptions.add(
      this.ctx.app.events.subscribe('note:opened', (event) => {
        console.log(`打开笔记：${event.path}`);
      }),
    );
  }
}

export default HelloNotesPlugin;
