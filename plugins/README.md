# `plugins/`

一个目录一个插件。`pnpm-workspace.yaml` 已经包含 `plugins/*`：目录里有 `package.json` 之后，`pnpm install` 会把它算进工作区，Turbo 会跑它的 `build`、`lint`、`typecheck` 和 `test`。

用户侧的形态是：

```text
<vault>/.ainotes/plugins/<id>/
  manifest.json
  dist/main.js      # manifest.main 指向的文件
```

目录名必须等于清单里的 `id`。

| 目录                         | 状态                                                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`word-count`](word-count)   | 示例。侧栏字数和阅读时间。不会自动装进笔记库                                                                                                                            |
| [`daily-notes`](daily-notes) | 示例。创建 `日记/YYYY-MM-DD.md`。不会自动装进笔记库                                                                                                                     |
| `hello-notes`                | 在 [`packages/plugin-sdk/examples/hello-notes`](../packages/plugin-sdk/examples/hello-notes)。打开库时如果还没有这份插件，应用会把它写进 `.ainotes/plugins/hello-notes` |

网页剪藏、模板和 AI 摘要还没有做。新插件用 `node scripts/create-plugin.mjs <id> <name>`，从 [`templates/plugin-starter`](../templates/plugin-starter) 复制。文档在 [`docs/plugins`](../docs/plugins/README.md)。

Example plugins live in this folder. `word-count` and `daily-notes` are real workspace packages with tests; copy a built directory into a vault to enable them. `hello-notes` is installed by the desktop app when the vault does not already have it. Web clipper, templates, and AI summary are not implemented.
