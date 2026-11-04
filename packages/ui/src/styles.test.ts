import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const componentsCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../components.css'),
  'utf8',
);

describe('components.css', () => {
  it('imports the design tokens and does not add its own palette', () => {
    expect(componentsCss).toContain("@import './tokens.css';");

    expect(componentsCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(componentsCss).not.toMatch(/\brgba?\s*\(/i);
    expect(componentsCss).not.toMatch(/\bhsla?\s*\(/i);
    expect(componentsCss).not.toMatch(
      /(?:^|[^-\w])(?:transparent|white|black|red|blue|green|gray|grey|orange|purple|pink|yellow)(?:$|[^-\w])/i,
    );

    const variables = [...componentsCss.matchAll(/var\((--[A-Za-z0-9-]+)\)/g)].map(
      (match) => match[1],
    );
    expect(variables.length).toBeGreaterThan(0);
    for (const name of variables) {
      expect(name?.startsWith('--an-')).toBe(true);
    }
  });
});
