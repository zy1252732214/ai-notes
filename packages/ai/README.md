# @ai-notes/ai

笔记应用的模型路由。业务代码只依赖 `ModelProvider`（`chat`、`stream`、`embed`），不关心厂商协议。

## 提供方

- `OpenAICompatibleProvider`：OpenAI Chat Completions 与 Embeddings。`baseUrl` 指向 `/v1` 根路径即可接 OpenAI、DeepSeek、OpenRouter、LM Studio、Ollama 的 OpenAI 兼容端口等。
- `OllamaProvider`：本机 Ollama 的 `/api/chat` 与 `/api/embed`。默认 `http://127.0.0.1:11434`。

每次成功调用都会给出 token 用量。厂商没返回计数时按文本长度估算，并把 `usage.estimated` 设为 `true`。

`ModelRouter` 按顺序尝试提供方。网络错误、404、408、429 和 5xx 会换下一家；401/403 以及已经输出过文字的流不会悄悄换模型。用量通过 `onUsage` 或 `UsageStore` 交出，字段与索引库的 `usage` 表一致（`date`、`provider`、`model`、`feature`、`tokensIn`、`tokensOut`），可以直接交给 `@ai-notes/indexer` 的 `recordUsage`。

## 用法

```ts
import {
  MemoryUsageStore,
  ModelRouter,
  OllamaProvider,
  OpenAICompatibleProvider,
} from '@ai-notes/ai';

const usage = new MemoryUsageStore();
const router = new ModelRouter({
  providers: [
    new OpenAICompatibleProvider({
      id: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY,
      defaultModel: 'deepseek-chat',
    }),
    new OllamaProvider({ defaultModel: 'llama3.2' }),
  ],
  usageStore: usage,
});

for await (const event of router.stream(
  { messages: [{ role: 'user', content: '用一句话总结这段笔记' }], feature: 'chat' },
  { models: { deepseek: 'deepseek-chat', ollama: 'llama3.2' } },
)) {
  process.stdout.write(event.delta);
  if (event.done) console.log(event.usage);
}
```

回退时请用 `route.models` 给每个提供方自己的模型名。请求里的 `model` 会原样发给每一家，名字对不上时，404 才会继续尝试下一家。

传输用全局 `fetch`，测试可以传入自定义 `fetch`，不需要真的访问网络。

## 记忆卡片

卡片的解析、手写语法、SM-2 排期和模型输出都在这个包里，不碰磁盘。桌面端把结果写成库内的 `记忆/*.md`。约定见仓库的 [docs/cards.md](../../docs/cards.md)。

## 脚本

测试、lint 和构建走仓库根上的共享配置：

```bash
pnpm --filter @ai-notes/ai test
pnpm --filter @ai-notes/ai typecheck
pnpm --filter @ai-notes/ai lint
pnpm --filter @ai-notes/ai build
```
