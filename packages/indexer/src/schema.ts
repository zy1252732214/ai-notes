/**
 * Index schema aligned with the architecture data model:
 * notes, chunks, chunks_fts, chunk_vectors, usage.
 *
 * `chunk_vectors` stores a float32 blob. When sqlite-vec is loaded, the same
 * vectors are mirrored into the `chunk_vec` virtual table created by
 * {@link chunkVecVirtualTableSql}. The blob table is the source of truth:
 * hosts that cannot load the extension rank those blobs directly.
 * Tags, memories, and conversations belong to other packages and are not
 * created here. Statements use IF NOT EXISTS so they can share one file.
 */
export const INDEXER_SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  hash TEXT NOT NULL,
  mtime INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  frontmatter TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  heading_path TEXT NOT NULL,
  start INTEGER NOT NULL,
  "end" INTEGER NOT NULL,
  text TEXT NOT NULL,
  ordinal INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_note_id ON chunks(note_id);

CREATE TABLE IF NOT EXISTS links (
  src_note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  dst_path TEXT NOT NULL,
  dst_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('wikilink', 'markdown', 'embed', 'block')),
  PRIMARY KEY (src_note_id, dst_path, kind)
);

CREATE INDEX IF NOT EXISTS idx_links_dst_note ON links(dst_note_id);
CREATE INDEX IF NOT EXISTS idx_links_dst_path ON links(dst_path);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  text,
  heading_path,
  title,
  tokenize = "unicode61 remove_diacritics 2"
);

CREATE TABLE IF NOT EXISTS chunk_vectors (
  chunk_id INTEGER PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  dim INTEGER,
  embedding BLOB,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  feature TEXT NOT NULL,
  tokens_in INTEGER NOT NULL,
  tokens_out INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_lookup ON usage(date, provider, model, feature);

INSERT INTO schema_meta(key, value)
VALUES ('indexer_schema_version', '${INDEXER_SCHEMA_VERSION}')
ON CONFLICT(key) DO NOTHING;
`;

/**
 * sqlite-vec virtual table. Run it only after the host has loaded sqlite-vec.
 * `rowid` is the chunk id. `dimensions` must match the embedding model;
 * changing the dimension means dropping and rebuilding this table.
 * Distance is cosine, so a smaller `distance` is a closer chunk.
 */
export function chunkVecVirtualTableSql(dimensions: number): string {
  if (!Number.isInteger(dimensions) || dimensions <= 0 || dimensions > 8192) {
    throw new Error('dimensions must be a positive integer up to 8192');
  }
  return `CREATE VIRTUAL TABLE IF NOT EXISTS chunk_vec USING vec0(
  embedding float[${dimensions}] distance_metric=cosine
);`;
}
