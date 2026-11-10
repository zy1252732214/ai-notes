import type { LinkKind } from './types.js';

export interface ParsedLink {
  kind: LinkKind;
  /** Vault-relative path, always ending in `.md`. */
  dstPath: string;
}

export interface LinkNoteRef {
  id: number;
  path: string;
  title: string;
}

const WIKILINK = /(!?)\[\[([^\]\n]+?)\]\]/g;
const MARKDOWN_LINK = /\[(?:\\\]|[^\]])*\]\(([^)\s]+)\)/g;

/** Pull wiki and markdown links out of a note, skipping fenced and inline code. */
export function extractLinks(content: string): ParsedLink[] {
  const source = maskCode(content);
  const found: ParsedLink[] = [];
  const seen = new Set<string>();
  for (const match of source.matchAll(WIKILINK)) {
    const link = parseWikilink(match[1] === '!', match[2] ?? '');
    if (!link) continue;
    const key = `${link.kind}\0${link.dstPath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(link);
  }
  for (const match of source.matchAll(MARKDOWN_LINK)) {
    const href = match[1] ?? '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
    const dstPath = wikilinkToPath(href);
    if (!dstPath) continue;
    const key = `markdown\0${dstPath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ kind: 'markdown', dstPath });
  }
  return found;
}

export function wikilinkToPath(raw: string): string {
  let target = raw.trim();
  const hash = target.indexOf('#');
  if (hash >= 0) target = target.slice(0, hash);
  target = target
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\.?\//, '');
  if (!target) return '';
  const parts = target.split('/');
  if (parts.some((part) => part.length === 0 || part === '.' || part === '..')) return '';
  if (!target.toLowerCase().endsWith('.md')) target = `${target}.md`;
  return target;
}

export function resolveDestination(dstPath: string, notes: readonly LinkNoteRef[]): number | null {
  const exact = notes.find((note) => note.path === dstPath);
  if (exact) return exact.id;
  if (dstPath.includes('/')) return null;
  const matches = notes.filter((note) => note.path.split('/').pop() === dstPath);
  return matches.length === 1 ? (matches[0]?.id ?? null) : null;
}

export function remapIndexPath(path: string, from: string, to: string): string {
  if (path === from) return to;
  if (path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
  return path;
}

function parseWikilink(embed: boolean, body: string): ParsedLink | null {
  const target = body.split('|')[0] ?? '';
  const hash = target.indexOf('#');
  const anchor = hash >= 0 ? target.slice(hash + 1) : '';
  const dstPath = wikilinkToPath(target);
  if (!dstPath) return null;
  if (embed) return { kind: 'embed', dstPath };
  if (anchor.startsWith('^')) return { kind: 'block', dstPath };
  return { kind: 'wikilink', dstPath };
}

function maskCode(content: string): string {
  const chars = [...content];
  let fence: { char: '`' | '~'; length: number } | null = null;
  let index = 0;
  let lineStart = 0;
  const blank = (from: number, to: number) => {
    for (let cursor = from; cursor < to; cursor += 1) chars[cursor] = ' ';
  };
  while (index <= content.length) {
    if (index === content.length || content[index] === '\n') {
      const line = content.slice(lineStart, index);
      if (fence) {
        if (closesFence(line, fence)) fence = null;
        else blank(lineStart, index);
      } else {
        const opened = openFence(line);
        if (opened) fence = opened;
        else blankInlineCode(chars, lineStart, index);
      }
      index += 1;
      lineStart = index;
      continue;
    }
    index += 1;
  }
  return chars.join('');
}

function blankInlineCode(chars: string[], from: number, to: number): void {
  let open = -1;
  for (let index = from; index < to; index += 1) {
    if (chars[index] !== '`') continue;
    if (open < 0) open = index;
    else {
      for (let cursor = open; cursor <= index; cursor += 1) chars[cursor] = ' ';
      open = -1;
    }
  }
}

function openFence(line: string): { char: '`' | '~'; length: number } | null {
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) return null;
  const token = match[2] ?? '';
  const info = match[3] ?? '';
  const char = token[0];
  if ((char !== '`' && char !== '~') || (char === '`' && info.includes('`'))) return null;
  return { char, length: token.length };
}

function closesFence(line: string, fence: { char: '`' | '~'; length: number }): boolean {
  const match = /^( {0,3})(`{3,}|~{3,})[ \t]*$/.exec(line);
  if (!match) return false;
  const token = match[2] ?? '';
  return token[0] === fence.char && token.length >= fence.length;
}
