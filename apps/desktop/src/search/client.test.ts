import { createSampleVault } from '@ai-notes/core';
import { describe, expect, it } from 'vitest';

import { createDesktopIndex, setEmbedderProvider } from './client';

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

  it('embeds new chunks and keeps vectors across a rename', async () => {
    setEmbedderProvider(() => ({
      model: 'demo',
      embed: (texts) =>
        Promise.resolve(texts.map((text) => (text.includes('三栏布局') ? [1, 0] : [0, 1]))),
    }));
    try {
      const vault = createSampleVault();
      const index = createDesktopIndex(vault);
      await index.reindex();
      const hits = await index.searchHybrid('没有关键词', [1, 0], 5, 'demo');
      expect(hits[0]?.path).toBe('日常/周报.md');
      await index.noteRenamed('日常/周报.md', '日常/回顾.md');
      const renamed = await index.searchHybrid('没有关键词', [1, 0], 5, 'demo');
      expect(renamed[0]?.path).toBe('日常/回顾.md');
      await index.noteDeleted('日常/回顾.md');
      expect(
        (await index.searchHybrid('没有关键词', [1, 0], 5, 'demo')).map((hit) => hit.path),
      ).not.toContain('日常/回顾.md');
    } finally {
      setEmbedderProvider(null);
    }
  });
});
