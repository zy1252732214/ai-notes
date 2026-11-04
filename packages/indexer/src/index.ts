export { chunkMarkdown, extractTitle, parseFrontmatter } from "./chunk.js";
export { openNodeDatabase, openVaultIndex } from "./node-driver.js";
export { contentHash } from "./hash.js";
export { createIndex, normalizeNotePath, VaultIndex } from "./indexer.js";
export type { IndexOptions } from "./indexer.js";
export { chunkVecVirtualTableSql, INDEXER_SCHEMA_VERSION, SCHEMA_SQL } from "./schema.js";
export { segmentForSearch, toFtsQuery } from "./segment.js";
export type {
  Chunk,
  ChunkOptions,
  ChunkRecord,
  ChunkVector,
  Frontmatter,
  IndexStats,
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
} from "./types.js";
