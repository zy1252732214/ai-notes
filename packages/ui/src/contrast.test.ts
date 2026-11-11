import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const tokensCss = readFileSync(join(rootDir, 'packages/ui/tokens.css'), 'utf8');
const componentsCss = readFileSync(join(rootDir, 'packages/ui/components.css'), 'utf8');
const desktopCss = readFileSync(join(rootDir, 'apps/desktop/src/styles.css'), 'utf8');
const editorSource = readFileSync(join(rootDir, 'packages/editor/src/MarkdownEditor.tsx'), 'utf8');

const TEXT = ['--an-text-primary', '--an-text-secondary', '--an-text-tertiary'] as const;
const SURFACES = ['--an-bg-base', '--an-bg-subtle', '--an-bg-elevated'] as const;
const STATUS_TEXT = ['--an-success', '--an-warning', '--an-danger'] as const;
const STYLE_FILES = [
  'packages/ui/components.css',
  'apps/desktop/src/styles.css',
  'apps/ui-preview/src/styles.css',
] as const;

function parseTheme(source: string, selector: string): Map<string, string> {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const match = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  expect(match, selector).toBeTruthy();
  const body = match?.[1] ?? '';
  const values = new Map<string, string>();
  for (const decl of body.matchAll(/(--an-[a-z0-9-]+)\s*:\s*([^;]+)\s*;/g)) {
    const name = decl[1];
    const value = decl[2]?.trim().replace(/\s+/g, ' ');
    if (!name || value === undefined) continue;
    values.set(name, value);
  }
  return values;
}

function channel(hex: string, shift: number): number {
  const value = Number.parseInt(hex.slice(1), 16) >> shift;
  const channel = (value & 255) / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 16) + 0.7152 * channel(hex, 8) + 0.0722 * channel(hex, 0);
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function color(theme: Map<string, string>, name: string): string {
  const value = theme.get(name);
  expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
  return value ?? '#000000';
}

const light = parseTheme(tokensCss, ':root');
const dark = parseTheme(tokensCss, "\\[data-theme='dark'\\]");

describe('WCAG 2.1 contrast', () => {
  it.each([
    ['light', light],
    ['dark', dark],
  ])('%s text is at least 4.5:1 and control borders are at least 3:1', (_name, theme) => {
    for (const surface of SURFACES) {
      for (const text of TEXT) {
        expect(contrast(color(theme, text), color(theme, surface))).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(color(theme, '--an-border-control'), color(theme, surface)),
      ).toBeGreaterThanOrEqual(3);
    }
    for (const text of STATUS_TEXT) {
      for (const surface of SURFACES) {
        expect(contrast(color(theme, text), color(theme, surface))).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(
      contrast(color(theme, '--an-on-accent'), color(theme, '--an-accent')),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(color(theme, '--an-on-accent'), color(theme, '--an-danger')),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(color(theme, '--an-accent'), color(theme, '--an-ai-subtle')),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(color(theme, '--an-text-primary'), color(theme, '--an-selection')),
    ).toBeGreaterThanOrEqual(4.5);
    for (const surface of SURFACES) {
      if (_name === 'dark' && surface === '--an-bg-elevated') continue;
      expect(
        contrast(color(theme, '--an-selection'), color(theme, surface)),
      ).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(color(theme, '--an-border-subtle'), color(theme, '--an-bg-base'))).toBeLessThan(
      contrast(color(theme, '--an-border-control'), color(theme, '--an-bg-base')),
    );
  });

  it('keeps the reviewed text, status, and border values', () => {
    expect(color(light, '--an-text-tertiary')).toBe('#736d61');
    expect(color(dark, '--an-text-tertiary')).toBe('#9b917f');
    expect(color(light, '--an-success')).toBe('#2c7c4a');
    expect(color(light, '--an-warning')).toBe('#9c6005');
    expect(color(light, '--an-border-control')).toBe('#948a7f');
    expect(color(dark, '--an-border-control')).toBe('#7d7368');
    expect(color(light, '--an-border-subtle')).toBe('#e6e1d8');
    expect(color(dark, '--an-border-subtle')).toBe('#3a3834');
    expect(color(light, '--an-selection')).toBe('#6e9389');
    expect(color(dark, '--an-selection')).toBe('#5c7168');
  });

  it('does not put tertiary text on the heavier question and citation surfaces', () => {
    expect(componentsCss).toMatch(
      /\.an-chat--user \.an-chat__role\s*\{[^}]*color:\s*var\(--an-text-secondary\)/,
    );
    expect(desktopCss).toMatch(
      /\.ai-citation:hover \.an-chat__source,\s*\.ai-citation:focus-visible \.an-chat__source\s*\{[^}]*color:\s*var\(--an-text-secondary\)/,
    );
    expect(desktopCss).toContain('outline: 2px solid var(--an-accent)');
    expect(desktopCss).not.toMatch(/color-mix\(in srgb, var\(--an-accent\) 40%/);
    expect(desktopCss).toMatch(/\.welcome-badge\s*\{[^}]*background:\s*var\(--an-bg-subtle\)/);
    expect(editorSource).toContain("backgroundColor: 'var(--an-selection)'");
    expect(editorSource).toContain("class: 'cm-selection-text'");
    expect(editorSource).toContain("color: 'var(--an-text-primary)'");
    expect(editorSource).not.toContain('var(--an-accent) 24%');
  });

  it('does not paint control borders with the decorative divider', () => {
    const controlSelector = /input|select|textarea|checkbox|kbd|button|switch|toggle/i;
    const subtleBorder =
      /(?:border(?:-[a-z]+)?(?:-color)?|background)\s*:[^;]*var\(--an-border-subtle\)/;
    const failures: string[] = [];
    for (const file of STYLE_FILES) {
      const css = readFileSync(join(rootDir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = match[1]?.trim() ?? '';
        const body = match[2] ?? '';
        if (!controlSelector.test(selector) || !subtleBorder.test(body)) continue;
        failures.push(`${file}: ${selector.replace(/\s+/g, ' ')}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
