import { describe, expect, it } from 'vitest';
import { buildFileTree, filterVaultTree } from './index.js';
import type { FsEntry } from './index.js';

const entries: FsEntry[] = [
  { path: '欢迎.md', kind: 'file' },
  { path: '项目', kind: 'directory' },
  { path: '项目/计划.md', kind: 'file' },
  { path: '日常', kind: 'directory' },
  { path: '日常/周报.md', kind: 'file' },
  { path: '项目/附件.png', kind: 'file' },
  { path: '.obsidian/app.json', kind: 'file' },
  { path: '草稿.txt', kind: 'file' },
];

describe('file tree', () => {
  it('keeps folders and markdown, and sorts folders first', () => {
    const tree = buildFileTree(entries);
    expect(tree.map((node) => node.path)).toEqual(['日常', '项目', '欢迎.md']);
    expect(tree[0]?.children.map((node) => node.path)).toEqual(['日常/周报.md']);
    expect(tree[1]?.children.map((node) => node.path)).toEqual(['项目/计划.md']);
  });

  it('synthesizes missing parent folders', () => {
    const tree = buildFileTree([{ path: '项目/子目录/计划.md', kind: 'file' }]);
    expect(tree[0]?.path).toBe('项目');
    expect(tree[0]?.children[0]?.path).toBe('项目/子目录');
    expect(tree[0]?.children[0]?.children[0]?.path).toBe('项目/子目录/计划.md');
  });

  it('filters by name and keeps ancestors', () => {
    const tree = buildFileTree(entries);
    expect(filterVaultTree(tree, '周报').map((node) => node.path)).toEqual(['日常']);
    expect(filterVaultTree(tree, '周报')[0]?.children[0]?.path).toBe('日常/周报.md');
    expect(filterVaultTree(tree, '项目')[0]?.children.map((node) => node.name)).toEqual([
      '计划.md',
    ]);
    expect(filterVaultTree(tree, '不存在')).toEqual([]);
  });
});
