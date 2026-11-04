# `plugins/`

官方插件放在这里，一个插件一个目录。仓库已经把 `plugins/*` 配进 pnpm workspace：目录里出现 `package.json` 之后，`pnpm install` 会把它算进工作区，Turbo 也会跑它的 `build` / `lint` / `typecheck` / `test`。

按架构约定，插件对用户发布的形态是：

```text
plugins/<id>/
  manifest.json    # id、名称、版本、最低应用版本、权限、扩展点
  main.js
  styles.css       # 可选
```

开发期可以是工作区里的 TypeScript 包，打包产物再变成上面的 `main.js`。权限只从清单里声明：`vault:read`、`vault:write`、`ai:invoke`、`network`、`ui:panel`、`clipboard`。

首批官方插件（还没开始写）：每日笔记、网页剪藏、模板、AI 摘要。

Official plugins live here, one directory each. `plugins/*` is already a pnpm workspace glob, so a new `package.json` joins install and Turbo tasks. Shipped shape is `manifest.json` plus `main.js`. The first official plugins (not started) are daily notes, web clipper, templates, and AI summary.
