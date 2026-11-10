# `@ai-notes/desktop`

Tauri 2 + Vite + React 桌面壳。笔记是 Vault 文件夹里的 `.md` 文件。产品说明在仓库根目录的 [README.md](../../README.md)，插件在 [docs/plugins](../../docs/plugins/README.md)。

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

浏览器打开 <http://localhost:1420>。第一次进入、还没打开笔记库、也还没保存模型设置时，引导会推荐「打开示例库」（只在内存里，不需要 API Key），并保留「打开本地文件夹」。打开过库或已经保存过模型设置后，仍是原来的「打开文件夹」和「打开示例库」。Chrome / Edge 可以用「打开文件夹」读写真实目录。本机 Ollama 若已在 `http://127.0.0.1:11434` 列出聊天模型，引导会预填模型设置，且不覆盖已有设置；连不上也不挡住示例库。

桌面窗口：

```bash
pnpm --filter @ai-notes/desktop dev
```

Linux 需要 WebKitGTK 4.1。`Ctrl/Cmd+S` 立即保存，停笔约 800ms 后自动保存。`Ctrl/Cmd+\` 收起文件树，`Ctrl/Cmd+J` 开关右侧面板，`Ctrl/Cmd+K` 打开命令面板。`Ctrl/Cmd+Shift+F` 全文搜索当前笔记库，结果带片段，点击后跳到命中位置。`Ctrl/Cmd+O` 按文件名模糊匹配并打开笔记。

右侧「链接」列出反向链接和文中的 `[[双链]]`，点击会打开对应笔记。编辑器里按住 Ctrl（macOS 为 Cmd）再单击双链才会跳转，普通单击只移动光标；按住修饰键悬停时，双链显示指针和下划线。右侧「问答」把当前笔记和检索片段交给 `@ai-notes/ai` 的模型路由，回答以流式输出，并附上可以点开的引用。提供方、接口地址、模型名和嵌入模型名在「模型设置」里，写入本机 `localStorage`。问答和嵌入共用的 API Key 在桌面端写入系统钥匙串（macOS Keychain、Windows 凭据管理器、Linux Secret Service）；浏览器和示例库没有钥匙串时，API Key 仍留在 `localStorage`。这些都不会写进笔记库。模型请求由界面里的 `fetch` 发给 `@ai-notes/ai` 路由；浏览器开发时，接口需要允许当前页面的来源（本机 Ollama 可设置 `OLLAMA_ORIGINS`）。浏览器开发模式的检索走内存索引，和桌面端的 `search` / `backlinks` 是同一套调用。

打开笔记库时，如果 `.ainotes/plugins/hello-notes` 还不存在，会写入示例插件。它在沙箱 iframe 里运行，命令面板里的「统计笔记数量」和 `Ctrl/Cmd+Shift+H` 会列出笔记数量。顶栏的插件按钮可以启用或禁用它。没有 `vault:write` 等权限的调用会被宿主拒绝。命令面板可以打开全文搜索，也可以运行插件命令。右侧同时有问答、反向链接和插件沙箱面板。

发版步骤见根目录 README。tag 必须是 `v` 加上 `src-tauri/tauri.conf.json` 的 `version`（当前 `0.1.0`，对应 tag `v0.1.0`）。流水线打的是 universal macOS dmg、Windows nsis/msi、Linux AppImage/deb。签名私钥和 updater 密钥只放在 GitHub Actions secrets，不要提交；没配密钥时仍会出未签名包。
