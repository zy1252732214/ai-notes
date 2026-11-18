import { describe, expect, it } from 'vitest';

import { MemoryIndex } from './memory.js';
import { toFtsOverlapQuery, toFtsQuery } from './segment.js';

describe('MemoryIndex incremental updates and backlinks', () => {
  it('tracks wiki links across add, edit, rename, and delete', () => {
    const index = new MemoryIndex();
    index.upsertNote({
      path: '欢迎.md',
      content: '# 欢迎\n\n相关笔记：[[周报]]、[[项目/计划]]\n',
      mtime: 1,
    });
    index.upsertNote({
      path: '日常/周报.md',
      content: '# 周报\n\n全文检索会索引这一段。\n',
      mtime: 1,
    });
    index.upsertNote({
      path: '项目/计划.md',
      content: '# 计划\n\n见 [[欢迎]]。\n',
      mtime: 1,
    });

    expect(index.backlinks('日常/周报.md').map((link) => link.path)).toEqual(['欢迎.md']);
    expect(index.backlinks('项目/计划.md').map((link) => link.path)).toEqual(['欢迎.md']);
    expect(index.backlinks('欢迎.md').map((link) => link.path)).toEqual(['项目/计划.md']);
    expect(index.search('全文检索').map((hit) => hit.path)).toEqual(['日常/周报.md']);
    expect(index.search('全文检索')[0]?.snippet).toContain('<b>全文检索</b>');

    const same = index.upsertNote({
      path: '欢迎.md',
      content: '# 欢迎\n\n相关笔记：[[周报]]、[[项目/计划]]\n',
      mtime: 2,
    });
    expect(same.status).toBe('unchanged');

    index.upsertNote({
      path: '欢迎.md',
      content: '# 欢迎\n\n只留下 [[项目/计划]]。\n',
      mtime: 3,
    });
    expect(index.backlinks('日常/周报.md')).toEqual([]);
    expect(index.search('全文检索')).toHaveLength(1);
    expect(index.search('只留下')).toHaveLength(1);

    expect(index.renamePath('项目/计划.md', '项目/路线.md')).toBe(1);
    expect(index.backlinks('项目/路线.md').map((link) => link.path)).toEqual(['欢迎.md']);
    expect(index.backlinks('项目/计划.md')).toEqual([]);

    expect(index.deletePath('日常')).toBe(1);
    expect(index.search('全文检索')).toEqual([]);
    index.deleteNote('欢迎.md');
    expect(index.backlinks('项目/路线.md')).toEqual([]);
  });

  it('answers a Chinese question from another note without embeddings', () => {
    const index = new MemoryIndex();
    index.upsertNote({
      path: '灯塔备忘.md',
      content: '# 灯塔备忘\n\n港口备用灯塔的口令是 BLUE-HERON-4417。这个口令只写在这篇笔记里。\n',
      mtime: 1,
    });
    index.upsertNote({
      path: '提问稿.md',
      content: '# 提问稿\n\n这是提问用的空笔记，里面没有口令。\n',
      mtime: 1,
    });
    index.upsertNote({ path: '园艺.md', content: '# 园艺\n\n今天浇水。\n', mtime: 1 });
    const hits = index.searchHybrid('备用灯塔口令是什么？请用笔记路径引用。', null, {
      limit: 5,
    });
    expect(hits[0]?.path).toBe('灯塔备忘.md');
    expect(hits[0]?.text).toContain('BLUE-HERON-4417');
    expect(hits.map((hit) => hit.path)).not.toContain('园艺.md');
    expect(index.search('火星基地发射窗口')).toEqual([]);
    expect(index.search('BLUE-HERON-4417').map((hit) => hit.path)).toEqual(['灯塔备忘.md']);
    expect(toFtsQuery('全文检索')).toBe('"全 文 检 索"');
    expect(toFtsOverlapQuery('什么？请用')).toBe('"什 么" OR "请 用"');
    expect(toFtsOverlapQuery('hello')).toBeUndefined();
    expect(toFtsOverlapQuery('口令" OR "a')).toBe('"OR" OR "口 令"');
  });

  it('still recalls the answer when a note copies the question', () => {
    const index = new MemoryIndex();
    const question = '备用灯塔口令是什么？请用笔记路径引用。';
    index.upsertNote({ path: '抄问句.md', content: `# 抄问句\n\n${question}\n`, mtime: 1 });
    index.upsertNote({
      path: '灯塔备忘.md',
      content: '# 灯塔备忘\n\n港口备用灯塔的口令是 BLUE-HERON-4417。这个口令只写在这篇笔记里。\n',
      mtime: 1,
    });
    index.upsertNote({
      path: '港口记录.md',
      content: '# 港口记录\n\n另一处也写着备用灯塔的口令，是 RED-GULL-2201。\n',
      mtime: 1,
    });
    index.upsertNote({ path: '园艺.md', content: '# 园艺\n\n今天浇水。\n', mtime: 1 });
    index.upsertNote({ path: '天气.md', content: '# 天气\n\n明天有雨。\n', mtime: 1 });
    const paths = index.search(question, { limit: 5 }).map((hit) => hit.path);
    expect(paths[0]).toBe('抄问句.md');
    expect(paths).toEqual(expect.arrayContaining(['灯塔备忘.md', '港口记录.md']));
    expect(paths).not.toEqual(expect.arrayContaining(['园艺.md', '天气.md']));
    expect(index.search('火星基地发射窗口')).toEqual([]);
  });
});
