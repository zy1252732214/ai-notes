import { describe, expect, it } from 'vitest';
import { parseSnippet, stripSnippet } from './snippet.js';

describe('parseSnippet', () => {
  it('keeps the indexer highlight markers as marked pieces', () => {
    expect(parseSnippet('…搭好<b>三栏布局</b>…')).toEqual([
      { text: '…搭好', marked: false },
      { text: '三栏布局', marked: true },
      { text: '…', marked: false },
    ]);
  });

  it('leaves unbalanced markup as plain text', () => {
    expect(stripSnippet('没有<b>闭合')).toBe('没有<b>闭合');
    expect(stripSnippet('<b>三栏</b>布局')).toBe('三栏布局');
  });
});
