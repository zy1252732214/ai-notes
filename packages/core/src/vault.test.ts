import { describe, expect, it } from 'vitest';
import { MemoryFileSystem, Vault, VaultError, createSampleVault } from './index.js';

function createVault(): Vault {
  return new Vault('测试库', new MemoryFileSystem());
}

describe('Vault', () => {
  it('creates, reads, writes, renames, and deletes notes', async () => {
    const vault = createVault();
    await vault.createFolder('项目');
    await vault.createNote('项目/计划.md', '# 计划\n');
    expect(await vault.readNote('项目/计划.md')).toBe('# 计划\n');

    await vault.writeNote('项目/计划.md', '# 计划\n\n更新');
    expect(await vault.readNote('项目/计划.md')).toBe('# 计划\n\n更新');

    await vault.rename('项目/计划.md', '项目/路线图.md');
    await expect(vault.readNote('项目/计划.md')).rejects.toThrow();
    expect(await vault.readNote('项目/路线图.md')).toContain('更新');

    await vault.delete('项目/路线图.md');
    const tree = await vault.listTree();
    expect(tree.map((node) => node.path)).toEqual(['项目']);
    expect(tree[0]?.children).toEqual([]);
  });

  it('moves nested notes when a folder is renamed', async () => {
    const vault = createVault();
    await vault.createNote('日常/周报.md', '本周');
    await vault.rename('日常', '日记');
    expect(await vault.readNote('日记/周报.md')).toBe('本周');
    const tree = await vault.listTree();
    expect(tree[0]?.path).toBe('日记');
    expect(tree[0]?.children[0]?.path).toBe('日记/周报.md');
  });

  it('deletes a folder recursively', async () => {
    const vault = createVault();
    await vault.createNote('日常/周报.md', '本周');
    await vault.createNote('欢迎.md', '你好');
    await vault.delete('日常');
    const tree = await vault.listTree();
    expect(tree.map((node) => node.path)).toEqual(['欢迎.md']);
  });

  it('rejects duplicates, non-markdown notes, and path traversal', async () => {
    const vault = createVault();
    await vault.createNote('欢迎.md', '你好');
    await expect(vault.createNote('欢迎.md', '再次')).rejects.toThrow(VaultError);
    await expect(vault.createFolder('欢迎.md')).rejects.toThrow(VaultError);
    await expect(vault.writeNote('笔记.txt', 'x')).rejects.toThrow(VaultError);
    await expect(vault.readNote('../秘密.md')).rejects.toThrow(VaultError);
    await expect(vault.createNote('.秘密.md', 'x')).rejects.toThrow(VaultError);
    await expect(vault.rename('欢迎.md', '欢迎.txt')).rejects.toThrow(VaultError);
    await expect(vault.delete('不存在.md')).rejects.toThrow(VaultError);
  });

  it('hides non-markdown files that happen to be stored', async () => {
    const fs = new MemoryFileSystem({
      '欢迎.md': '你好',
      '图片.png': 'not-really',
    });
    const tree = await new Vault('混合', fs).listTree();
    expect(tree.map((node) => node.path)).toEqual(['欢迎.md']);
  });

  it('opens the sample vault', async () => {
    const vault = createSampleVault();
    expect(vault.name).toBe('示例库');
    const tree = await vault.listTree();
    expect(tree.map((node) => node.name)).toEqual(['日常', '项目', '欢迎.md']);
    expect(await vault.readNote('欢迎.md')).toContain('欢迎使用 ai-notes');
    expect(await vault.readNote('日常/周报.md')).toContain('下周');
  });
});
