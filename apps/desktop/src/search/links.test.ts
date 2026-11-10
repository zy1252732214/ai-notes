import { describe, expect, it } from 'vitest';
import type { NoteName } from './fuzzy.js';
import { linkLabel, resolveNoteLink } from './links.js';

const files: NoteName[] = [
  { path: '欢迎.md', name: '欢迎.md' },
  { path: '日常/周报.md', name: '周报.md' },
  { path: '项目/计划.md', name: '计划.md' },
  { path: '归档/计划.md', name: '计划.md' },
];

describe('resolveNoteLink', () => {
  it('resolves a unique file name and an exact path', () => {
    expect(resolveNoteLink('周报', files)).toBe('日常/周报.md');
    expect(resolveNoteLink('[[项目/计划]]', files)).toBe('项目/计划.md');
    expect(resolveNoteLink('欢迎.md', files)).toBe('欢迎.md');
  });

  it('refuses an ambiguous file name and a missing note', () => {
    expect(resolveNoteLink('计划', files)).toBeNull();
    expect(resolveNoteLink('不存在', files)).toBeNull();
  });

  it('uses the alias as the visible label', () => {
    expect(linkLabel('周报|本周', '日常/周报.md')).toBe('本周');
    expect(linkLabel('项目/计划', '项目/计划.md')).toBe('计划');
  });
});
