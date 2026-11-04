import { VaultError, assertVaultPath, isMarkdownPath } from './paths.js';
import { buildFileTree } from './tree.js';
import type { VaultFileSystem, VaultNode, VaultPath } from './types.js';

export class Vault {
  constructor(
    readonly name: string,
    readonly fs: VaultFileSystem,
  ) {}

  async listTree(): Promise<VaultNode[]> {
    return buildFileTree(await this.fs.list());
  }

  async readNote(path: VaultPath): Promise<string> {
    const normalized = this.notePath(path);
    return this.fs.readText(normalized);
  }

  async writeNote(path: VaultPath, contents: string): Promise<void> {
    const normalized = this.notePath(path);
    await this.fs.writeText(normalized, contents);
  }

  async createNote(path: VaultPath, contents = ''): Promise<void> {
    const normalized = this.notePath(path);
    const entries = await this.fs.list();
    if (entries.some((entry) => entry.path === normalized)) {
      throw new VaultError('笔记已存在');
    }
    await this.fs.writeText(normalized, contents);
  }

  async createFolder(path: VaultPath): Promise<void> {
    const normalized = assertVaultPath(path);
    if (isMarkdownPath(normalized)) throw new VaultError('文件夹名称不能以 .md 结尾');
    const entries = await this.fs.list();
    if (entries.some((entry) => entry.path === normalized)) {
      throw new VaultError('文件夹已存在');
    }
    await this.fs.createDirectory(normalized);
  }

  async rename(from: VaultPath, to: VaultPath): Promise<void> {
    const source = assertVaultPath(from);
    const target = assertVaultPath(to);
    if (source === target) return;
    const entries = await this.fs.list();
    const current = entries.find((entry) => entry.path === source);
    if (!current) throw new VaultError('找不到要重命名的项目');
    if (entries.some((entry) => entry.path === target)) throw new VaultError('目标已存在');
    if (current.kind === 'file' && !isMarkdownPath(target)) {
      throw new VaultError('笔记必须使用 .md 扩展名');
    }
    if (current.kind === 'directory' && isMarkdownPath(target)) {
      throw new VaultError('文件夹名称不能以 .md 结尾');
    }
    if (current.kind === 'directory' && target.startsWith(`${source}/`)) {
      throw new VaultError('不能把文件夹移动到自身内部');
    }
    await this.fs.rename(source, target);
  }

  async delete(path: VaultPath): Promise<void> {
    const normalized = assertVaultPath(path);
    const entries = await this.fs.list();
    if (!entries.some((entry) => entry.path === normalized)) {
      throw new VaultError('找不到要删除的项目');
    }
    await this.fs.remove(normalized);
  }

  watch(onChange: () => void): () => void {
    return this.fs.watch?.(onChange) ?? (() => undefined);
  }

  private notePath(path: VaultPath): VaultPath {
    const normalized = assertVaultPath(path);
    if (!isMarkdownPath(normalized)) throw new VaultError('只能读写 Markdown 笔记');
    return normalized;
  }
}
