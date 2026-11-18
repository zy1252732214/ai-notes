# V2EX 分享创造

节点用「分享创造」。标题不要加感叹号，正文第一句写明是自己做的。不要把 README 整篇贴进来。现在没有公开的安装包，正文不要写成已经可以下载。有人问起以后的未签名包时，再说明优先点「仍要打开」，xattr 只去掉这一份官方下载的隔离标记。

## 标题

```text
[分享创造] ai-notes 0.1.0：本地 Markdown 笔记，问答带引用，可接本机 Ollama
```

## 正文

```text
自己写的，MIT，桌面端是 Tauri 2。

笔记就是一个文件夹里的 .md。索引是这个文件夹下 .ainotes/ 里的 SQLite，删了可以重建。没有账号，也没有同步。要同步就自己拷文件夹，或者用你已有的 git / 网盘。

问答在右侧。会带上当前笔记和检索到的片段，回答是流式的，里面的 [[路径]] 可以点开。模型一个链接都没写的话，生成结束后仍会列出检索到的笔记。没配嵌入模型时，搜索只有全文（FTS5）。桌面端填了嵌入模型才会用 sqlite-vec。浏览器预览不会因此变成向量搜索。

Ollama：第一次打开、而且你还没保存过模型设置时，如果本机 http://127.0.0.1:11434 能列出模型（GET /api/tags），引导会填好一个已经安装的聊天模型。优先常见的小模型，比如 llama3.2、llama3.1 或 Qwen，不会把嵌入模型当成聊天模型。装了 nomic-embed-text 也只是建议，字段留空。程序不会执行 ollama pull。云端用 OpenAI 兼容接口就行（OpenAI、DeepSeek、OpenRouter、LM Studio，或者 Ollama 的 /v1）。桌面端的 API Key 进系统钥匙串（macOS 钥匙串、Windows 凭据管理器、Linux Secret Service），浏览器预览没有钥匙串，Key 留在 localStorage。两种都不会写进笔记库。

记忆卡片是 记忆/ 里的普通 Markdown，用 SM-2 复习。笔记里可以手写「问题::答案」、{{挖空}} 和 card 代码块。从笔记生成卡片是可选的，走你已经配好的模型。手写卡片、搜索、编辑都不需要模型。

插件跑在不带 allow-same-origin 的 iframe 里，清单里声明权限。API 还是 preview v1，1.0 之前会变。仓库里有 hello-notes、word-count、daily-notes 三个例子。

这一版没有：图谱、移动端、同步、插件市场、编辑器里划词改写。apps/web 和 server 是占位。界面是中文。没有自动更新，也没有做遥测客户端。

现在没有 tag，也没有 GitHub Release，所以没有可以下载的安装包。示例库在内存里，不需要 Key：

Node.js 26.13.0，pnpm 12.16.1
pnpm install
pnpm --filter @ai-notes/desktop exec vite
打开 http://localhost:1420

浏览器预览的地址是 http://localhost:1420，这是 Vite 的端口，也是 Tauri 的 devUrl。要连 Ollama 的话，把这个来源加进 OLLAMA_ORIGINS。README 还写了将来安装包页面的来源 http://tauri.localhost，现在用不到。

https://github.com/zy1252732214/ai-notes

如果引用对不上你手里的笔记，告诉我是哪一种情况就很有帮助。我没有速度或质量方面的测试数字。
```
