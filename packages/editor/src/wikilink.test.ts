import { describe, expect, it } from 'vitest';
import { opensOnModifierClick, wikilinkAt, type PointerModifiers } from './wikilink.js';

function click(partial: Partial<PointerModifiers> = {}): PointerModifiers {
  return { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, ...partial };
}

describe('opensOnModifierClick', () => {
  it('opens on Command-click on Apple platforms', () => {
    expect(opensOnModifierClick(click({ metaKey: true }), 'MacIntel')).toBe(true);
    expect(opensOnModifierClick(click({ metaKey: true }), 'macOS')).toBe(true);
    expect(opensOnModifierClick(click({ metaKey: true }), 'iPad')).toBe(true);
  });

  it('opens on Control-click on other platforms', () => {
    expect(opensOnModifierClick(click({ ctrlKey: true }), 'Win32')).toBe(true);
    expect(opensOnModifierClick(click({ ctrlKey: true }), 'Windows')).toBe(true);
    expect(opensOnModifierClick(click({ ctrlKey: true }), 'Linux x86_64')).toBe(true);
  });

  it('does not treat the other platform modifier as a click-through', () => {
    expect(opensOnModifierClick(click({ ctrlKey: true }), 'MacIntel')).toBe(false);
    expect(opensOnModifierClick(click({ metaKey: true }), 'Win32')).toBe(false);
    expect(opensOnModifierClick(click({ metaKey: true }), 'Linux x86_64')).toBe(false);
  });

  it('leaves plain clicks, shift-clicks, and non-primary buttons for editing', () => {
    expect(opensOnModifierClick(click(), 'MacIntel')).toBe(false);
    expect(opensOnModifierClick(click(), 'Win32')).toBe(false);
    expect(opensOnModifierClick(click({ metaKey: true, shiftKey: true }), 'macOS')).toBe(false);
    expect(opensOnModifierClick(click({ ctrlKey: true, shiftKey: true }), 'Windows')).toBe(false);
    expect(opensOnModifierClick(click({ metaKey: true, button: 2 }), 'MacIntel')).toBe(false);
  });
});

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
