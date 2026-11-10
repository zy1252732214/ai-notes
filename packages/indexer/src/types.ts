/** Primitive values accepted by {@link SqlDriver} statement parameters. */
export type SqlValue = string | number | bigint | Uint8Array | null;

export interface RunResult {
  changes: number;
  /** SQLite rowid of the last insert on this connection, or 0. */
  lastInsertRowid: number;
}

/**
 * Synchronous SQLite access used by the indexer.
 * Node ships an implementation ({@link openNodeDatabase}); a Tauri host can
 * implement the same methods with Rust commands. The indexer never imports a
 * concrete driver.
 */
export interface SqlDriver {
  exec(sql: string): void;
  run(sql: string, params?: readonly SqlValue[]): RunResult;
  get<T = Record<string, unknown>>(sql: string, params?: readonly SqlValue[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: readonly SqlValue[]): T[];
  transaction<T>(fn: () => T): T;
  close(): void;
}

export interface ChunkOptions {
  /** Maximum characters in one chunk. Default 500. */
  maxChars?: number;
  /**
   * Characters repeated from the end of the previous window.
   * Applies inside a heading section. Default 50. Must be less than `maxChars`.
   */
  overlap?: number;
}

/** One retrieval unit. `text` is always `source.slice(start, end)`. */
export interface Chunk {
  headingPath: string;
  start: number;
  end: number;
  text: string;
  ordinal: number;
}

export interface Frontmatter {
  data: Record<string, string>;
  /** Index in the source where the body begins. */
  end: number;
  raw: string;
}

export interface NoteInput {
  /** Vault-relative path. Separators are normalized to `/`. */
  path: string;
  content: string;
  /** File modification time in milliseconds. */
  mtime: number;
}

export interface NoteRecord {
  id: number;
  path: string;
  title: string;
  hash: string;
  mtime: number;
  createdAt: number;
  updatedAt: number;
  frontmatter: Record<string, string>;
}

export interface ChunkRecord {
  id: number;
  noteId: number;
  headingPath: string;
  start: number;
  end: number;
  text: string;
  ordinal: number;
}

export type UpsertStatus = 'created' | 'updated' | 'unchanged';

export interface UpsertResult {
  status: UpsertStatus;
  noteId: number;
  chunkCount: number;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
}

export interface SearchOptions {
  /** Default 20. Maximum 100. */
  limit?: number;
}

export interface HybridSearchOptions extends SearchOptions {
  /**
   * Embedding model id. Only vectors stored for this model are compared.
   * Omit to accept any stored vector whose dimension matches the query.
   */
  model?: string;
}

export type LinkKind = 'wikilink' | 'markdown' | 'embed' | 'block';

export interface Backlink {
  path: string;
  title: string;
  kind: LinkKind;
  dstPath: string;
}

export interface SearchHit {
  noteId: number;
  path: string;
  title: string;
  chunkId: number;
  headingPath: string;
  start: number;
  end: number;
  text: string;
  /** Original text with the match wrapped in `<b>` markers. */
  snippet: string;
  /** Higher is more relevant. */
  score: number;
}

export interface UsageInput {
  /** UTC calendar day `YYYY-MM-DD`. Defaults to today. */
  date?: string;
  provider: string;
  model: string;
  feature: string;
  tokensIn: number;
  tokensOut: number;
}

export interface UsageSummary {
  date: string;
  provider: string;
  model: string;
  feature: string;
  tokensIn: number;
  tokensOut: number;
}

export interface UsageFilter {
  from?: string;
  to?: string;
  provider?: string;
  feature?: string;
}

export interface ChunkVector {
  chunkId: number;
  model: string;
  dim: number;
  embedding: number[];
}

/** A chunk that still needs an embedding for the requested model. */
export interface PendingChunk {
  chunkId: number;
  path: string;
  headingPath: string;
  text: string;
}

export interface ChunkVectorWrite {
  chunkId: number;
  embedding: ArrayLike<number>;
}

export interface IndexStats {
  notes: number;
  chunks: number;
}
