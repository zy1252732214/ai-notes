import { describe, expect, it } from 'vitest';

import { extractLinks, resolveDestination, wikilinkToPath } from './links.js';

describe('wikilinks', () => {
  it('reads aliases, headings, embeds, and block references', () => {
    const content = [
      '见 [[周报]]、[[项目/计划|计划]] 和 [[周报#这周]]。',
      '![[附件]]',
      '[[周报#^todo]]',
      '[原文](日常/周报.md)',
    ].join('\n');
    expect(extractLinks(content)).toEqual([
      { kind: 'wikilink', dstPath: '周报.md' },
      { kind: 'wikilink', dstPath: '项目/计划.md' },
      { kind: 'embed', dstPath: '附件.md' },
      { kind: 'block', dstPath: '周报.md' },
      { kind: 'markdown', dstPath: '日常/周报.md' },
    ]);
  });

  it('ignores links inside fenced or inline code', () => {
    const content = '见 `[[忽略]]`。\n\n```\n[[也不算]]\n```\n\n[[算]]\n';
    expect(extractLinks(content)).toEqual([{ kind: 'wikilink', dstPath: '算.md' }]);
  });

  it('rejects targets that leave the vault', () => {
    expect(wikilinkToPath('../secret')).toBe('');
    expect(wikilinkToPath('笔记')).toBe('笔记.md');
  });

  it('resolves a unique file name and an exact path', () => {
    const notes = [
      { id: 1, path: '日常/周报.md', title: '周报' },
      { id: 2, path: '项目/计划.md', title: '计划' },
    ];
    expect(resolveDestination('周报.md', notes)).toBe(1);
    expect(resolveDestination('项目/计划.md', notes)).toBe(2);
    expect(resolveDestination('缺失.md', notes)).toBeNull();
  });
});
