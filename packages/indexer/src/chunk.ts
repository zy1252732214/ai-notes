import type { Chunk, ChunkOptions, Frontmatter } from './types.js';

const DEFAULT_MAX_CHARS = 500;
const DEFAULT_OVERLAP = 50;

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n)?/;
const HEADING_RE = /^( {0,3})(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;

interface LineSpan {
  start: number;
  text: string;
}

interface Section {
  headingPath: string;
  start: number;
  end: number;
}

interface Fence {
  char: '`' | '~';
  length: number;
}

export function parseFrontmatter(content: string): Frontmatter | null {
  if (!content.startsWith('---')) return null;
  const match = FRONTMATTER_RE.exec(content);
  if (!match) return null;
  const raw = match[1] ?? '';
  const data: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const pair = /^\s*([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const key = pair[1];
    if (!key) continue;
    data[key] = unquote(pair[2]?.trim() ?? '');
  }
  return { data, end: match[0].length, raw };
}

export function chunkMarkdown(content: string, options: ChunkOptions = {}): Chunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  if (!Number.isInteger(maxChars) || maxChars < 1) {
    throw new Error('maxChars must be a positive integer');
  }
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= maxChars) {
    throw new Error('overlap must be an integer greater than or equal to 0 and less than maxChars');
  }

  const frontmatter = parseFrontmatter(content);
  const sections = splitSections(content, frontmatter?.end ?? 0);
  const chunks: Chunk[] = [];
  for (const section of sections) {
    for (const span of windows(content, section.start, section.end, maxChars, overlap)) {
      const text = content.slice(span.start, span.end);
      if (text.trim().length === 0) continue;
      chunks.push({
        headingPath: section.headingPath,
        start: span.start,
        end: span.end,
        text,
        ordinal: chunks.length,
      });
    }
  }
  return chunks;
}

export function extractTitle(path: string, content: string): string {
  const frontmatter = parseFrontmatter(content);
  const fromFrontmatter = frontmatter?.data.title?.trim();
  if (fromFrontmatter) return fromFrontmatter;
  const sections = splitSections(content, frontmatter?.end ?? 0);
  const firstHeading = sections.find((section) => section.headingPath.length > 0);
  const ownTitle = firstHeading?.headingPath.split(' / ').pop()?.trim();
  if (ownTitle) return ownTitle;
  return fileTitle(path);
}

function fileTitle(path: string): string {
  const base = path.split('/').pop() ?? path;
  return base.replace(/\.md$/i, '') || path;
}

function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function linesOf(content: string, from: number): LineSpan[] {
  if (from >= content.length) return [];
  const lines: LineSpan[] = [];
  let cursor = from;
  while (cursor < content.length) {
    const newline = content.indexOf('\n', cursor);
    const end = newline === -1 ? content.length : newline;
    let textEnd = end;
    if (textEnd > cursor && content[textEnd - 1] === '\r') textEnd -= 1;
    lines.push({ start: cursor, text: content.slice(cursor, textEnd) });
    if (newline === -1) break;
    cursor = newline + 1;
  }
  return lines;
}

function splitSections(content: string, bodyStart: number): Section[] {
  const lines = linesOf(content, bodyStart);
  const stack: Array<{ level: number; title: string }> = [];
  const sections: Section[] = [];
  let currentStart = bodyStart;
  let currentPath = '';
  let fence: Fence | null = null;

  const push = (end: number): void => {
    if (end > currentStart) {
      sections.push({ headingPath: currentPath, start: currentStart, end });
    }
  };

  for (const line of lines) {
    if (fence) {
      if (closesFence(line.text, fence)) fence = null;
      continue;
    }
    const opened = openFence(line.text);
    if (opened) {
      fence = opened;
      continue;
    }
    const heading = HEADING_RE.exec(line.text);
    if (!heading) continue;
    push(line.start);
    const level = heading[2]?.length ?? 1;
    const title = heading[3]?.trim() ?? '';
    while (stack.length > 0 && (stack[stack.length - 1]?.level ?? 0) >= level) {
      stack.pop();
    }
    stack.push({ level, title });
    currentPath = stack.map((item) => item.title).join(' / ');
    currentStart = line.start;
  }
  push(content.length);
  return sections;
}

function openFence(line: string): Fence | null {
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) return null;
  const token = match[2] ?? '';
  const info = match[3] ?? '';
  const char = token[0];
  if (char !== '`' && char !== '~') return null;
  if (char === '`' && info.includes('`')) return null;
  return { char, length: token.length };
}

function closesFence(line: string, fence: Fence): boolean {
  const match = /^( {0,3})(`{3,}|~{3,})[ \t]*$/.exec(line);
  if (!match) return false;
  const token = match[2] ?? '';
  return token[0] === fence.char && token.length >= fence.length;
}

function windows(
  content: string,
  start: number,
  end: number,
  maxChars: number,
  overlap: number,
): Array<{ start: number; end: number }> {
  if (end - start <= maxChars) return [{ start, end }];
  const spans: Array<{ start: number; end: number }> = [];
  let cursor = start;
  while (cursor < end) {
    let chunkEnd = Math.min(end, cursor + maxChars);
    if (chunkEnd < end) {
      const snapped = snapEnd(content, cursor, chunkEnd);
      if (snapped > cursor) chunkEnd = snapped;
    }
    spans.push({ start: cursor, end: chunkEnd });
    if (chunkEnd >= end) break;
    const next = chunkEnd - overlap;
    cursor = next > cursor ? next : chunkEnd;
  }
  return spans;
}

function snapEnd(content: string, chunkStart: number, hardEnd: number): number {
  const window = content.slice(chunkStart, hardEnd);
  const min = Math.floor(window.length * 0.6);
  for (let index = window.length - 1; index >= min; index -= 1) {
    if (window.startsWith('\r\n\r\n', index) || window.startsWith('\n\n', index)) {
      return chunkStart + index;
    }
  }
  for (let index = window.length - 1; index >= min; index -= 1) {
    if (window[index] === '\n') return chunkStart + index;
  }
  return hardEnd;
}
