import { wikilinkToPath } from '@ai-notes/indexer';
import type { NoteName } from './fuzzy.js';

/** Resolve `[[周报]]`, `项目/计划.md`, or an alias to one vault path. */
export function resolveNoteLink(raw: string, files: readonly NoteName[]): string | null {
  let target = raw.trim();
  if (target.startsWith('[[') && target.endsWith(']]')) target = target.slice(2, -2).trim();
  target = target.split('|')[0] ?? '';
  const dst = wikilinkToPath(target);
  if (!dst) return null;
  const exact = files.find((file) => file.path === dst);
  if (exact) return exact.path;
  if (dst.includes('/')) return null;
  const matches = files.filter((file) => file.name === dst || file.path.split('/').pop() === dst);
  if (matches.length !== 1) return null;
  return matches[0]?.path ?? null;
}

export function linkLabel(raw: string, resolved: string | null): string {
  const alias = raw.split('|')[1]?.trim();
  if (alias) return alias;
  const path = resolved ?? raw.split('|')[0]?.trim() ?? raw;
  const name = path.split('/').pop() || path;
  return name.replace(/\.md$/i, '');
}
