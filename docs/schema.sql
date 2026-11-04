-- ai-notes 本地索引
-- 路径：<vault>/.ainotes/index.db
--
-- 本地 Markdown 是唯一事实来源。除下面三类外，删掉这个库可以从文件完整重建：
--   memories、conversations、messages、plugins（记忆、对话、插件授权与设置）
-- 这三类另存 JSON，便于同步，不从 Markdown 恢复：
--   <vault>/.ainotes/memories.json
--   <vault>/.ainotes/conversations.json
--   <vault>/.ainotes/plugins.json
-- usage 只是用量统计，丢了不影响笔记，也不从 Markdown 恢复。
--
-- 时间一律用 ISO-8601 UTC 文本。路径是 Vault 相对路径，用 /，不以 / 开头。
-- 应用每次打开连接时都要再执行 PRAGMA foreign_keys = ON。

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ---------------------------------------------------------------------------
-- notes：笔记元数据。正文在磁盘文件里，不放进数据库。
-- ---------------------------------------------------------------------------
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL CHECK (length(hash) > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  frontmatter TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(frontmatter))
);

CREATE INDEX idx_notes_updated_at ON notes (updated_at);

-- ---------------------------------------------------------------------------
-- chunks：按标题和段落切开的检索块，大约 500 字一块。
-- rowid 是稳定整数主键（INTEGER PRIMARY KEY 不会在 VACUUM 时被重写），
-- FTS 和向量表都用它做连接。id 是块的文本标识，给引用和 API 使用。
-- ---------------------------------------------------------------------------
CREATE TABLE chunks (
  rowid INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  note_id TEXT NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
  heading_path TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(heading_path)),
  start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
  end_offset INTEGER NOT NULL CHECK (end_offset >= start_offset),
  text TEXT NOT NULL,
  hash TEXT NOT NULL CHECK (length(hash) > 0),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  UNIQUE (note_id, ordinal)
);

-- ---------------------------------------------------------------------------
-- chunks_fts：FTS5 外部内容表，正文仍在 chunks.text，这里只存倒排索引。
-- tokenize=trigram 让中英文都能按子串检索，不依赖分词器。
-- 限制：trigram 忽略短于 3 个字符的查询（例如两个汉字）。索引可重建，
-- 以后可以换成分词器而不改笔记文件。
-- 同步靠下面的触发器。手动重建：
--   INSERT INTO chunks_fts(chunks_fts) VALUES ('rebuild');
-- ---------------------------------------------------------------------------
CREATE VIRTUAL TABLE chunks_fts USING fts5 (
  text,
  content = 'chunks',
  content_rowid = 'rowid',
  tokenize = 'trigram'
);

CREATE TRIGGER chunks_fts_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts (rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TRIGGER chunks_fts_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts (chunks_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;

CREATE TRIGGER chunks_fts_au AFTER UPDATE OF text ON chunks BEGIN
  INSERT INTO chunks_fts (chunks_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO chunks_fts (rowid, text) VALUES (new.rowid, new.text);
END;

-- ---------------------------------------------------------------------------
-- links：双链与反向链接。同一对来源、目标、种类只保留一行，不记录每次出现的偏移。
-- dst_note_id 是解析后的目标；目标笔记还不存在时为空，笔记被删时置空。
-- ---------------------------------------------------------------------------
CREATE TABLE links (
  src_note_id TEXT NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
  dst_path TEXT NOT NULL,
  dst_note_id TEXT REFERENCES notes (id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('wikilink', 'markdown', 'embed', 'block')),
  PRIMARY KEY (src_note_id, dst_path, kind)
);

CREATE INDEX idx_links_dst_note ON links (dst_note_id);
CREATE INDEX idx_links_dst_path ON links (dst_path);

-- ---------------------------------------------------------------------------
-- tags：标签，不含前导 #，大小写按笔记原文保留。
-- ---------------------------------------------------------------------------
CREATE TABLE tags (
  note_id TEXT NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
  tag TEXT NOT NULL CHECK (length(tag) > 0),
  PRIMARY KEY (note_id, tag)
);

CREATE INDEX idx_tags_tag ON tags (tag);

-- ---------------------------------------------------------------------------
-- memories：记忆卡片。scope = global | project | session。
-- scope_ref：project 时是文件夹路径，session 时是 conversations.id，global 时为空。
-- status = draft（待确认）| confirmed | dismissed。
-- 不可从 Markdown 重建。
-- ---------------------------------------------------------------------------
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'project', 'session')),
  scope_ref TEXT,
  content TEXT NOT NULL CHECK (length(content) > 0),
  source_note_id TEXT REFERENCES notes (id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed', 'dismissed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_memories_lookup ON memories (scope, scope_ref, status);

-- ---------------------------------------------------------------------------
-- conversations / messages：AI 对话。citations 是 JSON 数组，元素形状与
-- 插件 SDK 的 Citation 一致：
--   {"notePath","chunkId","headingPath","startOffset","endOffset","quote"}
-- 不可从 Markdown 重建。
-- ---------------------------------------------------------------------------
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  note_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_conversations_updated_at ON conversations (updated_at);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  citations TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(citations)),
  created_at TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  UNIQUE (conversation_id, ordinal)
);

-- ---------------------------------------------------------------------------
-- plugins：安装状态。granted_permissions 是权限对象的 JSON 数组，
-- settings 是插件自己的 JSON 对象。不可从 Markdown 重建。
-- ---------------------------------------------------------------------------
CREATE TABLE plugins (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  granted_permissions TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(granted_permissions)),
  settings TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings)),
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- usage：按天、提供方、模型、功能累计 token。功能例如 chat、complete、embed、tool。
-- ---------------------------------------------------------------------------
CREATE TABLE usage (
  date TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  feature TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_out INTEGER NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  PRIMARY KEY (date, provider, model, feature)
);

-- @@sqlite-vec@@
-- chunk_vectors：向量检索。必须先加载 sqlite-vec 扩展，否则这里会报 no such module: vec0。
--   SELECT load_extension('vec0');
-- vec0 没有外键。删掉 chunk 时，索引服务要同时删掉对应的向量行。
-- 嵌入维度在建表时写死。768 是首发本地模型（Ollama nomic-embed-text）的维度；
-- 换模型就 DROP 这张表，按新维度重建。model 列记下产生该向量的模型名。
-- chunk_id 对应 chunks.id。插入时把 chunks.rowid 用作本表的 rowid，便于和全文结果对齐：
--   INSERT INTO chunk_vectors (rowid, embedding, chunk_id, model) VALUES (?, ?, ?, ?);
-- 查询：
--   SELECT chunk_id, distance FROM chunk_vectors
--   WHERE embedding MATCH :query AND k = 10;
-- ---------------------------------------------------------------------------
CREATE VIRTUAL TABLE chunk_vectors USING vec0 (
  embedding float[768] distance_metric=cosine,
  chunk_id TEXT,
  model TEXT
);

PRAGMA user_version = 1;
