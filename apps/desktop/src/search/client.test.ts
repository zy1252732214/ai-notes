import { createSampleVault } from '@ai-notes/core';
import { describe, expect, it } from 'vitest';

import { createDesktopIndex } from './client';

describe('browser note index', () => {
  it('reindexes a vault and updates backlinks incrementally', async () => {
    const vault = createSampleVault();
    const index = createDesktopIndex(vault);
    await index.reindex();

    expect((await index.backlinks('日常/周报.md')).map((link) => link.path)).toEqual(['欢迎.md']);
    expect((await index.backlinks('项目/计划.md')).map((link) => link.path)).toEqual(['欢迎.md']);
    expect((await index.search('全文检索', 5)).map((hit) => hit.path)).toEqual(['日常/周报.md']);
    expect((await index.search('三栏布局', 5)).map((hit) => hit.path)).toEqual(['日常/周报.md']);
    expect((await index.search('三栏布局', 5))[0]?.snippet).toContain('<b>三栏布局</b>');

    await index.noteSaved('欢迎.md', '# 欢迎\n\n只保留 [[项目/计划]]。\n');
    expect(await index.backlinks('日常/周报.md')).toEqual([]);

    await index.noteRenamed('项目/计划.md', '项目/路线.md');
    expect((await index.backlinks('项目/路线.md')).map((link) => link.path)).toEqual(['欢迎.md']);

    await index.noteDeleted('项目');
    expect(await index.search('长期记忆')).toEqual([]);
    expect((await index.backlinks('项目/路线.md')).map((link) => link.path)).toEqual(['欢迎.md']);
    await index.noteDeleted('欢迎.md');
    expect(await index.backlinks('项目/路线.md')).toEqual([]);
  });
});
