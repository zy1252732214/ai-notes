import { describe, expect, it } from 'vitest';
import { folderName, isTauri } from './runtime.js';

describe('desktop runtime', () => {
  it('uses the last path segment as the vault name', () => {
    expect(folderName('/home/notes/我的库')).toBe('我的库');
    expect(folderName('C:\\Vaults\\Work')).toBe('Work');
  });

  it('is not running inside Tauri during unit tests', () => {
    expect(isTauri()).toBe(false);
  });
});
