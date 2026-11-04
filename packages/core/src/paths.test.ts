import { describe, expect, it } from 'vitest';
import {
  VaultError,
  assertEntryName,
  assertVaultPath,
  basename,
  countVisibleCharacters,
  ensureMarkdownName,
  joinVaultPath,
  parentVaultPath,
  remapVaultPath,
} from './index.js';

describe('vault paths', () => {
  it('normalizes slashes and rejects traversal', () => {
    expect(assertVaultPath('日常\\周报.md')).toBe('日常/周报.md');
    expect(assertVaultPath('/欢迎.md')).toBe('欢迎.md');
    expect(() => assertVaultPath('../秘密.md')).toThrow(VaultError);
    expect(() => assertVaultPath('日常/../../etc/passwd')).toThrow(VaultError);
    expect(() => assertVaultPath('.git/config')).toThrow(VaultError);
    expect(() => assertVaultPath('')).toThrow(VaultError);
    expect(() => assertVaultPath('日常/')).toThrow(VaultError);
  });

  it('builds note names and joins them under a folder', () => {
    expect(ensureMarkdownName('周报')).toBe('周报.md');
    expect(ensureMarkdownName('周报.md')).toBe('周报.md');
    expect(ensureMarkdownName('周报.MD')).toBe('周报.MD');
    expect(() => assertEntryName('../周报')).toThrow(VaultError);
    expect(() => ensureMarkdownName('.隐藏')).toThrow(VaultError);
    expect(joinVaultPath('项目', '计划.md')).toBe('项目/计划.md');
    expect(joinVaultPath('', '欢迎.md')).toBe('欢迎.md');
    expect(parentVaultPath('项目/计划.md')).toBe('项目');
    expect(parentVaultPath('欢迎.md')).toBe('');
    expect(basename('项目/计划.md')).toBe('计划.md');
  });

  it('remaps a renamed folder onto nested notes', () => {
    expect(remapVaultPath('日常/周报.md', '日常', '日记')).toBe('日记/周报.md');
    expect(remapVaultPath('日常', '日常', '日记')).toBe('日记');
    expect(remapVaultPath('项目/计划.md', '日常', '日记')).toBe('项目/计划.md');
  });

  it('counts characters without whitespace', () => {
    expect(countVisibleCharacters('你好 world')).toBe(7);
    expect(countVisibleCharacters(' a \n b ')).toBe(2);
    expect(countVisibleCharacters('')).toBe(0);
  });
});
