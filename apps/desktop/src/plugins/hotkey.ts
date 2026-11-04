import { parseHotkey } from '@ai-notes/plugin-sdk';

export function matchesHotkey(event: KeyboardEvent, source: string): boolean {
  let parsed;
  try {
    parsed = parseHotkey(source);
  } catch {
    return false;
  }
  if (event.key.toLowerCase() !== parsed.key.toLowerCase()) return false;
  const modifiers = new Set(parsed.modifiers);
  if (modifiers.has('Mod')) {
    if (!event.ctrlKey && !event.metaKey) return false;
  } else {
    if (modifiers.has('Ctrl') !== event.ctrlKey) return false;
    if (modifiers.has('Meta') !== event.metaKey) return false;
  }
  if (modifiers.has('Alt') !== event.altKey) return false;
  if (modifiers.has('Shift') !== event.shiftKey) return false;
  return true;
}
