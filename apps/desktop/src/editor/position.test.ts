import { describe, expect, it } from 'vitest';
import { cursorFromOffset } from './position.js';

describe('cursorFromOffset', () => {
  it('counts lines and columns from a character offset', () => {
    const content = '第一行\n第二行';
    expect(cursorFromOffset(content, 0)).toEqual({ line: 1, column: 1 });
    expect(cursorFromOffset(content, content.indexOf('二'))).toEqual({ line: 2, column: 2 });
  });
});
