import { describe, expect, it } from 'vitest';
import { fuzzyMatchFiles, type NoteName } from './fuzzy.js';

const files: NoteName[] = [
  { path: '欢迎.md', name: '欢迎.md' },
  { path: '日常/周报.md', name: '周报.md' },
  { path: '项目/计划.md', name: '计划.md' },
  { path: '项目/记录.md', name: '记录.md' },
];

describe('fuzzyMatchFiles', () => {
  it('matches a file name even when the query skips the folder', () => {
    expect(fuzzyMatchFiles(files, '周报').map((file) => file.path)).toEqual(['日常/周报.md']);
    expect(fuzzyMatchFiles(files, '计划').map((file) => file.path)).toEqual(['项目/计划.md']);
  });

  it('matches a subsequence and ranks the file name above the folder', () => {
    expect(fuzzyMatchFiles(files, '日周').map((file) => file.path)).toEqual(['日常/周报.md']);
    expect(fuzzyMatchFiles(files, '项计').map((file) => file.path)[0]).toBe('项目/计划.md');
  });

  it('returns an empty list when nothing matches', () => {
    expect(fuzzyMatchFiles(files, 'xyz')).toEqual([]);
  });

  it('lists every file when the query is empty', () => {
    expect(
      fuzzyMatchFiles(files, '  ')
        .map((file) => file.path)
        .sort(),
    ).toEqual(files.map((file) => file.path).sort());
  });
});
