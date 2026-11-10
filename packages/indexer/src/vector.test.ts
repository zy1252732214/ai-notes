import { describe, expect, it } from 'vitest';

import { embeddingDocument, fillMissingEmbeddings } from './embed.js';
import { createIndex, MemoryIndex, type VaultIndex } from './index.js';
import { openNodeDatabase } from './node-driver.js';
import { cosineSimilarity, fuseRanks } from './vector.js';

interface VectorHarness {
  upsertNote(input: { path: string; content: string; mtime: number }): { status: string };
  search(query: string): { path: string; score: number }[];
  searchHybrid(
    query: string,
    embedding: number[] | null,
    options?: { limit?: number; model?: string },
  ): { path: string; chunkId: number }[];
  pendingChunks(model: string): {
    chunkId: number;
    path: string;
    headingPath: string;
    text: string;
  }[];
  setChunkVectors(model: string, vectors: { chunkId: number; embedding: number[] }[]): void;
  renamePath(from: string, to: string): number;
  deleteNote(path: string): boolean;
  close?(): void;
}

function harnesses(): { name: string; open: () => VectorHarness }[] {
  return [
    { name: 'memory', open: () => new MemoryIndex() },
    {
      name: 'sqlite',
      open: () => {
        const driver = openNodeDatabase();
        const index = createIndex(driver);
        return index;
      },
    },
  ];
}

describe('vector ranking', () => {
  it('computes cosine similarity and reciprocal rank fusion', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [1])).toBe(0);
    const scores = fuseRanks([
      [1, 2],
      [2, 3],
    ]);
    expect(scores.get(2) ?? 0).toBeGreaterThan(scores.get(1) ?? 0);
    expect(scores.get(2) ?? 0).toBeGreaterThan(scores.get(3) ?? 0);
  });

  it('builds an embedding document from the heading and the chunk', () => {
    expect(embeddingDocument('计划 / 本周', '  写检索。 ')).toBe('计划 / 本周\n写检索。');
    expect(embeddingDocument('', '只有正文')).toBe('只有正文');
  });

  it.each(harnesses())(
    '$name keeps vectors in sync and merges them with keywords',
    async ({ open }) => {
      const index = open();
      index.upsertNote({
        path: 'notes/apple.md',
        content: '# 苹果\n\n这篇笔记专门讲苹果。\n',
        mtime: 1,
      });
      index.upsertNote({
        path: 'notes/keyword.md',
        content: '# 关键词\n\n检索检索检索，但是和向量无关。\n',
        mtime: 1,
      });
      index.upsertNote({
        path: 'notes/both.md',
        content: '# 两边\n\n这里也提到检索。\n',
        mtime: 1,
      });

      const written = await fillMissingEmbeddings(index, 'demo', {
        embed(texts) {
          return Promise.resolve(
            texts.map((text) => [
              text.includes('苹果') || text.includes('两边') ? 1 : 0,
              text.includes('苹果') || text.includes('两边') ? 0 : 1,
            ]),
          );
        },
      });
      expect(written).toBe(3);
      expect(index.pendingChunks('demo')).toEqual([]);

      const semantic = index.searchHybrid('完全没有共同的词', [1, 0], { model: 'demo', limit: 3 });
      expect(semantic.map((hit) => hit.path)).toContain('notes/apple.md');
      expect(semantic.map((hit) => hit.path)).not.toContain('notes/keyword.md');

      const hybrid = index.searchHybrid('检索', [1, 0], { model: 'demo', limit: 3 });
      expect(hybrid[0]?.path).toBe('notes/both.md');

      expect(index.searchHybrid('检索', null).map((hit) => hit.path)).toEqual(
        index.search('检索').map((hit) => hit.path),
      );

      const appleId = index
        .pendingChunks('other')
        .find((chunk) => chunk.path === 'notes/apple.md')?.chunkId;
      expect(appleId).toBeTypeOf('number');
      index.renamePath('notes/apple.md', 'notes/fruit.md');
      expect(index.pendingChunks('demo').map((chunk) => chunk.path)).not.toContain(
        'notes/fruit.md',
      );
      expect(index.searchHybrid('苹果', [1, 0], { model: 'demo' })[0]?.path).toBe('notes/fruit.md');

      index.upsertNote({
        path: 'notes/fruit.md',
        content: '# 水果\n\n改写成了另一件事。\n',
        mtime: 2,
      });
      expect(index.pendingChunks('demo').map((chunk) => chunk.path)).toContain('notes/fruit.md');
      expect(index.search('另一件事').map((hit) => hit.path)).toContain('notes/fruit.md');
      expect(
        index.searchHybrid('完全没有共同的词', [1, 0], { model: 'demo' }).map((hit) => hit.path),
      ).not.toContain('notes/fruit.md');

      index.deleteNote('notes/both.md');
      expect(
        index.searchHybrid('检索', [1, 0], { model: 'demo' }).map((hit) => hit.path),
      ).not.toContain('notes/both.md');
      index.close?.();
    },
  );

  it('queries sqlite-vec when the extension is loaded', () => {
    const driver = openNodeDatabase();
    const version = driver.get<{ v: string }>('SELECT vec_version() AS v');
    expect(version?.v).toMatch(/^v/);
    const index: VaultIndex = createIndex(driver);
    index.upsertNote({ path: 'a.md', content: '# A\n\n向量近邻。\n', mtime: 1 });
    index.upsertNote({ path: 'b.md', content: '# B\n\n另一个块。\n', mtime: 1 });
    const pending = index.pendingChunks('demo');
    index.setChunkVectors(
      'demo',
      pending.map((chunk) => ({
        chunkId: chunk.chunkId,
        embedding: chunk.path === 'a.md' ? [1, 0, 0] : [0, 1, 0],
      })),
    );
    const rows = driver.all<{ rowid: number }>('SELECT rowid FROM chunk_vec ORDER BY rowid');
    expect(rows).toHaveLength(2);
    expect(index.searchHybrid('不相关', [1, 0, 0], { model: 'demo' })[0]?.path).toBe('a.md');
    index.close();
  });
});
