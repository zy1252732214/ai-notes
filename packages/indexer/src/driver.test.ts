import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createIndex, openNodeDatabase, openVaultIndex } from './index.js';

describe('SqlDriver', () => {
  it('rolls back a failed transaction, including nested work', () => {
    const driver = openNodeDatabase();
    driver.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT);');
    expect(() =>
      driver.transaction(() => {
        driver.run("INSERT INTO t(v) VALUES ('outer')");
        driver.transaction(() => {
          driver.run("INSERT INTO t(v) VALUES ('inner')");
        });
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(driver.all('SELECT v FROM t')).toEqual([]);
    driver.close();
  });

  it('opens a vault database at .ainotes/index.db', () => {
    const vault = mkdtempSync(path.join(tmpdir(), 'ainotes-vault-'));
    try {
      const index = openVaultIndex(vault);
      index.upsertNote({ path: 'a.md', content: '# A\n\nhello index\n', mtime: 1 });
      expect(index.search('hello').map((hit) => hit.path)).toEqual(['a.md']);
      index.close();
      const reopened = openVaultIndex(vault);
      expect(reopened.getNote('a.md')?.title).toBe('A');
      reopened.close();
    } finally {
      rmSync(vault, { recursive: true, force: true });
    }
  });
});

describe('schema migration', () => {
  const leftovers: Array<{ close(): void }> = [];
  afterEach(() => {
    for (const item of leftovers) item.close();
    leftovers.length = 0;
  });

  it('is idempotent and keeps previously indexed notes', () => {
    const driver = openNodeDatabase();
    const index = createIndex(driver);
    leftovers.push(index);
    index.upsertNote({ path: 'a.md', content: '全文检索已经建好了索引。\n', mtime: 1 });
    const again = createIndex(driver);
    expect(again.search('全文检索')).toHaveLength(1);
    const tables = driver
      .all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE name IN ('notes', 'chunks', 'chunks_fts', 'chunk_vectors', 'usage')",
      )
      .map((row) => row.name)
      .sort();
    expect(tables).toEqual(['chunk_vectors', 'chunks', 'chunks_fts', 'notes', 'usage']);
  });
});
