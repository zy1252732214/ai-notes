export const packageId = '@ai-notes/core' as const;

export { MemoryFileSystem } from './memoryFs.js';
export {
  VaultError,
  assertEntryName,
  assertVaultPath,
  basename,
  countVisibleCharacters,
  ensureMarkdownName,
  isHiddenPath,
  isMarkdownPath,
  joinVaultPath,
  parentVaultPath,
  remapVaultPath,
} from './paths.js';
export { createSampleVault } from './sample.js';
export { createDebouncedSaver } from './saver.js';
export type { DebouncedSaver } from './saver.js';
export { buildFileTree, filterVaultTree } from './tree.js';
export type { FsEntry, VaultFileSystem, VaultNode, VaultPath } from './types.js';
export { Vault } from './vault.js';
