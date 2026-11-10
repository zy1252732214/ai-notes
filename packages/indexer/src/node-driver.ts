import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

import type { RunResult, SqlDriver, SqlValue } from './types.js';
import { createIndex, type IndexOptions, type VaultIndex } from './indexer.js';

interface Statement {
  run(...params: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: SqlValue[]): unknown;
  all(...params: SqlValue[]): unknown[];
}

/**
 * Node driver backed by `node:sqlite` (SQLite with FTS5). The repo runs on Node 26.
 * The class stays behind {@link SqlDriver} so Tauri can substitute its own.
 */
export function openNodeDatabase(filename: string = ':memory:'): SqlDriver {
  const db = new DatabaseSync(filename, { allowExtension: true });
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  if (filename !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  loadSqliteVec(db);
  return new NodeSqliteDriver(db);
}

/**
 * sqlite-vec is optional at runtime. `node:sqlite` can load it when the
 * platform package is installed. If it cannot, vector search uses the
 * float32 blobs in `chunk_vectors` instead of the `vec0` virtual table.
 */
function loadSqliteVec(db: DatabaseSync): void {
  try {
    db.enableLoadExtension(true);
    const required = createRequire(import.meta.url);
    const mod = required('sqlite-vec') as { getLoadablePath?: () => string };
    if (typeof mod.getLoadablePath !== 'function') return;
    db.loadExtension(mod.getLoadablePath());
  } catch {
    // Cosine ranking over chunk_vectors still works.
  } finally {
    try {
      db.enableLoadExtension(false);
    } catch {
      // Extension loading was already disabled.
    }
  }
}

/**
 * Open `.ainotes/index.db` inside a vault. The directory is created if needed.
 * Deleting that file drops the index; notes on disk stay the source of truth.
 */
export function openVaultIndex(vaultPath: string, options?: IndexOptions): VaultIndex {
  const directory = join(vaultPath, '.ainotes');
  mkdirSync(directory, { recursive: true });
  return createIndex(openNodeDatabase(join(directory, 'index.db')), options);
}

class NodeSqliteDriver implements SqlDriver {
  private depth = 0;

  constructor(private readonly db: DatabaseSync) {}

  exec(sql: string): void {
    this.db.exec(sql);
  }

  run(sql: string, params: readonly SqlValue[] = []): RunResult {
    const result = this.prepare(sql).run(...params);
    return {
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  get<T = Record<string, unknown>>(sql: string, params: readonly SqlValue[] = []): T | undefined {
    const row = this.prepare(sql).get(...params);
    if (row === undefined || row === null) return undefined;
    return { ...(row as Record<string, unknown>) } as T;
  }

  all<T = Record<string, unknown>>(sql: string, params: readonly SqlValue[] = []): T[] {
    return this.prepare(sql)
      .all(...params)
      .map((row) => ({ ...(row as Record<string, unknown>) }) as T);
  }

  transaction<T>(fn: () => T): T {
    if (this.depth > 0) {
      this.depth += 1;
      try {
        return fn();
      } finally {
        this.depth -= 1;
      }
    }
    this.depth = 1;
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const value = fn();
      this.db.exec('COMMIT;');
      return value;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // The transaction may already be closed.
      }
      throw error;
    } finally {
      this.depth = 0;
    }
  }

  close(): void {
    this.db.close();
  }

  private prepare(sql: string): Statement {
    return this.db.prepare(sql) as unknown as Statement;
  }
}
