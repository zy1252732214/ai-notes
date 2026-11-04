import { describe, expect, it } from 'vitest';

import { chunkMarkdown, extractTitle, parseFrontmatter } from './index.js';

describe('parseFrontmatter', () => {
  it('reads a flat frontmatter block and the body offset', () => {
    const content = '---\ntitle: "项目计划"\nstatus: draft\n---\n\n# 项目计划\n';
    const frontmatter = parseFrontmatter(content);
    expect(frontmatter?.data).toEqual({ title: '项目计划', status: 'draft' });
    expect(content.slice(frontmatter?.end ?? 0).startsWith('\n# 项目计划')).toBe(true);
  });

  it('returns null when the opening fence is not closed', () => {
    expect(parseFrontmatter('---\ntitle: nope\n')).toBeNull();
  });

  it('accepts CRLF', () => {
    const content = '---\r\ntitle: 标题\r\n---\r\n正文\r\n';
    expect(parseFrontmatter(content)?.data.title).toBe('标题');
  });
});

describe('chunkMarkdown', () => {
  it('splits on ATX headings and keeps offsets exact', () => {
    const content = '# 项目计划\n\n简介。\n\n## 目标\n\n第一段。\n\n## 里程碑\n\n- 一项\n';
    const chunks = chunkMarkdown(content);
    expect(chunks.map((chunk) => chunk.headingPath)).toEqual([
      '项目计划',
      '项目计划 / 目标',
      '项目计划 / 里程碑',
    ]);
    for (const chunk of chunks) {
      expect(content.slice(chunk.start, chunk.end)).toBe(chunk.text);
      expect(chunk.ordinal).toBe(chunks.indexOf(chunk));
    }
    expect(chunks[0]?.start).toBe(0);
    expect(chunks.at(-1)?.end).toBe(content.length);
  });

  it('does not treat headings inside fenced code as sections', () => {
    const content = '# Real\n\n```\n# Fake\n```\n\n## Next\n\nbody\n';
    const paths = chunkMarkdown(content).map((chunk) => chunk.headingPath);
    expect(paths).toEqual(['Real', 'Real / Next']);
  });

  it('skips frontmatter and still points at the body', () => {
    const content = '---\ntitle: 标题\n---\n\n# 标题\n\n正文 Hello\n';
    const chunks = chunkMarkdown(content);
    expect(chunks.every((chunk) => !chunk.text.includes('title:'))).toBe(true);
    expect(chunks.some((chunk) => chunk.text.includes('正文 Hello'))).toBe(true);
    expect(chunks[0]?.start).toBe(content.indexOf('# 标题'));
  });

  it('windows long text with overlap', () => {
    const content = 'A'.repeat(250);
    const overlap = 20;
    const maxChars = 100;
    const chunks = chunkMarkdown(content, { maxChars, overlap });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text).toBe(content.slice(chunk.start, chunk.end));
      expect(chunk.text.length).toBeLessThanOrEqual(maxChars);
    }
    expect(chunks[0]?.start).toBe(0);
    expect(chunks.at(-1)?.end).toBe(content.length);
    for (let index = 0; index < chunks.length - 1; index += 1) {
      const previous = chunks[index];
      const next = chunks[index + 1];
      expect(previous).toBeDefined();
      expect(next).toBeDefined();
      if (!previous || !next) continue;
      expect(next.start).toBe(previous.end - overlap);
      expect(next.text.slice(0, overlap)).toBe(content.slice(previous.end - overlap, previous.end));
    }
  });

  it('prefers a paragraph boundary when a section exceeds the max size', () => {
    const paragraph = '段'.repeat(80);
    const content = `# 标题\n\n${paragraph}\n\n${paragraph}\n\n${paragraph}\n`;
    const chunks = chunkMarkdown(content, { maxChars: 200, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(content.slice(chunk.start, chunk.end)).toBe(chunk.text);
      expect(chunk.text.length).toBeLessThanOrEqual(200);
    }
    const broken = chunks.filter((chunk) => chunk.end < content.length);
    expect(broken.some((chunk) => content[chunk.end] === '\n')).toBe(true);
  });

  it('rejects an overlap that is larger than the window', () => {
    expect(() => chunkMarkdown('hello', { maxChars: 10, overlap: 10 })).toThrow(/overlap/);
  });
});

describe('extractTitle', () => {
  it('prefers frontmatter, then the first heading, then the file name', () => {
    expect(extractTitle('notes/a.md', '---\ntitle: 封面\n---\n# 别的\n')).toBe('封面');
    expect(extractTitle('notes/a.md', '# 第一篇\n\n正文\n')).toBe('第一篇');
    expect(extractTitle('folder/会议纪要.md', '没有标题\n')).toBe('会议纪要');
  });
});
