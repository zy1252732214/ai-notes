# @ai-notes/plugin-sdk

ai-notes 插件 API，**preview v1**（`apiVersion = "preview-v1"`）。1.0 之前类型还可以调整，宿主和插件要一起升级。

这个包只有类型、清单的 JSON Schema，以及沙箱和宿主之间的 RPC 信封。它不读文件，也不打开数据库。宿主的实现放在 `packages/plugin-host`。

## 插件目录

```text
hello-notes/
  manifest.json
  main.js
  styles.css      可选
```

清单字段：`id`、`name`、`version`、`minAppVersion`、`author`、`description`、`main`、`permissions`、`contributes`。Schema 在 [`schema/manifest.schema.json`](schema/manifest.schema.json)。

| 权限          | 作用                                            |
| ------------- | ----------------------------------------------- |
| `vault:read`  | 读笔记。`folders` 可限制到若干文件夹            |
| `vault:write` | 创建、修改、删除、重命名。preview v1 覆盖整个库 |
| `ai:invoke`   | `chat` / `complete`，计入额度                   |
| `network`     | 只能访问声明过的域名，由宿主代发                |
| `ui:panel`    | 侧栏、标签页、状态栏、设置页                    |
| `clipboard`   | 读写剪贴板文本                                  |

## 最小插件

完整文件在 [`examples/hello-notes`](examples/hello-notes)。

`manifest.json`：

```json
{
  "manifestVersion": 1,
  "apiVersion": "preview-v1",
  "id": "hello-notes",
  "name": "Hello Notes",
  "version": "0.1.0",
  "minAppVersion": "0.1.0",
  "author": "ai-notes",
  "description": "统计笔记数量，并在新建笔记时打一条日志。",
  "main": "main.js",
  "permissions": [{ "id": "vault:read" }],
  "contributes": {
    "commands": [
      { "id": "hello-notes.say-hello", "name": "统计笔记数量", "hotkey": "Mod+Shift+H" }
    ],
    "events": ["note:created"]
  }
}
```

`main.ts`：

```ts
import { definePlugin } from '@ai-notes/plugin-sdk';

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
```

也可以默认导出一个类。宿主如果发现默认导出是函数，就 `new Plugin(ctx)`：

```ts
import { Plugin, type PluginContext } from '@ai-notes/plugin-sdk';

export default class HelloNotesPlugin extends Plugin {
  constructor(ctx: PluginContext) {
    super(ctx);
  }

  override async onload(): Promise<void> {
    this.ctx.subscriptions.add(
      this.ctx.app.events.subscribe('note:opened', (event) => {
        console.log(event.path);
      }),
    );
  }
}
```

## API 分组

| 分组                            | 能力                                                                      |
| ------------------------------- | ------------------------------------------------------------------------- |
| `app.vault`                     | `read`、`list`、`create`、`modify`、`delete`、`rename`、`getMetadata`     |
| `app.commands`                  | `register`，快捷键用 `Hotkey` 或 `Mod+Shift+H`                            |
| `app.views`                     | 侧栏、标签页、状态栏、设置页                                              |
| `app.editor`                    | CodeMirror 扩展、代码块渲染器、当前编辑器                                 |
| `app.ai`                        | `chat`、`complete`（带 `citations`）、`registerTool`                      |
| `app.events`                    | 订阅或取消 `note:created` / `modified` / `opened` / `renamed` / `deleted` |
| `app.clipboard` / `app.network` | 对应权限的剪贴板和代发请求                                                |

生命周期是 `onload` 和 `onunload`。`onload` 里拿到的注册项放进 `ctx.subscriptions`，宿主会在 `onunload` 之后释放。

## 沙箱 RPC

社区插件跑在 iframe 或 Web Worker 里。消息信封：

```ts
interface RpcRequest {
  protocol: 'ai-notes.plugin-rpc';
  version: 'preview-v1';
  pluginId: string;
  id: string;
  kind: 'request' | 'response' | 'event' | 'error';
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: string; message: string };
}
```

`kind: "request"` 的 `method` 例如 `vault.read`、`ai.chat`。响应用同一个 `id`。笔记变化是 `kind: "event"`，`method` 为 `note:created` 这一类。

函数和 CodeMirror 的 Extension 不能放进 `postMessage`。命令、代码块渲染和 AI 工具的回调留在沙箱里，宿主用 `command.invoke`、`editor.renderCodeBlock`、`ai.tool.call` 调回来。`editor.registerExtension` 在 preview v1 只给同进程插件使用。

每个宿主方法需要的权限记在 `METHOD_PERMISSION` 里。`vault:read` 如果带了 `folders`，路径必须落在这些文件夹内（`isPathWithinFolders`）。

## 类型检查

这个包在 pnpm workspace 里，名字是 `@ai-notes/plugin-sdk`。在仓库根目录：

```bash
pnpm install
pnpm --filter @ai-notes/plugin-sdk typecheck
pnpm turbo run lint typecheck test build
```

`typecheck` 用仓库统一的严格 TypeScript 配置，覆盖 `src` 和 `examples`。构建产物在 `dist/`，其他包通过 workspace 引用它。
