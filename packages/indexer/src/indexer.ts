import { chunkMarkdown, extractTitle, parseFrontmatter } from './chunk.js';
import { contentHash } from './hash.js';
import { extractLinks, remapIndexPath, resolveDestination } from './links.js';
import { SCHEMA_SQL } from './schema.js';
import { segmentForSearch, toFtsQuery } from './segment.js';
import { buildSnippet, countOccurrences } from './snippet.js';
import type {
  ChunkOptions,
  ChunkRecord,
  ChunkVector,
  IndexStats,
  NoteInput,
  NoteRecord,
  Backlink,
  SearchHit,
  SearchOptions,
  SqlDriver,
  SqlValue,
  SyncResult,
  UpsertResult,
  UsageFilter,
  UsageInput,
  UsageSummary,
} from './types.js';
import { decodeFloat32, encodeFloat32 } from './vector.js';

export type IndexOptions = ChunkOptions;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface NoteRow {
  id: number;
  path: string;
  title: string;
  hash: string;
  mtime: number;
  createdAt: number;
  updatedAt: number;
  frontmatter: string;
}

interface ChunkRow {
  id: number;
  noteId: number;
  headingPath: string;
  start: number;
  end: number;
  text: string;
  ordinal: number;
}

export class VaultIndex {
  constructor(
    private readonly driver: SqlDriver,
    private readonly options: IndexOptions = {},
  ) {}

  upsertNote(input: NoteInput): UpsertResult {
    const path = normalizeNotePath(input.path);
    if (typeof input.content !== 'string') {
      throw new Error('content must be a string');
    }
    if (!Number.isFinite(input.mtime)) {
      throw new Error('mtime must be a finite number');
    }
    const mtime = Math.trunc(input.mtime);
    return this.driver.transaction(() => {
      const hash = contentHash(input.content);
      const existing = this.driver.get<{ id: number; hash: string }>(
        'SELECT id, hash FROM notes WHERE path = ?',
        [path],
      );
      if (existing && existing.hash === hash) {
        this.driver.run('UPDATE notes SET mtime = ? WHERE id = ?', [mtime, existing.id]);
        this.resolveLinks();
        const count = this.driver.get<{ n: number }>(
          'SELECT COUNT(*) AS n FROM chunks WHERE note_id = ?',
          [existing.id],
        );
        return { status: 'unchanged', noteId: existing.id, chunkCount: Number(count?.n ?? 0) };
      }

      const now = Date.now();
      const title = extractTitle(path, input.content);
      const frontmatter = JSON.stringify(parseFrontmatter(input.content)?.data ?? {});
      let noteId: number;
      let status: UpsertResult['status'];
      if (!existing) {
        const inserted = this.driver.run(
          `INSERT INTO notes(path, title, hash, mtime, created_at, updated_at, frontmatter)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [path, title, hash, mtime, now, now, frontmatter],
        );
        noteId = inserted.lastInsertRowid;
        status = 'created';
      } else {
        noteId = existing.id;
        status = 'updated';
        this.removeChunks(noteId);
        this.driver.run(
          `UPDATE notes
           SET title = ?, hash = ?, mtime = ?, updated_at = ?, frontmatter = ?
           WHERE id = ?`,
          [title, hash, mtime, now, frontmatter, noteId],
        );
      }
      const chunkCount = this.insertChunks(noteId, title, input.content);
      this.replaceLinks(noteId, input.content);
      return { status, noteId, chunkCount };
    });
  }

  deleteNote(path: string): boolean {
    const normalized = normalizeNotePath(path);
    return this.driver.transaction(() => {
      const existing = this.driver.get<{ id: number }>('SELECT id FROM notes WHERE path = ?', [
        normalized,
      ]);
      if (!existing) return false;
      this.removeChunks(existing.id);
      this.driver.run('DELETE FROM notes WHERE id = ?', [existing.id]);
      this.resolveLinks();
      return true;
    });
  }

  /** Delete a note, or every note inside a folder path. */
  deletePath(path: string): number {
    const normalized = normalizeNotePath(path);
    return this.driver.transaction(() => {
      const rows = this.driver.all<{ path: string }>('SELECT path FROM notes');
      let removed = 0;
      for (const row of rows) {
        if (row.path === normalized || row.path.startsWith(`${normalized}/`)) {
          if (this.deleteNote(row.path)) removed += 1;
        }
      }
      return removed;
    });
  }

  /** Move a note or folder prefix and retarget links that used the old path. */
  renamePath(from: string, to: string): number {
    const source = normalizeNotePath(from);
    const target = normalizeNotePath(to);
    if (source === target) return 0;
    return this.driver.transaction(() => {
      const notes = this.driver.all<{ id: number; path: string }>('SELECT id, path FROM notes');
      let moved = 0;
      for (const note of notes) {
        const next = remapIndexPath(note.path, source, target);
        if (next === note.path) continue;
        this.driver.run('UPDATE notes SET path = ? WHERE id = ?', [next, note.id]);
        moved += 1;
      }
      const links = this.driver.all<{
        src_note_id: number;
        dst_path: string;
        kind: string;
      }>('SELECT src_note_id, dst_path, kind FROM links');
      for (const link of links) {
        const next = remapIndexPath(link.dst_path, source, target);
        if (next === link.dst_path) continue;
        this.driver.run('DELETE FROM links WHERE src_note_id = ? AND dst_path = ? AND kind = ?', [
          link.src_note_id,
          link.dst_path,
          link.kind,
        ]);
        this.driver.run(
          `INSERT INTO links(src_note_id, dst_path, dst_note_id, kind) VALUES (?, ?, NULL, ?)
           ON CONFLICT(src_note_id, dst_path, kind) DO NOTHING`,
          [link.src_note_id, next, link.kind],
        );
      }
      this.resolveLinks();
      return moved;
    });
  }

  backlinks(path: string): Backlink[] {
    const normalized = normalizeNotePath(path);
    const notes = this.driver.all<{ id: number; path: string }>('SELECT id, path FROM notes');
    const basename = normalized.split('/').pop() ?? normalized;
    const sameName = notes.filter(
      (note) => note.path === basename || note.path.endsWith(`/${basename}`),
    );
    const noteId = notes.find((note) => note.path === normalized)?.id;
    const rows = this.driver.all<{
      path: string;
      title: string;
      kind: Backlink['kind'];
      dstPath: string;
      dstNoteId: number | null;
    }>(
      `SELECT n.path AS path, n.title AS title, l.kind AS kind,
              l.dst_path AS dstPath, l.dst_note_id AS dstNoteId
       FROM links l
       JOIN notes n ON n.id = l.src_note_id
       ORDER BY n.path, l.kind`,
    );
    return rows
      .filter((row) => {
        if (noteId !== undefined && row.dstNoteId === noteId) return true;
        if (row.dstPath === normalized) return true;
        return row.dstPath === basename && sameName.length === 1;
      })
      .map((row) => ({
        path: row.path,
        title: row.title,
        kind: row.kind,
        dstPath: row.dstPath,
      }));
  }

  /**
   * Reconcile the index with the vault snapshot. Notes absent from `notes`
   * are deleted. Duplicate paths keep the last entry.
   */
  sync(notes: readonly NoteInput[]): SyncResult {
    return this.driver.transaction(() => {
      const byPath = new Map<string, NoteInput>();
      for (const note of notes) {
        const path = normalizeNotePath(note.path);
        byPath.set(path, { ...note, path });
      }
      const result: SyncResult = { created: 0, updated: 0, deleted: 0, unchanged: 0 };
      for (const note of byPath.values()) {
        const upserted = this.upsertNote(note);
        result[upserted.status] += 1;
      }
      const existing = this.driver.all<{ path: string }>('SELECT path FROM notes');
      for (const row of existing) {
        if (!byPath.has(row.path)) {
          this.deleteNote(row.path);
          result.deleted += 1;
        }
      }
      return result;
    });
  }

  search(query: string, options: SearchOptions = {}): SearchHit[] {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const limit = options.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('limit must be an integer from 1 to 100');
    }
    const ftsQuery = toFtsQuery(trimmed);
    if (ftsQuery) {
      try {
        return this.searchFts(ftsQuery, trimmed, limit);
      } catch (error) {
        if (!isFtsError(error)) throw error;
      }
    }
    return this.searchLike(trimmed, limit);
  }

  getNote(path: string): NoteRecord | undefined {
    const row = this.driver.get<NoteRow>(
      `SELECT id, path, title, hash, mtime,
              created_at AS createdAt, updated_at AS updatedAt, frontmatter
       FROM notes WHERE path = ?`,
      [normalizeNotePath(path)],
    );
    return row ? mapNote(row) : undefined;
  }

  listNotes(): NoteRecord[] {
    return this.driver
      .all<NoteRow>(
        `SELECT id, path, title, hash, mtime,
                created_at AS createdAt, updated_at AS updatedAt, frontmatter
         FROM notes ORDER BY path`,
      )
      .map(mapNote);
  }

  chunksFor(path: string): ChunkRecord[] {
    return this.driver
      .all<ChunkRow>(
        `SELECT c.id AS id, c.note_id AS noteId, c.heading_path AS headingPath,
                c.start AS start, c."end" AS end, c.text AS text, c.ordinal AS ordinal
         FROM chunks c
         JOIN notes n ON n.id = c.note_id
         WHERE n.path = ?
         ORDER BY c.ordinal`,
        [normalizeNotePath(path)],
      )
      .map(mapChunk);
  }

  stats(): IndexStats {
    const notes = this.driver.get<{ n: number }>('SELECT COUNT(*) AS n FROM notes');
    const chunks = this.driver.get<{ n: number }>('SELECT COUNT(*) AS n FROM chunks');
    return { notes: Number(notes?.n ?? 0), chunks: Number(chunks?.n ?? 0) };
  }

  /** Replace the FTS rows from `chunks` and `notes`. Use after a manual repair. */
  rebuildFullTextIndex(): void {
    const rows = this.driver.all<{
      id: number;
      text: string;
      headingPath: string;
      title: string;
    }>(
      `SELECT c.id AS id, c.text AS text, c.heading_path AS headingPath, n.title AS title
       FROM chunks c JOIN notes n ON n.id = c.note_id ORDER BY c.id`,
    );
    this.driver.exec('DROP TABLE IF EXISTS chunks_fts;');
    this.driver.exec(`
      CREATE VIRTUAL TABLE chunks_fts USING fts5(
        text,
        heading_path,
        title,
        tokenize = "unicode61 remove_diacritics 2"
      );
    `);
    for (const row of rows) {
      this.insertFts(row.id, row.text, row.headingPath, row.title);
    }
  }

  setChunkVector(chunkId: number, model: string, embedding: ArrayLike<number>): void {
    if (!Number.isInteger(chunkId) || chunkId <= 0)
      throw new Error('chunkId must be a positive integer');
    if (!model.trim()) throw new Error('model is required');
    if (embedding.length === 0) throw new Error('embedding must not be empty');
    const chunk = this.driver.get<{ id: number }>('SELECT id FROM chunks WHERE id = ?', [chunkId]);
    if (!chunk) throw new Error(`Unknown chunk ${chunkId}`);
    const blob = encodeFloat32(embedding);
    this.driver.run(
      `INSERT INTO chunk_vectors(chunk_id, model, dim, embedding, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(chunk_id) DO UPDATE SET
         model = excluded.model,
         dim = excluded.dim,
         embedding = excluded.embedding,
         updated_at = excluded.updated_at`,
      [chunkId, model, embedding.length, blob, Date.now()],
    );
  }

  getChunkVector(chunkId: number): ChunkVector | undefined {
    const row = this.driver.get<{
      model: string;
      dim: number | null;
      embedding: Uint8Array | null;
    }>('SELECT model, dim, embedding FROM chunk_vectors WHERE chunk_id = ?', [chunkId]);
    if (!row || !row.embedding) return undefined;
    const embedding = decodeFloat32(row.embedding);
    return { chunkId, model: row.model, dim: row.dim ?? embedding.length, embedding };
  }

  recordUsage(entry: UsageInput): void {
    const date = entry.date ?? new Date().toISOString().slice(0, 10);
    if (!DATE_RE.test(date)) throw new Error('date must be YYYY-MM-DD');
    if (!entry.provider.trim() || !entry.model.trim() || !entry.feature.trim()) {
      throw new Error('provider, model, and feature are required');
    }
    if (!isCount(entry.tokensIn) || !isCount(entry.tokensOut)) {
      throw new Error('token counts must be non-negative integers');
    }
    this.driver.run(
      `INSERT INTO usage(date, provider, model, feature, tokens_in, tokens_out, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        date,
        entry.provider,
        entry.model,
        entry.feature,
        entry.tokensIn,
        entry.tokensOut,
        Date.now(),
      ],
    );
  }

  summarizeUsage(filter: UsageFilter = {}): UsageSummary[] {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (filter.from) {
      where.push('date >= ?');
      params.push(filter.from);
    }
    if (filter.to) {
      where.push('date <= ?');
      params.push(filter.to);
    }
    if (filter.provider) {
      where.push('provider = ?');
      params.push(filter.provider);
    }
    if (filter.feature) {
      where.push('feature = ?');
      params.push(filter.feature);
    }
    const rows = this.driver.all<{
      date: string;
      provider: string;
      model: string;
      feature: string;
      tokensIn: number;
      tokensOut: number;
    }>(
      `SELECT date, provider, model, feature,
              SUM(tokens_in) AS tokensIn, SUM(tokens_out) AS tokensOut
       FROM usage
       ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
       GROUP BY date, provider, model, feature
       ORDER BY date, provider, model, feature`,
      params,
    );
    return rows.map((row) => ({
      date: row.date,
      provider: row.provider,
      model: row.model,
      feature: row.feature,
      tokensIn: Number(row.tokensIn),
      tokensOut: Number(row.tokensOut),
    }));
  }

  close(): void {
    this.driver.close();
  }

  private replaceLinks(noteId: number, content: string): void {
    this.driver.run('DELETE FROM links WHERE src_note_id = ?', [noteId]);
    for (const link of extractLinks(content)) {
      this.driver.run(
        `INSERT INTO links(src_note_id, dst_path, dst_note_id, kind) VALUES (?, ?, NULL, ?)
         ON CONFLICT(src_note_id, dst_path, kind) DO NOTHING`,
        [noteId, link.dstPath, link.kind],
      );
    }
    this.resolveLinks();
  }

  private resolveLinks(): void {
    const notes = this.driver.all<{ id: number; path: string; title: string }>(
      'SELECT id, path, title FROM notes',
    );
    const links = this.driver.all<{
      src_note_id: number;
      dst_path: string;
      kind: string;
      dst_note_id: number | null;
    }>('SELECT src_note_id, dst_path, kind, dst_note_id FROM links');
    for (const link of links) {
      const resolved = resolveDestination(link.dst_path, notes);
      if ((link.dst_note_id ?? null) === resolved) continue;
      this.driver.run(
        'UPDATE links SET dst_note_id = ? WHERE src_note_id = ? AND dst_path = ? AND kind = ?',
        [resolved, link.src_note_id, link.dst_path, link.kind],
      );
    }
  }

  private insertChunks(noteId: number, title: string, content: string): number {
    const chunks = chunkMarkdown(content, this.options);
    for (const chunk of chunks) {
      const inserted = this.driver.run(
        `INSERT INTO chunks(note_id, heading_path, start, "end", text, ordinal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [noteId, chunk.headingPath, chunk.start, chunk.end, chunk.text, chunk.ordinal],
      );
      this.insertFts(inserted.lastInsertRowid, chunk.text, chunk.headingPath, title);
    }
    return chunks.length;
  }

  private insertFts(rowid: number, text: string, headingPath: string, title: string): void {
    this.driver.run(
      'INSERT INTO chunks_fts(rowid, text, heading_path, title) VALUES (?, ?, ?, ?)',
      [rowid, segmentForSearch(text), segmentForSearch(headingPath), segmentForSearch(title)],
    );
  }

  private removeChunks(noteId: number): void {
    const rows = this.driver.all<{ id: number }>('SELECT id FROM chunks WHERE note_id = ?', [
      noteId,
    ]);
    for (const row of rows) {
      this.driver.run('DELETE FROM chunks_fts WHERE rowid = ?', [row.id]);
    }
    this.driver.run('DELETE FROM chunks WHERE note_id = ?', [noteId]);
  }

  private searchFts(ftsQuery: string, rawQuery: string, limit: number): SearchHit[] {
    const rows = this.driver.all<FtsHitRow>(
      `SELECT c.id AS chunkId, c.note_id AS noteId, c.heading_path AS headingPath,
              c.start AS start, c."end" AS end, c.text AS text,
              n.path AS path, n.title AS title,
              -bm25(chunks_fts) AS score
       FROM chunks_fts
       JOIN chunks c ON c.id = chunks_fts.rowid
       JOIN notes n ON n.id = c.note_id
       WHERE chunks_fts MATCH ?
       ORDER BY score DESC, c.ordinal ASC
       LIMIT ?`,
      [ftsQuery, limit],
    );
    return rows.map((row) => ({
      noteId: Number(row.noteId),
      path: row.path,
      title: row.title,
      chunkId: Number(row.chunkId),
      headingPath: row.headingPath,
      start: Number(row.start),
      end: Number(row.end),
      text: row.text,
      snippet: buildSnippet(row.text, row.headingPath, row.title, rawQuery),
      score: Number(row.score),
    }));
  }

  private searchLike(query: string, limit: number): SearchHit[] {
    const pattern = toLikePattern(query.toLowerCase());
    const rows = this.driver.all<FtsHitRow>(
      `SELECT c.id AS chunkId, c.note_id AS noteId, c.heading_path AS headingPath,
              c.start AS start, c."end" AS end, c.text AS text,
              n.path AS path, n.title AS title,
              0 AS score
       FROM chunks c
       JOIN notes n ON n.id = c.note_id
       WHERE lower(c.text) LIKE ? ESCAPE '\\'
          OR lower(c.heading_path) LIKE ? ESCAPE '\\'
          OR lower(n.title) LIKE ? ESCAPE '\\'`,
      [pattern, pattern, pattern],
    );
    return rows
      .map((row) => {
        const score =
          countOccurrences(row.text, query) * 2 +
          countOccurrences(row.headingPath, query) +
          countOccurrences(row.title, query);
        return {
          noteId: Number(row.noteId),
          path: row.path,
          title: row.title,
          chunkId: Number(row.chunkId),
          headingPath: row.headingPath,
          start: Number(row.start),
          end: Number(row.end),
          text: row.text,
          snippet: buildSnippet(row.text, row.headingPath, row.title, query),
          score,
        };
      })
      .sort((left, right) => right.score - left.score || left.chunkId - right.chunkId)
      .slice(0, limit);
  }
}

interface FtsHitRow {
  chunkId: number;
  noteId: number;
  headingPath: string;
  start: number;
  end: number;
  text: string;
  path: string;
  title: string;
  score: number;
}

export function createIndex(driver: SqlDriver, options?: IndexOptions): VaultIndex {
  driver.exec('PRAGMA foreign_keys = ON;');
  driver.exec(SCHEMA_SQL);
  return new VaultIndex(driver, options);
}

export function normalizeNotePath(input: string): string {
  if (typeof input !== 'string') throw new Error('path must be a string');
  const parts = input
    .replaceAll('\\', '/')
    .trim()
    .split('/')
    .filter((part) => part.length > 0 && part !== '.');
  if (parts.length === 0 || parts.some((part) => part === '..')) {
    throw new Error(`Invalid note path: ${input}`);
  }
  return parts.join('/');
}

function mapNote(row: NoteRow): NoteRecord {
  return {
    id: Number(row.id),
    path: row.path,
    title: row.title,
    hash: row.hash,
    mtime: Number(row.mtime),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    frontmatter: parseFrontmatterJson(row.frontmatter),
  };
}

function mapChunk(row: ChunkRow): ChunkRecord {
  return {
    id: Number(row.id),
    noteId: Number(row.noteId),
    headingPath: row.headingPath,
    start: Number(row.start),
    end: Number(row.end),
    text: row.text,
    ordinal: Number(row.ordinal),
  };
}

function parseFrontmatterJson(raw: string): Record<string, string> {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const data: Record<string, string> = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string') data[key] = item;
    }
    return data;
  } catch {
    return {};
  }
}

function toLikePattern(query: string): string {
  const escaped = query.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
  return `%${escaped}%`;
}

function isFtsError(error: unknown): boolean {
  return error instanceof Error && /fts5:/i.test(error.message);
}

function isCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
