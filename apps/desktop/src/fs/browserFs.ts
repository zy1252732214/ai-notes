import {
  assertVaultPath,
  basename,
  isMarkdownPath,
  parentVaultPath,
  type FsEntry,
  type VaultFileSystem,
  type VaultPath,
} from '@ai-notes/core';

export class BrowserDirectoryFileSystem implements VaultFileSystem {
  constructor(private readonly root: FileSystemDirectoryHandle) {}

  async list(): Promise<FsEntry[]> {
    const entries: FsEntry[] = [];
    await walk(this.root, '', entries);
    return entries;
  }

  async readText(path: VaultPath): Promise<string> {
    const normalized = assertVaultPath(path);
    const parent = await this.directory(parentVaultPath(normalized), false);
    const file = await parent.getFileHandle(basename(normalized));
    return (await file.getFile()).text();
  }

  async writeText(path: VaultPath, contents: string): Promise<void> {
    const normalized = assertVaultPath(path);
    const parent = await this.directory(parentVaultPath(normalized), true);
    const file = await parent.getFileHandle(basename(normalized), { create: true });
    const writable = await file.createWritable();
    await writable.write(contents);
    await writable.close();
  }

  async createDirectory(path: VaultPath): Promise<void> {
    const normalized = assertVaultPath(path);
    const parent = await this.directory(parentVaultPath(normalized), true);
    await parent.getDirectoryHandle(basename(normalized), { create: true });
  }

  async remove(path: VaultPath): Promise<void> {
    const normalized = assertVaultPath(path);
    const parent = await this.directory(parentVaultPath(normalized), false);
    await parent.removeEntry(basename(normalized), { recursive: true });
  }

  async rename(from: VaultPath, to: VaultPath): Promise<void> {
    const source = assertVaultPath(from);
    const target = assertVaultPath(to);
    const parent = await this.directory(parentVaultPath(source), false);
    let kind: 'file' | 'directory' = 'file';
    for await (const [name, handle] of directoryEntries(parent)) {
      if (name === basename(source)) kind = handle.kind;
    }
    if (kind === 'file') {
      await this.writeText(target, await this.readText(source));
      await this.remove(source);
      return;
    }
    await this.copyDirectory(source, target);
    await this.remove(source);
  }

  private async directory(path: string, create: boolean): Promise<FileSystemDirectoryHandle> {
    let current = this.root;
    for (const part of path ? path.split('/') : []) {
      current = await current.getDirectoryHandle(part, { create });
    }
    return current;
  }

  private async copyDirectory(from: string, to: string): Promise<void> {
    await this.createDirectory(to);
    const directory = await this.directory(from, false);
    for await (const [name, handle] of directoryEntries(directory)) {
      if (name.startsWith('.')) continue;
      const childFrom = `${from}/${name}`;
      const childTo = `${to}/${name}`;
      if (handle.kind === 'directory') {
        await this.copyDirectory(childFrom, childTo);
        continue;
      }
      const file = await (handle as FileSystemFileHandle).getFile();
      const parent = await this.directory(parentVaultPath(childTo), true);
      const created = await parent.getFileHandle(name, { create: true });
      const writable = await created.createWritable();
      await writable.write(file);
      await writable.close();
    }
  }
}

function directoryEntries(
  directory: FileSystemDirectoryHandle,
): AsyncIterable<[string, FileSystemHandle]> {
  return (
    directory as FileSystemDirectoryHandle & {
      entries(): AsyncIterable<[string, FileSystemHandle]>;
    }
  ).entries();
}

async function walk(directory: FileSystemDirectoryHandle, prefix: string, out: FsEntry[]) {
  for await (const [name, handle] of directoryEntries(directory)) {
    if (name.startsWith('.')) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'directory') {
      out.push({ path, kind: 'directory' });
      await walk(handle as FileSystemDirectoryHandle, path, out);
      continue;
    }
    if (isMarkdownPath(name)) out.push({ path, kind: 'file' });
  }
}
