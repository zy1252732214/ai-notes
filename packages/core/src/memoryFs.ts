import { assertVaultPath, isHiddenPath, isMarkdownPath, parentVaultPath } from './paths.js';
import type { FsEntry, VaultFileSystem, VaultPath } from './types.js';

function movePath(path: string, from: string, to: string): string {
  if (path === from) return to;
  const prefix = `${from}/`;
  if (path.startsWith(prefix)) return `${to}/${path.slice(prefix.length)}`;
  return path;
}

/**
 * 进程内的 Vault 文件系统。单元测试和「示例库」用它，不碰磁盘。
 */
export class MemoryFileSystem implements VaultFileSystem {
  private files = new Map<VaultPath, string>();
  private directories = new Set<VaultPath>();

  constructor(initial: Record<string, string> = {}) {
    for (const [path, contents] of Object.entries(initial)) {
      this.writeText(assertVaultPath(path), contents);
    }
  }

  private addParents(path: VaultPath): void {
    let parent = parentVaultPath(path);
    while (parent) {
      this.directories.add(parent);
      parent = parentVaultPath(parent);
    }
  }

  async list(): Promise<FsEntry[]> {
    const entries: FsEntry[] = [];
    for (const path of this.directories) {
      if (!isHiddenPath(path)) entries.push({ path, kind: 'directory' });
    }
    for (const path of this.files.keys()) {
      if (!isHiddenPath(path) && isMarkdownPath(path)) entries.push({ path, kind: 'file' });
    }
    return entries;
  }

  async readText(path: VaultPath): Promise<string> {
    const normalized = assertVaultPath(path);
    const contents = this.files.get(normalized);
    if (contents === undefined) throw new Error('文件不存在');
    return contents;
  }

  async writeText(path: VaultPath, contents: string): Promise<void> {
    const normalized = assertVaultPath(path);
    if (this.directories.has(normalized)) throw new Error('目标是文件夹');
    this.addParents(normalized);
    this.files.set(normalized, contents);
  }

  async createDirectory(path: VaultPath): Promise<void> {
    const normalized = assertVaultPath(path);
    if (this.files.has(normalized) || this.directories.has(normalized)) {
      throw new Error('目标已存在');
    }
    this.addParents(normalized);
    this.directories.add(normalized);
  }

  async remove(path: VaultPath): Promise<void> {
    const normalized = assertVaultPath(path);
    if (this.files.has(normalized)) {
      this.files.delete(normalized);
      return;
    }
    if (!this.directories.has(normalized)) throw new Error('不存在');
    for (const directory of [...this.directories]) {
      if (directory === normalized || directory.startsWith(`${normalized}/`)) {
        this.directories.delete(directory);
      }
    }
    for (const file of [...this.files.keys()]) {
      if (file.startsWith(`${normalized}/`)) this.files.delete(file);
    }
  }

  async rename(from: VaultPath, to: VaultPath): Promise<void> {
    const source = assertVaultPath(from);
    const target = assertVaultPath(to);
    if (source === target) return;
    if (this.files.has(target) || this.directories.has(target)) throw new Error('目标已存在');
    if (target.startsWith(`${source}/`)) throw new Error('不能移动到自身内部');

    if (this.files.has(source)) {
      const contents = this.files.get(source) ?? '';
      this.files.delete(source);
      this.addParents(target);
      this.files.set(target, contents);
      return;
    }
    if (!this.directories.has(source)) throw new Error('不存在');

    const nextFiles = new Map<VaultPath, string>();
    for (const [path, contents] of this.files) {
      nextFiles.set(movePath(path, source, target), contents);
    }
    const nextDirectories = new Set<VaultPath>();
    for (const path of this.directories) {
      nextDirectories.add(movePath(path, source, target));
    }
    this.files = nextFiles;
    this.directories = nextDirectories;
    this.addParents(target);
  }
}
