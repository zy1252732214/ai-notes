# Plugin Starter

可复制的插件骨架。它只做两件事：用 `vault.list` 数笔记，并在右侧侧栏显示这个数字。命令「示例：统计笔记数量」会把同一句话送到顶栏提示。

不要改这个目录本身。新建插件：

```bash
node scripts/create-plugin.mjs my-notes "My Notes"
pnpm install
pnpm --filter @ai-notes/plugin-my-notes test
pnpm --filter @ai-notes/plugin-my-notes build
```

`id` 只能是小写字母、数字、点和短横线。脚本会把模板复制到 `plugins/<id>/`，并换掉包名、清单 id 和命令 id。

装进某个笔记库：构建之后，把插件目录复制到 `<vault>/.ainotes/plugins/<id>/`。目录名必须和 `manifest.json` 的 `id` 一致。重新打开库，在顶栏的插件按钮里启用。

`src/main.ts` 可以 `export function` 给测试用。`pnpm build` 会生成 `dist/main.js`，并去掉那些额外导出。沙箱只接受一行 `import { definePlugin } from '@ai-notes/plugin-sdk'` 和一行 `export default`。说明见 [docs/plugins](../../docs/plugins/README.md)。
