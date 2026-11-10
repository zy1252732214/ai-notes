/** Stable workspace id. Desktop and web placeholders import this. */
export const packageId = '@ai-notes/indexer' as const;

export { chunkMarkdown, extractTitle, parseFrontmatter } from './chunk.js';
export { contentHash } from './hash.js';
export { createIndex, normalizeNotePath, VaultIndex } from './indexer.js';
export type { IndexOptions } from './indexer.js';
export { extractLinks, remapIndexPath, resolveDestination, wikilinkToPath } from './links.js';
export type { LinkNoteRef, ParsedLink } from './links.js';
export { MemoryIndex } from './memory.js';
export { chunkVecVirtualTableSql, INDEXER_SCHEMA_VERSION, SCHEMA_SQL } from './schema.js';
export { segmentForSearch, toFtsQuery } from './segment.js';
export type {
  Backlink,
  Chunk,
  ChunkOptions,
  ChunkRecord,
  ChunkVector,
  Frontmatter,
  IndexStats,
  LinkKind,
  NoteInput,
  NoteRecord,
  RunResult,
  SearchHit,
  SearchOptions,
  SqlDriver,
  SqlValue,
  SyncResult,
  UpsertResult,
  UpsertStatus,
  UsageFilter,
  UsageInput,
  UsageSummary,
} from './types.js';
