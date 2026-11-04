# ai-notes

本地优先、AI 原生、可装插件的个人笔记。Markdown 文件是唯一事实来源，本地索引是 SQLite（FTS5 + sqlite-vec），桌面壳用 Tauri 2。工程底座是 pnpm workspace、Turborepo、统一的 TypeScript / ESLint / Prettier / Vitest，以及 CI 和桌面端发布流水线。桌面端已经能打开 Vault、编辑并保存 Markdown；索引、AI 和插件还是占位。

Local-first, AI-native personal notes with a plugin system. Markdown on disk is the source of truth, the local index is SQLite (FTS5 + sqlite-vec), and the desktop shell is Tauri 2. This repository is the engineering foundation: a pnpm workspace, Turborepo, shared TypeScript / ESLint / Prettier / Vitest, CI, and the desktop release pipeline. Product code is not here yet.

架构说明：<https://cursor.com/canvas/store-e7e07544-0652-4c60-8f1a-380775937fb2/6fc6f3f9-e11a-4c6e-a83a-61d3f41dfa9c>

## 仓库结构 / Layout

| 路径                   | 现在是什么                          | 谁来实现           | 职责                                       |
| ---------------------- | ----------------------------------- | ------------------ | ------------------------------------------ |
| `apps/desktop`         | Tauri 2 + Vite + React 壳           | 前端               | 文件树、编辑器、保存；SQLite 仍待索引模块  |
| `apps/web`             | TypeScript 占位，**不是** Vite 应用 | 前端               | Web 入口，复用 `packages/`                 |
| `apps/ui-preview`      | Vite 组件预览页                     | UI                 | 每个基础组件的状态，以及浅色 / 深色切换    |
| `packages/core`        | Vault 与可替换的文件系统            | 前端，架构师定接口 | 文件树、增删改名；文档模型与命令系统后续补 |
| `packages/editor`      | CodeMirror 6 Markdown 编辑器        | 前端               | 原文高亮、`[[双链]]`、Ctrl/Cmd+S           |
| `packages/indexer`     | 可编译的空包                        | 后端               | 分块、FTS5、sqlite-vec                     |
| `packages/ai`          | 可编译的空包                        | 后端               | 检索增强、记忆卡片、模型路由               |
| `packages/plugin-host` | 可编译的空包                        | 前端               | 沙箱、权限、RPC                            |
| `packages/plugin-sdk`  | 可编译的空包                        | 架构师 + 前端      | 对外插件 SDK 与类型                        |
| `packages/ui`          | 设计令牌、主题与基础组件            | UI                 | Button、表单、对话框、命令面板、聊天消息   |
| `plugins/*`            | 只有说明，还没有包                  | 前端               | 官方插件（每日笔记、剪藏、模板、AI 摘要）  |
| `server`               | TypeScript 占位                     | 后端实现，运维部署 | P2 账号与端到端加密同步                    |

依赖方向已经用 `workspace:*` 接上，Turbo 会按这个顺序构建：

```text
core, plugin-sdk, ui, server
  -> editor, indexer, plugin-host
    -> ai
      -> apps/desktop, apps/web
```

每个包导出的 `workspaceDependencies` 只为了把这张图锁在测试里，不是产品 API。开始写真正的模块时可以删掉它，并改对应的 `src/index.test.ts`。

`plugins/*` 已经写在 `pnpm-workspace.yaml` 里。新建 `plugins/<id>/package.json` 之后，安装和 Turbo 任务会自动带上它。

## 环境 / Prerequisites

- Node.js **26.13.0**（当前 Active LTS，代号 Lithium）。版本写在 [`.nvmrc`](.nvmrc)。
- pnpm **12.16.1**，由根 `package.json` 的 `packageManager` 锁定。
- Node 26 的 Linux 官方二进制链接了 `libatomic`。如果 `node` 起不来，先装 `libatomic1`。

```bash
nvm use
node -v   # v26.13.0
```

Node 26 不再默认附带 corepack。本地安装锁定的 pnpm：

```bash
npm install -g pnpm@12.16.1
pnpm -v   # 12.16.1
```

CI 不依赖这步，`pnpm/action-setup` 会按 `packageManager` 安装同一个版本。

TypeScript 固定在 **6.0.3**。当前 `typescript-eslint` 8 不支持 6.1 及以上（包括 TypeScript 7），所以先不要单独把 TypeScript 升到 7。

## 安装、开发、测试 / Install, dev, test

```bash
pnpm install
pnpm dev          # 库包 tsc --watch；桌面端是 tauri dev。只要浏览器时用 pnpm --filter @ai-notes/desktop exec vite
pnpm build        # turbo run build
pnpm test         # turbo run test
pnpm lint
pnpm typecheck
pnpm turbo run lint typecheck test
pnpm format
pnpm format:check
```

验收命令：

```bash
pnpm install && pnpm build && pnpm test
pnpm turbo run lint typecheck test
```

包脚本：

| 脚本        | 作用                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `build`     | `tsc -p tsconfig.build.json`，产物在 `dist/`，供工作区里别的包引用       |
| `dev`       | 同一个 `tsc` 的 watch 模式                                               |
| `lint`      | `eslint`（根目录 flat config）                                           |
| `typecheck` | `tsc --noEmit`，包含测试文件                                             |
| `test`      | Vitest。依赖包要先有 `dist/`，用根上的 `pnpm test` 时 Turbo 会先构建依赖 |

共享配置在仓库根上：`tsconfig.base.json`、`eslint.config.js`、`prettier.config.js`、`vitest.config.ts`。各包的 `tsconfig.json` 都 `extends` 这份 base。需要 DOM 的包（`editor`、`ui`、`desktop`、`web`）在自己的 tsconfig 里加了 `DOM` lib。

Vite 出现在 devDependencies 里，是因为 Vitest 5 把它列为 peer。桌面端的 `vite.config.ts` 只服务前端资源；`pnpm build` 不会跑 `tauri build`。

## 前端接桌面壳时要注意

`apps/desktop` 的 `build` 应继续表示**前端资源构建**（例如 `vite build`），不要改成 `tauri build`。否则 CI 的 `pnpm build` 会在每条 PR 上编译 Rust。

原生安装包只由发布流水线调用 `pnpm tauri build`。`tauri.conf.json` 用 `beforeBuildCommand` 去跑前端 `build`。细节见 [`apps/desktop/README.md`](apps/desktop/README.md)。

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) 在 PR 和 push 到 `main` 时运行：

1. `pnpm/action-setup` 安装 `packageManager` 里锁定的 pnpm，`actions/setup-node` 按 `.nvmrc` 装 Node，并缓存 pnpm store。
2. `pnpm install --frozen-lockfile`
3. `pnpm turbo run lint typecheck test build`
4. `pnpm format:check`

## 桌面端发布

[`.github/workflows/release.yml`](.github/workflows/release.yml) 在两种情况下触发：

- 推送符合 `v*` 的 tag，例如 `v0.1.0` 或 `v0.1.0-rc.1`
- Actions 页面里手动运行，并填写同样格式的 tag

矩阵会打四个包：macOS Apple Silicon、macOS Intel、Linux x64、Windows x64。`tauri-apps/tauri-action` 把产物上传到一个 **draft** GitHub Release，不会直接发布。

`apps/desktop/src-tauri/tauri.conf.json` 已经在仓库里，版本是 `0.1.0`。tag 要和这个版本对齐（`v0.1.0` 对应 `0.1.0`）。签名密钥仍然只放在 GitHub secrets 里；没配密钥时流水线打的是未签名包。

仓库需要把 Actions 的 workflow permissions 设成读写，`GITHUB_TOKEN` 才能创建 Release。

签名和自动更新只通过 GitHub Actions secrets 注入，仓库里没有密钥，也不要补一份假的：

| Secret                               | 用途                                        |
| ------------------------------------ | ------------------------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | Tauri updater 的 minisign 私钥              |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 上面那把私钥的密码                          |
| `APPLE_CERTIFICATE`                  | macOS 签名证书（base64 的 .p12）            |
| `APPLE_CERTIFICATE_PASSWORD`         | 证书密码                                    |
| `APPLE_SIGNING_IDENTITY`             | 签名身份                                    |
| `APPLE_ID`                           | 公证用的 Apple ID                           |
| `APPLE_PASSWORD`                     | Apple ID 的 app-specific password           |
| `APPLE_TEAM_ID`                      | Apple Team ID                               |
| `WINDOWS_CERTIFICATE`                | Windows Authenticode 证书（base64 的 .pfx） |
| `WINDOWS_CERTIFICATE_PASSWORD`       | .pfx 导出密码                               |

Updater 的**公钥**以后写在 `tauri.conf.json`，不要把私钥提交上来。这些 secret 都还没创建；留空时 macOS / Windows 会打未签名包，Windows 的证书导入步骤会跳过。没有 Apple 证书时，Apple Silicon 上从 GitHub 下载的包可能被系统标成已损坏，正式分发前需要补签名，或在 Tauri 配置里使用 ad-hoc identity。

Linux 依赖按 Tauri 2 的 Debian 前置要求安装在 `ubuntu-24.04` 上（WebKitGTK 4.1、ayatana appindicator，另加 AppImage 需要的 `patchelf`）。

## 依赖更新

[`.github/dependabot.yml`](.github/dependabot.yml) 每周一检查 npm（pnpm lockfile）和 GitHub Actions。minor / patch 会合成一个 PR，major 仍单独开。

## English

### Layout

`apps/desktop` is the Tauri 2 + Vite + React shell: open a folder, edit Markdown, and save it. `packages/core` is the vault filesystem port, and `packages/editor` is the CodeMirror 6 editor. `packages/ui` holds the design tokens and the base components; `apps/ui-preview` renders them. `apps/web`, indexer, AI, and plugins are still placeholders.

### Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm turbo run lint typecheck test
```

Node 26.13.0 LTS is pinned in `.nvmrc`. pnpm 12.16.1 is pinned in `packageManager`. TypeScript stays on 6.0.3 until `typescript-eslint` supports 6.1+ / 7.

### CI and release

CI runs on pull requests and pushes to `main`: frozen pnpm install, then Turbo `lint`, `typecheck`, `test`, and `build`, then Prettier. The release workflow runs on `v*` tags and manual dispatch. It builds macOS (arm64 and x64), Windows, and Linux bundles with `tauri-apps/tauri-action` and uploads them to a draft GitHub Release. `apps/desktop/src-tauri/tauri.conf.json` is present (`version` `0.1.0`). Code-signing and updater material belongs in GitHub secrets only; none are committed or invented here.

Keep the Turbo `build` task as a frontend asset build. Do not point it at `tauri build`.
