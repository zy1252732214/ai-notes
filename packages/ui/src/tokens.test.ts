import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  THEME_ATTRIBUTE,
  applyTheme,
  bindTheme,
  colors,
  cssVar,
  cssVarNames,
  fontFamily,
  getSystemTheme,
  layout,
  radius,
  readAppliedTheme,
  resolveTheme,
  space,
  typeScale,
} from './index.js';

const DARK_SELECTOR = "[data-theme='dark']";
const tokensCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../tokens.css'),
  'utf8',
);

afterEach(() => {
  vi.unstubAllGlobals();
});

function parseRules(source: string): Map<string, Map<string, string>> {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = new Map<string, Map<string, string>>();
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1]?.trim() ?? '';
    const body = match[2] ?? '';
    const decls = new Map<string, string>();
    for (const decl of body.matchAll(/(--an-[a-z0-9-]+)\s*:\s*([^;]+)\s*;/g)) {
      const name = decl[1];
      const value = decl[2]?.trim();
      if (!name || value === undefined) continue;
      expect(decls.has(name), `${selector} ${name}`).toBe(false);
      decls.set(name, value);
    }
    expect(rules.has(selector), selector).toBe(false);
    rules.set(selector, decls);
  }
  return rules;
}

function keysOf<T extends object>(value: T): (keyof T)[] {
  return Object.keys(value) as (keyof T)[];
}

describe('tokens.css', () => {
  it('matches the typed tokens', () => {
    const rules = parseRules(tokensCss);
    const root = rules.get(':root');
    const dark = rules.get(DARK_SELECTOR);
    expect(root).toBeDefined();
    expect(dark).toBeDefined();
    if (!root || !dark) return;

    const expected = new Set<string>();

    for (const token of keysOf(colors.light)) {
      const name = cssVarNames.color[token];
      expected.add(name);
      expect(root.get(name)).toBe(colors.light[token]);
      expect(dark.get(name)).toBe(colors.dark[token]);
    }

    for (const token of keysOf(fontFamily)) {
      const name = cssVarNames.fontFamily[token];
      expected.add(name);
      expect(root.get(name)).toBe(fontFamily[token]);
    }

    for (const level of keysOf(typeScale)) {
      const style = typeScale[level];
      const sizeName = cssVarNames.fontSize[level];
      const lineName = cssVarNames.lineHeight[level];
      const weightName = cssVarNames.fontWeight[level];
      expected.add(sizeName);
      expected.add(lineName);
      expected.add(weightName);
      expect(root.get(sizeName)).toBe(style.fontSize);
      expect(root.get(lineName)).toBe(style.lineHeight);
      expect(root.get(weightName)).toBe(String(style.fontWeight));
    }

    for (const step of keysOf(space)) {
      const name = cssVarNames.space[step];
      expected.add(name);
      expect(root.get(name)).toBe(space[step]);
    }

    for (const token of keysOf(radius)) {
      const name = cssVarNames.radius[token];
      expected.add(name);
      expect(root.get(name)).toBe(radius[token]);
    }

    for (const token of keysOf(layout)) {
      const name = cssVarNames.layout[token];
      expected.add(name);
      expect(root.get(name)).toBe(layout[token]);
    }

    expect([...root.keys()].sort()).toEqual([...expected].sort());
    expect([...dark.keys()].sort()).toEqual(
      keysOf(cssVarNames.color)
        .map((token) => cssVarNames.color[token])
        .sort(),
    );
    expect([...rules.keys()].sort()).toEqual([':root', DARK_SELECTOR].sort());
    expect(cssVar(cssVarNames.color.accent)).toBe('var(--an-accent)');
    expect(cssVar(cssVarNames.fontFamily.ui)).toBe('var(--an-font-ui)');
  });
});

function createRoot(): HTMLElement {
  const attrs = new Map<string, string>();
  return {
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
    },
  } as HTMLElement;
}

describe('theme', () => {
  it('resolves manual preferences without touching the system theme', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('falls back to light when the system theme cannot be read', () => {
    vi.stubGlobal('window', undefined);
    expect(getSystemTheme()).toBe('light');
    expect(resolveTheme('system')).toBe('light');
  });

  it('writes the resolved theme onto data-theme', () => {
    const root = createRoot();
    expect(applyTheme('dark', root)).toBe('dark');
    expect(readAppliedTheme(root)).toBe('dark');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(applyTheme('light', root)).toBe('light');
    expect(readAppliedTheme(root)).toBe('light');
  });

  it('follows the system theme until the subscription is cancelled', () => {
    let matches = false;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    vi.stubGlobal('window', {
      matchMedia() {
        return {
          get matches() {
            return matches;
          },
          addEventListener(type: string, listener: (event: MediaQueryListEvent) => void) {
            if (type === 'change') listeners.add(listener);
          },
          removeEventListener(type: string, listener: (event: MediaQueryListEvent) => void) {
            if (type === 'change') listeners.delete(listener);
          },
        };
      },
    });

    const root = createRoot();
    const stop = bindTheme('system', root);
    expect(readAppliedTheme(root)).toBe('light');

    matches = true;
    for (const listener of listeners) listener({ matches: true } as MediaQueryListEvent);
    expect(readAppliedTheme(root)).toBe('dark');

    stop();
    matches = false;
    for (const listener of listeners) listener({ matches: false } as MediaQueryListEvent);
    expect(readAppliedTheme(root)).toBe('dark');
    expect(listeners.size).toBe(0);
  });
});
