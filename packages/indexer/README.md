# @ai-notes/indexer

本地 Vault 的 Markdown 分块与 SQLite 全文索引。正文仍以文件为准，这个包只保存可重建的检索数据。

相关表是 `notes`、`chunks`、`chunks_fts`、`links`、`chunk_vectors`、`usage`。标签、记忆和对话以后再加到同一个库文件，建表语句都带 `IF NOT EXISTS`。

## 能力

- 按 ATX 标题分块。单块默认最多 500 字，同一标题内相邻块重叠 50 字。代码围栏里的 `#` 不会被当成标题。
- `notes` 保存 `path`、`title`、`hash`、`mtime`、`created_at`、`updated_at`、`frontmatter`。
- `chunks` 保存 `heading_path`、`start`、`end`、`text`。`text === content.slice(start, end)`。
- FTS5（`unicode61`）做排序检索。中日韩字符会先拆成单字再入库，因此两个字的词也能按短语命中。
- 哈希不变则跳过切块；内容变化只重写该笔记的块；`sync` 会删掉快照里已经不存在的笔记。
- 搜索返回分数（越大越相关）、`<b>` 包裹的摘要，以及块在原文中的偏移。
- 解析 `[[双链]]`、嵌入和块引用，写入 `links`。`backlinks(path)` 返回指向这篇笔记的来源。文件名唯一时，`[[周报]]` 能对上 `日常/周报.md`。
- `MemoryIndex` 提供同一套增量更新、搜索和反链，给浏览器开发模式用，不依赖 SQLite。
- `chunk_vectors` 保存 float32 嵌入。Node 驱动会加载 sqlite-vec，把同一批向量镜像到 `chunk_vec`（`vec0`，余弦距离）。扩展加载不了时，用这些 BLOB 做余弦相似度，检索不会停。
- `searchHybrid(query, embedding, { model })` 用 RRF 合并全文和向量。没有查询向量时结果与 `search` 相同。换模型或改维度会丢掉旧向量，只重嵌还没跟上的块。
- `pendingChunks(model)` 和 `fillMissingEmbeddings` 配合增量索引：内容没变不重嵌，修改会丢掉该笔记的旧向量，改名保留，删除一并删掉。
- SQLite 调用都走 `SqlDriver`。Node 用 `node:sqlite`；Tauri 可以实现同一接口，把 SQL 交给 Rust。

数据库建议放在 Vault 的 `.ainotes/index.db`。删掉这个文件即可重建索引。

## 用法

```ts
import { openVaultIndex } from '@ai-notes/indexer/node';

const index = openVaultIndex('/path/to/vault');

index.upsertNote({
  path: 'notes/plan.md',
  content: '# 计划\n\n全文检索与向量索引。\n',
  mtime: Date.now(),
});

const hits = index.search('全文检索', { limit: 8 });
// hits[0].path, hits[0].snippet, hits[0].start

index.recordUsage({
  provider: 'ollama',
  model: 'llama3.2',
  feature: 'chat',
  tokensIn: 120,
  tokensOut: 40,
});
```

不打开文件夹时，可以自己提供驱动：

```ts
import { createIndex } from '@ai-notes/indexer';
import { openNodeDatabase } from '@ai-notes/indexer/node';

const index = createIndex(openNodeDatabase(':memory:'), { maxChars: 500, overlap: 50 });
```

Tauri 侧只需要实现 `SqlDriver` 的 `exec` / `run` / `get` / `all` / `transaction` / `close`，再传给 `createIndex`。索引逻辑不依赖 Node 的数据库模块。

## 脚本

仓库使用 Node.js 26（见根目录 `.nvmrc`）。`node:sqlite` 自带 FTS5。测试、lint 和构建走仓库根上的共享配置：

```bash
pnpm --filter @ai-notes/indexer test
pnpm --filter @ai-notes/indexer typecheck
pnpm --filter @ai-notes/indexer lint
pnpm --filter @ai-notes/indexer build
```
