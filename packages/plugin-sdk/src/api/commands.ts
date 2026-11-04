import type { Disposable } from '../disposable.js';
import type { EditorHandle } from './editor.js';

export const HOTKEY_MODIFIERS = ['Mod', 'Ctrl', 'Alt', 'Shift', 'Meta'] as const;

export type HotkeyModifier = (typeof HOTKEY_MODIFIERS)[number];

export interface Hotkey {
  modifiers: readonly HotkeyModifier[];
  /** 单个按键，例如 `H` 或 `F2`。不含修饰键。 */
  key: string;
}

export interface Command {
  /** 建议以插件 id 为前缀，例如 `hello-notes.say-hello`。 */
  id: string;
  name: string;
  hotkey?: Hotkey | string;
  callback?: () => void | Promise<void>;
  /** 只在编辑器有焦点时可用。提供时优先于 callback。 */
  editorCallback?: (editor: EditorHandle) => void | Promise<void>;
}

export interface CommandsApi {
  /** 注册命令面板条目和可选快捷键。 */
  register(command: Command): Disposable;
}

export function isHotkeyModifier(value: string): value is HotkeyModifier {
  return (HOTKEY_MODIFIERS as readonly string[]).includes(value);
}

/** 把 `Mod+Shift+H` 解析成结构化快捷键。 */
export function parseHotkey(source: string): Hotkey {
  const parts = source.split('+').filter((part) => part.length > 0);
  const key = parts[parts.length - 1];
  if (!key || parts.length < 2) {
    throw new Error(`Invalid hotkey: ${source}`);
  }
  const modifiers: HotkeyModifier[] = [];
  for (const part of parts.slice(0, -1)) {
    if (!isHotkeyModifier(part)) {
      throw new Error(`Invalid hotkey modifier: ${part}`);
    }
    modifiers.push(part);
  }
  return { modifiers, key };
}

export function formatHotkey(hotkey: Hotkey): string {
  return [...hotkey.modifiers, hotkey.key].join('+');
}
