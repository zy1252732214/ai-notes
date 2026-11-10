import { describe, expect, it } from 'vitest';

import { MemoryIndex } from './memory.js';

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
});
