# `@ai-notes/desktop`

桌面壳的占位包。这里还不是 Tauri 应用，没有 `src-tauri/`，也没有 Vite 配置。前端工程师用 **Tauri 2 + Vite + React + CodeMirror 6** 替换它。

This package is a placeholder, not a Tauri app. There is no `src-tauri/` directory and no Vite config yet. The frontend engineer replaces it with Tauri 2, Vite, React, and CodeMirror 6.

## 替换之后建议保留的脚本

CI 的 `build` 只构建前端资源，不要把 `turbo build` 指到 `tauri build`，否则每条 PR 都会编译 Rust。原生安装包只走 [`.github/workflows/release.yml`](../../.github/workflows/release.yml)。

```json
{
  "scripts": {
    "dev": "tauri dev",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "tauri": "tauri",
    "lint": "eslint src --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --config ../../vitest.config.ts --root ."
  }
}
```

`tauri.conf.json` 的 `beforeBuildCommand` 用 `pnpm build` 生成前端资源。发布流水线在 `apps/desktop` 里执行 `pnpm tauri build`。

Keep `build` as the frontend asset build. `tauri build` belongs to the release workflow, with `beforeBuildCommand` set to `pnpm build`.

## 发布流水线要看到的文件

- `apps/desktop/src-tauri/tauri.conf.json`
- `package.json` 里的 `"tauri"` 脚本

在这两个文件出现之前，打 `v*` tag 会在检查步骤失败，并且不会创建 Release。

Updater 私钥和平台签名证书放在 GitHub Actions secrets，不要提交。公钥写在 `tauri.conf.json`。
