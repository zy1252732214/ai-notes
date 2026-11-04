export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultError';
  }
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 0x1f) return true;
  }
  return false;
}

export function assertVaultPath(input: string): string {
  const normalized = input.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.endsWith('/') || hasControlCharacter(normalized)) {
    throw new VaultError('路径无效');
  }
  const segments = normalized.split('/');
  if (
    segments.some(
      (segment) =>
        segment.length === 0 || segment === '.' || segment === '..' || segment.startsWith('.'),
    )
  ) {
    throw new VaultError('路径无效');
  }
  return segments.join('/');
}

export function assertEntryName(name: string): string {
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed === '.' ||
    trimmed === '..' ||
    trimmed.startsWith('.') ||
    /[\\/]/.test(trimmed) ||
    hasControlCharacter(trimmed)
  ) {
    throw new VaultError('名称无效');
  }
  return trimmed;
}

export function ensureMarkdownName(name: string): string {
  const trimmed = assertEntryName(name);
  if (/\.md$/i.test(trimmed)) return trimmed;
  return `${trimmed}.md`;
}

export function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith('.md');
}

export function isHiddenPath(path: string): boolean {
  return path.split('/').some((segment) => segment.startsWith('.'));
}

export function parentVaultPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index);
}

export function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const index = normalized.lastIndexOf('/');
  return index === -1 ? normalized : normalized.slice(index + 1);
}

export function joinVaultPath(directory: string, name: string): string {
  const entry = assertEntryName(name);
  if (!directory) return entry;
  return `${assertVaultPath(directory)}/${entry}`;
}

export function remapVaultPath(path: string, from: string, to: string): string {
  if (path === from) return to;
  const prefix = `${from}/`;
  if (path.startsWith(prefix)) return `${to}/${path.slice(prefix.length)}`;
  return path;
}

/** 去掉空白后按 Unicode 码点计数，适合中文笔记的「字数」。 */
export function countVisibleCharacters(content: string): number {
  return Array.from(content.replace(/\s/g, '')).length;
}
