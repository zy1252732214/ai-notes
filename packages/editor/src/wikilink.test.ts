import { describe, expect, it } from 'vitest';
import { wikilinkAt } from './wikilink.js';

describe('wikilinkAt', () => {
  const source = '见 [[周报]] 和 [[项目/计划|别名]]。';

  it('returns the target when the offset sits inside the link', () => {
    const start = source.indexOf('[[周报]]');
    expect(wikilinkAt(source, start)).toBe('周报');
    expect(wikilinkAt(source, start + 3)).toBe('周报');
    expect(wikilinkAt(source, start + '[[周报]]'.length - 1)).toBe('周报');
  });

  it('keeps aliases and paths', () => {
    const start = source.indexOf('[[项目/计划|别名]]');
    expect(wikilinkAt(source, start + 4)).toBe('项目/计划|别名');
  });

  it('ignores text outside a link', () => {
    expect(wikilinkAt(source, 0)).toBeNull();
    expect(wikilinkAt(source, source.length)).toBeNull();
  });

  it('ignores links inside inline or fenced code', () => {
    const inline = '代码 `[[周报]]` 不是链接';
    expect(wikilinkAt(inline, inline.indexOf('周'))).toBeNull();
    const fenced = '```md\n[[周报]]\n```\n正文 [[计划]]';
    expect(wikilinkAt(fenced, fenced.indexOf('周'))).toBeNull();
    expect(wikilinkAt(fenced, fenced.lastIndexOf('计'))).toBe('计划');
  });
});
