# v0.1.0 发布草稿 / launch drafts

这些是准备好可以贴出去的稿子。每种社区一份，口吻按那个社区来，不互相复用同一段广告。「贴出」下面的代码块才是正文，上面的说明留在这里。

现在没有 tag，也没有 GitHub Release。稿子里不要写成已经可以下载安装包。将来公开之后，下载入口是 <https://github.com/zy1252732214/ai-notes/releases>。本仓库不会替你发帖或打 tag。

Checked against `main` after #35 (selection contrast) and #36 (sqlite-vec 0.1.6 → 0.1.9). Those commits do not change the user-facing claims below. #36 only bumps the npm package; existing `vec0` tables still open.

## 文件

| File                                                       | Where                                            |
| ---------------------------------------------------------- | ------------------------------------------------ |
| [show-hn.md](show-hn.md)                                   | Hacker News title and first comment              |
| [reddit-obsidian-adjacent.md](reddit-obsidian-adjacent.md) | r/pkms or r/NoteTaking, plus a short reply only  |
| [reddit-selfhosted.md](reddit-selfhosted.md)               | r/selfhosted                                     |
| [reddit-localllama.md](reddit-localllama.md)               | r/LocalLLaMA                                     |
| [v2ex.md](v2ex.md)                                         | V2EX 分享创造                                    |
| [sspai-matrix.md](sspai-matrix.md)                         | 少数派 Matrix 投稿提纲，不是当天发出去的成稿     |
| [x-thread.md](x-thread.md)                                 | X thread                                         |
| [jike-weibo.md](jike-weibo.md)                             | 即刻 and 微博                                    |
| [product-hunt.md](product-hunt.md)                         | Product Hunt tagline, description, maker comment |
| [checklist.md](checklist.md)                               | Order, clocks, replies, unsigned-installer FAQ   |

## 可以写的事实

对照的是 v0.1.0 的 README、README.zh-CN、CHANGELOG、CONTRIBUTING、`docs/cards.md`、`docs/plugins` 和 release workflow。

- 笔记是你选的文件夹里的 Markdown。`<vault>/.ainotes/` 下的 SQLite 索引可以删掉重建。
- 编辑器是 CodeMirror 6，壳是 Tauri 2，界面是 React，文案是中文。
- 搜索是 SQLite FTS5。填了嵌入模型之后，桌面端才用 sqlite-vec。嵌入模型留空就只有全文。浏览器预览不会因此变成向量搜索。
- 问答带上当前笔记和检索到的片段，回答是流式的。回答里的 `[[路径]]` 可以点开。模型没写引用时，结束之后仍列出检索到的笔记。
- 只有第一次、而且尚未保存模型设置时，才探测 `http://127.0.0.1:11434` 的 `GET /api/tags`。不会执行 `ollama pull`。不会把嵌入模型当成聊天模型。装了 `nomic-embed-text` 只做建议，字段留空。
- OpenAI 兼容接口可用（OpenAI、DeepSeek、OpenRouter、LM Studio、Ollama 的 `/v1`）。桌面端 API Key 进系统钥匙串。浏览器预览没有钥匙串，Key 留在 `localStorage`。两种都不写进笔记库。
- 卡片是 `记忆/` 里的 Markdown，用 SM-2。手写 `问题::答案`、`{{挖空}}` 和 `card` 代码块会被收集。生成卡片是可选的。
- 插件跑在不带 `allow-same-origin` 的 iframe 里，清单声明六项权限。API 是 preview v1。
- 示例库在内存里。没有账号。许可证是 MIT。
- 还没有公开的安装包。`v*` tag 的 workflow 会把通用 macOS dmg、Windows NSIS 和 MSI、Linux AppImage 和 deb 上传成 draft，不会自动公开。没配签名密钥时，macOS 会是 ad-hoc 签名且没有公证，Windows 没有 Authenticode。没有自动更新。
- 0.1.0 没有：图谱、移动端、同步、插件市场、编辑器里的划词改写。`apps/web` 和 `server` 是占位。

`docs/architecture.md` 里还有以后的事（图谱、同步、托管额度、划词改写、插件目录）。不要写成已经能用。

不要加跑分、用户数、下载量。v0.1.0 没有遥测客户端。笔记正文离开这台机器，只发生在你把请求打到自己填的模型地址时，或者你给插件授予了 `network`、由宿主去访问清单里声明的域名时。

版本和地址以仓库配置为准，不要另写一个「差不多」的号：

| 写什么                      | 依据                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Node.js 26.13.0             | [`.nvmrc`](../../.nvmrc)                                                                               |
| pnpm 12.16.1                | 根目录 `package.json` 的 `packageManager`                                                              |
| 浏览器预览 `localhost:1420` | `apps/desktop/vite.config.ts` 的 `port`，以及 `tauri.conf.json` 的 `devUrl`                            |
| Ollama `127.0.0.1:11434`    | `apps/desktop/src/ai/ollamaDetect.ts` 的 `DEFAULT_OLLAMA_BASE_URL`                                     |
| 安装包页面来源              | README 写的是 `http://tauri.localhost`。`tauri.conf.json` 里没有单独的 origin 字段，不要把它说成配置项 |

引导文案里的例子只有 `http://localhost:1420`（`apps/desktop/src/onboarding/guide.ts`）。

## 图片

`docs/assets/demo.gif` 来自仓库里的 `docs/assets/demo.mp4`：裁掉开头的空白帧，拉到 12.5 秒，缩到 960×600，用 ffmpeg 调色板编码（`palettegen` / `paletteuse`，10 fps，无限循环）。大约 1.2 MB。两份 README 顶部用这张动图，mp4 链接保留。

`docs/assets/social-preview.png` 是 1280×640。底是暖纸 `#fbfaf8`，强调色是墨绿 `#3c6e62`，右侧是现成的 `sample-vault.png`，不是另画的界面。GitHub 不会自动用仓库里的这张图。需要仓库所有者在 Settings → General → Social preview 里手动上传。见 [checklist.md](checklist.md)。
