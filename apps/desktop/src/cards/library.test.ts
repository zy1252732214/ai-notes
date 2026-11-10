import { applyReview, createCard } from '@ai-notes/ai';
import { createSampleVault } from '@ai-notes/core';
import { describe, expect, it } from 'vitest';
import { sourceFromHit } from '../ai/ask';
import { createDesktopIndex, setEmbedderProvider } from '../search/client';
import {
  countDueCards,
  loadDueCards,
  readCards,
  remapCardSources,
  syncAllHandwritten,
  writeCards,
} from './library';

const today = '2026-11-10';

describe('card files in the vault', () => {
  it('collects the sample syntax, keeps the schedule, and follows a rename', async () => {
    const vault = createSampleVault();
    const created = await syncAllHandwritten(vault, today);
    expect(created.upserts.map((card) => card.id)).toContain('weekly-layout');
    expect(created.upserts).toHaveLength(3);
    expect(await countDueCards(vault, today)).toBe(3);

    const layout = (await readCards(vault)).find((card) => card.id === 'weekly-layout');
    expect(layout?.sourcePath).toBe('日常/周报.md');
    const reviewed = applyReview(layout!, 'good', today);
    await writeCards(vault, [reviewed]);
    const again = await syncAllHandwritten(vault, today);
    expect(again.upserts).toEqual([]);
    expect((await readCards(vault)).find((card) => card.id === 'weekly-layout')).toMatchObject({
      repetitions: 1,
      interval: 3,
      due: '2026-11-13',
    });
    expect(await countDueCards(vault, today)).toBe(2);

    await vault.rename('日常/周报.md', '日常/回顾.md');
    await remapCardSources(vault, '日常/周报.md', '日常/回顾.md');
    const moved = (await readCards(vault)).find((card) => card.id === 'weekly-layout');
    expect(moved?.sourcePath).toBe('日常/回顾.md');
    expect(await vault.readNote(moved!.path)).toContain('[[日常/回顾.md]]');

    await vault.delete('日常/回顾.md');
    expect((await readCards(vault)).find((card) => card.id === 'weekly-layout')?.sourcePath).toBe(
      '日常/回顾.md',
    );
  });

  it('puts card text into keyword search, hybrid search, and citations', async () => {
    setEmbedderProvider(() => ({
      model: 'demo',
      embed: (texts) =>
        Promise.resolve(texts.map((text) => (text.includes('SM-2') ? [1, 0] : [0, 1]))),
    }));
    try {
      const vault = createSampleVault();
      await syncAllHandwritten(vault, today);
      const index = createDesktopIndex(vault);
      await index.reindex();

      const keyword = await index.search('第一次记住隔', 5);
      const cardHit = keyword.find((hit) => hit.path.startsWith('记忆/'));
      expect(cardHit?.path).toMatch(/^记忆\/.+\.md$/);
      expect(sourceFromHit(cardHit!).path.startsWith('记忆/')).toBe(true);

      const hybrid = await index.searchHybrid('另一件完全无关的事', [1, 0], 5, 'demo');
      expect(hybrid.map((hit) => hit.path).some((path) => path.startsWith('记忆/'))).toBe(true);
      expect((await index.backlinks('日常/周报.md')).map((link) => link.path)).toContain(
        cardHit?.path,
      );
    } finally {
      setEmbedderProvider(null);
    }
  });

  it('drops a handwritten card when its syntax is removed and leaves generated cards', async () => {
    const vault = createSampleVault();
    await syncAllHandwritten(vault, today);
    await writeCards(vault, [
      createCard({
        id: 'gkept',
        origin: 'generated',
        kind: 'qa',
        prompt: '模型生成的问题',
        answer: '保留下来',
        sourcePath: '日常/周报.md',
        today,
      }),
    ]);
    expect((await loadDueCards(vault, today)).length).toBeGreaterThan(3);
    await vault.writeNote('日常/周报.md', '# 周报\n\n只剩正文。\n');
    const plan = await syncAllHandwritten(vault, today);
    expect(plan.removals).toHaveLength(3);
    expect((await readCards(vault)).map((card) => card.id)).toEqual(['gkept']);
  });
});
