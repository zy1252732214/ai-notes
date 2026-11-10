import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { chunkVecVirtualTableSql, createIndex, type VaultIndex } from './index.js';
import { openNodeDatabase } from './node-driver.js';

function openIndex(options?: { maxChars?: number; overlap?: number }): VaultIndex {
  return createIndex(openNodeDatabase(), options);
}

describe('VaultIndex', () => {
  it('indexes notes and returns ranked hits with snippets', () => {
    const index = openIndex();
    index.upsertNote({
      path: 'notes\\plan.md',
      content:
        '---\ntitle: "项目计划"\n---\n\n# 项目计划\n\n全文检索与向量索引是本地知识库的基础。\n',
      mtime: 1_700_000_000_000,
    });
    index.upsertNote({
      path: 'cook.md',
      content: '# 菜谱\n\n番茄炒蛋的做法很简单。\n',
      mtime: 10,
    });

    const note = index.getNote('notes/plan.md');
    expect(note?.title).toBe('项目计划');
    expect(note?.mtime).toBe(1_700_000_000_000);
    expect(note?.hash).toBe(
      createHash('sha256')
        .update(
          '---\ntitle: "项目计划"\n---\n\n# 项目计划\n\n全文检索与向量索引是本地知识库的基础。\n',
          'utf8',
        )
        .digest('hex'),
    );
    expect(note?.frontmatter).toEqual({ title: '项目计划' });

    const hits = index.search('全文检索');
    expect(hits).toHaveLength(1);
    const hit = hits[0];
    expect(hit?.path).toBe('notes/plan.md');
    expect(hit?.headingPath).toBe('项目计划');
    expect(hit?.snippet).toContain('<b>全文检索</b>');
    expect(hit?.text.slice(0, 20)).toContain('全文检索');
    expect(hit && hit.score).toBeGreaterThan(0);
    expect(index.search('番茄')).toHaveLength(1);
    expect(index.search('   ')).toEqual([]);
    index.close();
  });

  it('orders hits by descending score', () => {
    const index = openIndex();
    index.upsertNote({
      path: 'short.md',
      content: '量子计算入门\n',
      mtime: 1,
    });
    index.upsertNote({
      path: 'long.md',
      content: `${'无关的背景说明，讲的是园艺和天气。'.repeat(12)}这里才提到量子计算入门。\n`,
      mtime: 1,
    });
    const hits = index.search('量子计算入门');
    expect(hits.map((hit) => hit.path)).toContain('short.md');
    expect(hits.map((hit) => hit.path)).toContain('long.md');
    const scores = hits.map((hit) => hit.score);
    expect(scores).toEqual([...scores].sort((left, right) => right - left));
    expect(hits[0]?.path).toBe('short.md');
    index.close();
  });

  it('matches English case-insensitively and escapes FTS operators', () => {
    const index = openIndex();
    index.upsertNote({
      path: 'dev.md',
      content: '# Notes\n\nSQLite FTS5 full text search. THIS AND THAT. C++ rules. say "hello".\n',
      mtime: 1,
    });
    expect(index.search('full text').map((hit) => hit.path)).toEqual(['dev.md']);
    expect(index.search('fts5')).toHaveLength(1);
    expect(index.search('AND').length).toBeGreaterThan(0);
    expect(index.search('C++')).toHaveLength(1);
    expect(index.search('say "hello"')).toHaveLength(1);
    expect(() => index.search('OR')).not.toThrow();
    index.close();
  });

  it('finds a note by its file-name title when the body has no heading', () => {
    const index = openIndex();
    index.upsertNote({ path: 'ideas.md', content: '没有标题，只有正文。\n', mtime: 1 });
    expect(index.search('ideas')).toHaveLength(1);
    expect(index.getNote('ideas.md')?.title).toBe('ideas');
    index.close();
  });

  it('does not match CJK characters that are not adjacent', () => {
    const index = openIndex();
    index.upsertNote({ path: 'a.md', content: '全文检索指南\n', mtime: 1 });
    expect(index.search('文检')).toHaveLength(1);
    expect(index.search('检文')).toHaveLength(0);
    index.close();
  });

  it('reindexes a changed note and leaves an unchanged hash in place', () => {
    const index = openIndex();
    const content = '# 日记\n\n今天写了全文检索。\n';
    const created = index.upsertNote({ path: 'diary.md', content, mtime: 10 });
    expect(created.status).toBe('created');
    const before = index.chunksFor('diary.md').map((chunk) => chunk.id);
    const createdAt = index.getNote('diary.md')?.createdAt;

    const same = index.upsertNote({ path: 'diary.md', content, mtime: 99 });
    expect(same.status).toBe('unchanged');
    expect(index.chunksFor('diary.md').map((chunk) => chunk.id)).toEqual(before);
    expect(index.getNote('diary.md')?.mtime).toBe(99);
    expect(index.getNote('diary.md')?.createdAt).toBe(createdAt);
    expect(index.getNote('diary.md')?.updatedAt).toBe(createdAt);

    const updated = index.upsertNote({
      path: 'diary.md',
      content: '# 日记\n\n今天改成了向量检索。\n',
      mtime: 200,
    });
    expect(updated.status).toBe('updated');
    expect(index.search('全文检索')).toHaveLength(0);
    expect(index.search('向量检索')).toHaveLength(1);
    expect(index.getNote('diary.md')?.createdAt).toBe(createdAt);
    expect(index.getNote('diary.md')?.updatedAt).toBeGreaterThanOrEqual(createdAt ?? 0);
    expect(index.stats().chunks).toBe(updated.chunkCount);
    index.close();
  });

  it('deletes notes and drops their chunks, full-text rows, and vectors', () => {
    const driver = openNodeDatabase();
    const index = createIndex(driver);
    index.upsertNote({ path: 'gone.md', content: '# 临时\n\n这段会被删除。\n', mtime: 1 });
    const chunkId = index.chunksFor('gone.md')[0]?.id;
    expect(chunkId).toBeDefined();
    if (chunkId === undefined) return;
    index.setChunkVector(chunkId, 'demo-embed', [0.25, -1, 0.5]);
    expect(index.getChunkVector(chunkId)?.model).toBe('demo-embed');
    expect(index.getChunkVector(chunkId)?.embedding[0]).toBeCloseTo(0.25, 5);

    expect(index.deleteNote('gone.md')).toBe(true);
    expect(index.deleteNote('gone.md')).toBe(false);
    expect(index.search('会被删除')).toEqual([]);
    expect(index.getNote('gone.md')).toBeUndefined();
    expect(driver.get('SELECT id FROM chunks')).toBeUndefined();
    expect(driver.get('SELECT rowid FROM chunks_fts')).toBeUndefined();
    expect(driver.get('SELECT chunk_id FROM chunk_vectors')).toBeUndefined();
    index.close();
  });

  it('sync adds, updates, and deletes against a vault snapshot', () => {
    const index = openIndex();
    const first = index.sync([
      { path: 'a.md', content: '# A\n\nalpha signal\n', mtime: 1 },
      { path: './b.md', content: '# B\n\nbeta signal\n', mtime: 1 },
      { path: 'a.md', content: '# A\n\nalpha signal revised\n', mtime: 2 },
    ]);
    expect(first).toEqual({ created: 2, updated: 0, deleted: 0, unchanged: 0 });
    expect(index.getNote('a.md')?.mtime).toBe(2);
    expect(index.search('revised')).toHaveLength(1);

    const second = index.sync([
      { path: 'a.md', content: '# A\n\nalpha signal revised\n', mtime: 3 },
      { path: 'c.md', content: '# C\n\ngamma signal\n', mtime: 1 },
    ]);
    expect(second).toEqual({ created: 1, updated: 0, deleted: 1, unchanged: 1 });
    expect(index.listNotes().map((note) => note.path)).toEqual(['a.md', 'c.md']);
    expect(index.search('beta')).toEqual([]);

    expect(index.sync([])).toMatchObject({ deleted: 2 });
    expect(index.stats()).toEqual({ notes: 0, chunks: 0 });
    index.close();
  });

  it('rejects paths that escape the vault', () => {
    const index = openIndex();
    expect(() => index.upsertNote({ path: '../secret.md', content: 'x', mtime: 1 })).toThrow(
      /Invalid note path/,
    );
    expect(() => index.upsertNote({ path: '', content: 'x', mtime: 1 })).toThrow(
      /Invalid note path/,
    );
    index.close();
  });

  it('rebuilds the full-text index from chunk rows', () => {
    const driver = openNodeDatabase();
    const index = createIndex(driver);
    index.upsertNote({ path: 'a.md', content: '可重建的全文内容。\n', mtime: 1 });
    const chunkId = index.chunksFor('a.md')[0]?.id;
    expect(chunkId).toBeDefined();
    driver.run('DELETE FROM chunks_fts WHERE rowid = ?', [chunkId ?? 0]);
    expect(index.search('全文内容')).toHaveLength(0);
    index.rebuildFullTextIndex();
    expect(index.search('全文内容').map((hit) => hit.path)).toEqual(['a.md']);
    index.close();
  });

  it('records and summarizes token usage', () => {
    const index = openIndex();
    index.recordUsage({
      date: '2026-11-04',
      provider: 'ollama',
      model: 'llama3.2',
      feature: 'chat',
      tokensIn: 10,
      tokensOut: 4,
    });
    index.recordUsage({
      date: '2026-11-04',
      provider: 'ollama',
      model: 'llama3.2',
      feature: 'chat',
      tokensIn: 2,
      tokensOut: 1,
    });
    index.recordUsage({
      date: '2026-11-03',
      provider: 'openai',
      model: 'gpt-4o-mini',
      feature: 'embed',
      tokensIn: 8,
      tokensOut: 0,
    });
    expect(index.summarizeUsage({ from: '2026-11-04', to: '2026-11-04' })).toEqual([
      {
        date: '2026-11-04',
        provider: 'ollama',
        model: 'llama3.2',
        feature: 'chat',
        tokensIn: 12,
        tokensOut: 5,
      },
    ]);
    index.close();
  });

  it('keeps backlinks current as notes are edited, renamed, and deleted', () => {
    const index = openIndex();
    index.upsertNote({
      path: '欢迎.md',
      content: '# 欢迎\n\n相关笔记：[[周报]]、[[项目/计划]]\n',
      mtime: 1,
    });
    index.upsertNote({ path: '日常/周报.md', content: '# 周报\n\n正文\n', mtime: 1 });
    index.upsertNote({ path: '项目/计划.md', content: '# 计划\n\n见 [[欢迎]]。\n', mtime: 1 });
    expect(index.backlinks('日常/周报.md').map((link) => [link.path, link.kind])).toEqual([
      ['欢迎.md', 'wikilink'],
    ]);
    expect(index.backlinks('欢迎.md').map((link) => link.path)).toEqual(['项目/计划.md']);

    index.upsertNote({ path: '欢迎.md', content: '# 欢迎\n\n只剩 [[项目/计划]]。\n', mtime: 2 });
    expect(index.backlinks('日常/周报.md')).toEqual([]);

    index.renamePath('项目/计划.md', '项目/路线.md');
    expect(index.backlinks('项目/路线.md').map((link) => link.path)).toEqual(['欢迎.md']);
    expect(index.backlinks('项目/计划.md')).toEqual([]);

    index.deletePath('日常');
    expect(index.search('正文')).toEqual([]);
    index.close();
  });

  it('describes a future sqlite-vec table without requiring the extension', () => {
    expect(chunkVecVirtualTableSql(768)).toContain('vec0');
    expect(chunkVecVirtualTableSql(768)).toContain('float[768]');
    expect(() => chunkVecVirtualTableSql(0)).toThrow(/dimensions/);
  });
});
