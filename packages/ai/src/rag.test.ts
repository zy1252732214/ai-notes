import { describe, expect, it } from 'vitest';

import { citationsForAnswer, ragMessages, withActiveNote, type RagSource } from './rag.js';

const apple: RagSource = {
  chunkId: 4,
  path: '日常/周报.md',
  title: '周报',
  headingPath: '周报 / 下周',
  start: 20,
  end: 40,
  text: '下周要做全文检索。',
};

const plan: RagSource = {
  chunkId: 9,
  path: '项目/计划.md',
  title: '计划',
  headingPath: '计划',
  start: 0,
  end: 12,
  text: '本地文件是唯一事实来源。',
};

describe('rag prompt', () => {
  it('numbers sources and asks the model to cite them', () => {
    const messages = ragMessages('下周做什么？', [apple], '日常/周报.md');
    expect(messages[0]?.content).toContain('[1]');
    expect(messages[1]?.content).toContain('[1] 周报（日常/周报.md · 周报 / 下周）');
    expect(messages[1]?.content).toContain('下周要做全文检索。');
    expect(messages[1]?.content).toContain('用户正在查看：日常/周报.md');
    expect(messages[1]?.content).toContain('问题：下周做什么？');
  });

  it('says when retrieval found nothing', () => {
    const messages = ragMessages('你好', []);
    expect(messages[1]?.content).toContain('没有检索到笔记片段');
  });

  it('keeps the open note when retrieval missed it', () => {
    const active: RagSource = { ...plan, path: '欢迎.md', title: '欢迎', text: '欢迎使用。' };
    const sources = withActiveNote([apple], active, 6);
    expect(sources.map((source) => source.path)).toEqual(['欢迎.md', '日常/周报.md']);
    expect(
      withActiveNote([apple], { ...apple, text: '重复' }).map((source) => source.path),
    ).toEqual(['日常/周报.md']);
  });

  it('uses marked citations, and falls back to every source', () => {
    const marked = citationsForAnswer('下周要做全文检索 [1]。', [apple, plan]);
    expect(marked.map((citation) => citation.notePath)).toEqual(['日常/周报.md']);
    expect(marked[0]).toMatchObject({
      index: 1,
      chunkId: '4',
      headingPath: ['周报', '下周'],
      startOffset: 20,
      endOffset: 40,
      quote: '下周要做全文检索。',
    });

    const fallback = citationsForAnswer('笔记里没有找到依据。', [apple, plan]);
    expect(fallback.map((citation) => citation.index)).toEqual([1, 2]);

    const ignored = citationsForAnswer('见 [9] 和 [1]。', [apple]);
    expect(ignored.map((citation) => citation.index)).toEqual([1]);
  });
});
