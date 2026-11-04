# `@ai-notes/desktop`

Tauri 2 + Vite + React 桌面壳。笔记是 Vault 文件夹里的 `.md` 文件。

## 脚本

`build` 只构建前端资源，CI 不会在每条 PR 上编译 Rust。安装包由 [`.github/workflows/release.yml`](../../.github/workflows/release.yml) 调用 `pnpm tauri build`。

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

`tauri.conf.json` 的 `beforeBuildCommand` 是 `pnpm build`，`beforeDevCommand` 是 `pnpm exec vite`，避免和 `dev`（`tauri dev`）互相调用。

## 本地运行

```bash
pnpm install
pnpm --filter @ai-notes/desktop exec vite
```

浏览器打开 <http://localhost:1420>。Chrome / Edge 可以用「打开文件夹」读写真实目录；「打开示例库」只在内存里。

桌面窗口：

```bash
pnpm --filter @ai-notes/desktop dev
```

Linux 需要 WebKitGTK 4.1。`Ctrl/Cmd+S` 立即保存，停笔约 800ms 后自动保存。`Ctrl/Cmd+\` 收起文件树，`Ctrl/Cmd+J` 开关右侧面板，`Ctrl/Cmd+K` 打开命令面板。

发布 tag 要和 `src-tauri/tauri.conf.json` 的 `version` 一致，当前是 `0.1.0`。签名私钥和 updater 密钥只放在 GitHub Actions secrets，不要提交。
