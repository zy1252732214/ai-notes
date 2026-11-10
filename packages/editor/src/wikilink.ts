export interface PointerModifiers {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

/** Apple platforms use Command; every other platform uses Control. */
export function commandKeyPlatform(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** True while the platform's link modifier is held. */
export function modifierHeld(
  event: { metaKey: boolean; ctrlKey: boolean },
  platform: string,
): boolean {
  return commandKeyPlatform(platform) ? event.metaKey : event.ctrlKey;
}

/**
 * Wikilinks open on Command-click (macOS) or Control-click (everywhere else).
 * A plain click, or Shift-click, only moves the caret so the link text stays editable.
 */
export function opensOnModifierClick(event: PointerModifiers, platform: string): boolean {
  if (event.button !== 0 || event.shiftKey) return false;
  return modifierHeld(event, platform);
}

/** Inner text of the `[[wikilink]]` covering `offset`, or null when the offset is outside one. */
export function wikilinkAt(source: string, offset: number): string | null {
  if (offset < 0 || offset > source.length) return null;
  const masked = maskCode(source);
  const start = masked.lastIndexOf('[[', offset);
  if (start < 0) return null;
  const end = masked.indexOf(']]', start + 2);
  if (end < 0 || offset > end + 1) return null;
  const inner = masked.slice(start + 2, end);
  if (inner.includes('\n') || inner.includes('[')) return null;
  if (offset < start) return null;
  return source.slice(start + 2, end);
}

function maskCode(content: string): string {
  const chars = content.split('');
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
