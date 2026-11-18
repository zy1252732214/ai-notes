import { scoreOverlap } from './segment.js';

export function buildSnippet(
  text: string,
  headingPath: string,
  title: string,
  query: string,
): string {
  const fromText = focusNeedle(text, query);
  if (fromText) return highlight(text, fromText);
  const fromHeading = focusNeedle(headingPath, query);
  if (fromHeading) return highlight(headingPath, fromHeading);
  const fromTitle = focusNeedle(title, query);
  if (fromTitle) return highlight(title, fromTitle);
  return highlight(text, query);
}

function focusNeedle(value: string, query: string): string {
  if (query && includesFold(value, query)) return query;
  const overlap = scoreOverlap(query, value);
  return overlap.span >= 2 ? overlap.needle : '';
}

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const source = haystack.toLowerCase();
  const target = needle.toLowerCase();
  let count = 0;
  let index = 0;
  while (index < source.length) {
    const found = source.indexOf(target, index);
    if (found < 0) break;
    count += 1;
    index = found + target.length;
  }
  return count;
}

function highlight(text: string, query: string, radius = 32): string {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) {
    const cut = [...text].slice(0, radius * 2).join('');
    return cut.length < text.length ? `${cut}…` : cut;
  }
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + query.length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  const slice = text.slice(start, end);
  const relative = index - start;
  return `${prefix}${slice.slice(0, relative)}<b>${slice.slice(relative, relative + query.length)}</b>${slice.slice(relative + query.length)}${suffix}`;
}

function includesFold(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}
