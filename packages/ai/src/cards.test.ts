import { MemoryIndex } from '@ai-notes/indexer';
import { describe, expect, it } from 'vitest';
import {
  applyReview,
  createCard,
  dueCards,
  extractHandwritten,
  intervalLabel,
  maskCloze,
  parseCard,
  parseGeneratedCards,
  planHandwrittenSync,
  remapCardSource,
  serializeCard,
  sourceSpanForDraft,
} from './cards.js';

const today = '2026-11-10';

function handwritten(content: string, path = '日常/周报.md') {
  return extractHandwritten(content, path);
}

describe('memory card files', () => {
  it('round-trips a card through markdown frontmatter', () => {
    const card = createCard({
      id: 'weekly-layout',
      origin: 'handwritten',
      kind: 'qa',
      prompt: '这周完成了哪三件事？',
      answer: '三栏布局、本地文件夹、Markdown 原文。',
      sourcePath: '日常/周报.md',
      sourceStart: 12,
      sourceEnd: 80,
      today,
    });
    const parsed = parseCard(serializeCard(card), card.path);
    expect(parsed).toEqual(card);
  });

  it('quotes titles that contain colons and ignores other notes', () => {
    const card = createCard({
      id: 'ratio',
      origin: 'manual',
      kind: 'qa',
      prompt: '比例是多少：1:2',
      answer: '一比二',
      today,
    });
    const parsed = parseCard(serializeCard(card), card.path);
    expect(parsed?.prompt).toBe('比例是多少：1:2');
    expect(parseCard('# 普通笔记\n\n没有卡片。\n', '笔记.md')).toBeNull();
  });
});

describe('handwritten card syntax', () => {
  const note = `
见 https://example.com/sm2 不是卡片。

\`\`\`ts
const hidden = "{{不要收}}";
const pair = "问题::答案";
\`\`\`

间隔重复算法::SM-2。第一次记住隔 1 天。

本地索引可以随时{{重建}}。

\`\`\`card
id: weekly-layout
Q: 这周完成了哪三件事？
可以换行吗
A: 搭好三栏布局
以及原文编辑
\`\`\`
`;

  it('reads qa lines, clozes, and fenced cards, skipping code fences', () => {
    const drafts = handwritten(note);
    expect(drafts.map((draft) => draft.kind)).toEqual(['qa', 'cloze', 'qa']);
    expect(drafts[0]).toMatchObject({
      prompt: '间隔重复算法',
      answer: 'SM-2。第一次记住隔 1 天。',
    });
    expect(drafts[1]).toMatchObject({ prompt: '本地索引可以随时{{重建}}。', answer: '重建' });
    expect(drafts[2]).toMatchObject({
      id: 'weekly-layout',
      prompt: '这周完成了哪三件事？\n可以换行吗',
      answer: '搭好三栏布局\n以及原文编辑',
    });
    expect(drafts[0]?.sourceStart).toBeGreaterThan(0);
    expect(drafts[2]?.sourceEnd).toBeGreaterThan(drafts[2]?.sourceStart ?? 0);
  });

  it('keeps the same id when the answer changes, and a new id when the prompt changes', () => {
    const first = handwritten('间隔重复算法::SM-2')[0];
    const edited = handwritten('间隔重复算法::SuperMemo 2')[0];
    const rewritten = handwritten('用什么算法::SM-2')[0];
    expect(edited?.id).toBe(first?.id);
    expect(rewritten?.id).not.toBe(first?.id);
  });

  it('does not collect cards from the card directory', () => {
    expect(extractHandwritten('问题::答案', '记忆/h1.md')).toEqual([]);
  });
});

describe('SM-2 review', () => {
  const card = createCard({
    id: 'ease',
    origin: 'manual',
    kind: 'qa',
    prompt: '问题',
    answer: '答案',
    today,
  });

  it('schedules the four grades differently on a new card', () => {
    expect(applyReview(card, 'again', today)).toMatchObject({
      interval: 0,
      repetitions: 0,
      lapses: 1,
      due: today,
      ease: 1.96,
    });
    expect(applyReview(card, 'hard', today)).toMatchObject({
      interval: 1,
      repetitions: 1,
      due: '2026-11-11',
      ease: 2.36,
    });
    expect(applyReview(card, 'good', today)).toMatchObject({
      interval: 3,
      repetitions: 1,
      due: '2026-11-13',
      ease: 2.5,
    });
    expect(applyReview(card, 'easy', today)).toMatchObject({
      interval: 7,
      repetitions: 1,
      due: '2026-11-17',
      ease: 2.6,
    });
    expect(intervalLabel(0)).toBe('今天');
    expect(intervalLabel(1)).toBe('明天');
    expect(intervalLabel(7)).toBe('7 天');
  });

  it('uses the previous ease for the next good interval and floors ease at 1.3', () => {
    const learned = applyReview(card, 'good', today);
    const again = applyReview(learned, 'good', '2026-11-13');
    expect(again.interval).toBe(Math.round(3 * 2.5));
    expect(again.repetitions).toBe(2);
    const stubborn = { ...card, ease: 1.3 };
    expect(applyReview(stubborn, 'again', today).ease).toBe(1.3);
  });

  it('lists cards due today and leaves future cards out', () => {
    const later = applyReview(card, 'good', today);
    expect(dueCards([later, card], today).map((item) => item.id)).toEqual(['ease']);
  });
});

describe('handwritten sync and source links', () => {
  const note = '间隔重复算法::SM-2\n\n```card\nid: weekly-layout\nQ: 三件事？\nA: 布局\n```\n';

  it('creates cards, preserves schedule, and drops syntax that disappeared', () => {
    const created = planHandwrittenSync([{ path: '日常/周报.md', content: note }], [], today);
    expect(created.upserts.map((card) => card.id)).toContain('weekly-layout');
    expect(created.upserts).toHaveLength(2);
    const reviewed = applyReview(
      created.upserts.find((card) => card.id === 'weekly-layout')!,
      'good',
      today,
    );
    const again = planHandwrittenSync(
      [{ path: '日常/周报.md', content: note.replace('布局', '三栏布局') }],
      [reviewed, created.upserts.find((card) => card.id !== 'weekly-layout')!],
      today,
    );
    expect(again.upserts).toHaveLength(1);
    expect(again.upserts[0]).toMatchObject({
      id: 'weekly-layout',
      answer: '三栏布局',
      ease: reviewed.ease,
      interval: reviewed.interval,
      repetitions: 1,
    });
    expect(again.removals).toEqual([]);

    const removed = planHandwrittenSync(
      [{ path: '日常/周报.md', content: '# 周报\n\n没有卡片了。\n' }],
      created.upserts,
      today,
    );
    expect(removed.removals).toHaveLength(2);
    expect(removed.upserts).toEqual([]);
  });

  it('keeps generated cards when the source note changes, and follows a rename', () => {
    const generated = createCard({
      id: 'gmodel',
      origin: 'generated',
      kind: 'qa',
      prompt: '模型生成的问题',
      answer: '答案',
      sourcePath: '日常/周报.md',
      sourceStart: 0,
      sourceEnd: 4,
      today,
    });
    const cleared = planHandwrittenSync(
      [{ path: '日常/周报.md', content: '# 空\n' }],
      [generated],
      today,
    );
    expect(cleared.removals).toEqual([]);
    expect(remapCardSource(generated, '日常/周报.md', '日常/回顾.md').sourcePath).toBe(
      '日常/回顾.md',
    );
    expect(remapCardSource(generated, '项目', '归档').sourcePath).toBe('日常/周报.md');
    const moved = remapCardSource({ ...generated, sourcePath: '项目/计划.md' }, '项目', '归档');
    expect(moved.sourcePath).toBe('归档/计划.md');
  });

  it('still matches a renamed note because the id does not include the path', () => {
    const first = planHandwrittenSync([{ path: '日常/周报.md', content: note }], [], today);
    const renamed = first.upserts.map((card) =>
      remapCardSource(card, '日常/周报.md', '日常/回顾.md'),
    );
    const second = planHandwrittenSync([{ path: '日常/回顾.md', content: note }], renamed, today);
    expect(second.upserts).toEqual([]);
    expect(second.removals).toEqual([]);
  });

  it('points a generated card at the matching sentence', () => {
    const source = '前言。\n\n间隔重复用的是 SM-2。\n\n后记。';
    expect(
      sourceSpanForDraft(
        source,
        { start: 0, end: source.length },
        {
          kind: 'qa',
          prompt: '用的是哪一版？',
          answer: 'SM-2',
        },
      ),
    ).toEqual({ start: source.indexOf('SM-2'), end: source.indexOf('SM-2') + 'SM-2'.length });
  });
});

describe('model output', () => {
  it('reads a fenced JSON array and a cards envelope', () => {
    expect(
      parseGeneratedCards(
        '```json\n[{"kind":"cloze","prompt":"唯一{{事实来源}}","answer":"事实来源"}]\n```',
      ),
    ).toEqual([{ kind: 'cloze', prompt: '唯一{{事实来源}}', answer: '事实来源' }]);
    expect(parseGeneratedCards('{"cards":[{"prompt":"问题","answer":"答案"}]}')).toEqual([
      { kind: 'qa', prompt: '问题', answer: '答案' },
    ]);
  });

  it('rejects an empty answer', () => {
    expect(() => parseGeneratedCards('没有 JSON')).toThrow(/没有返回卡片/);
    expect(() => parseGeneratedCards('[]')).toThrow(/没有返回可用的卡片/);
  });
});

describe('search', () => {
  it('indexes card markdown for keyword and hybrid lookup', () => {
    const card = createCard({
      id: 'sm2',
      origin: 'generated',
      kind: 'qa',
      prompt: '间隔重复用什么算法？',
      answer: 'SM-2，按记得的程度拉开下次复习。',
      sourcePath: '日常/周报.md',
      today,
    });
    const index = new MemoryIndex();
    index.upsertNote({ path: card.path, content: serializeCard(card), mtime: 1 });
    expect(index.search('SM-2')[0]?.path).toBe('记忆/sm2.md');
    expect(index.search('SM-2')[0]?.title).toContain('间隔重复');
    expect(index.searchHybrid('拉开下次复习', null)[0]?.path).toBe('记忆/sm2.md');
    index.setChunkVectors('demo', [
      { chunkId: index.search('SM-2')[0]!.chunkId, embedding: [1, 0] },
    ]);
    expect(index.searchHybrid('完全不同的问法', [1, 0], { model: 'demo' })[0]?.path).toBe(
      '记忆/sm2.md',
    );
  });
});

describe('cloze display', () => {
  it('hides the answer on the front of the card', () => {
    expect(maskCloze('本地索引可以随时{{重建}}。')).toBe('本地索引可以随时____。');
  });
});
