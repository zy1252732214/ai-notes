import type { PluginStorage } from '@ai-notes/plugin-host';
import { invoke } from '@tauri-apps/api/core';

function ainotesPath(path: string): string {
  return `.ainotes/${path.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

export class TauriPluginStorage implements PluginStorage {
  constructor(private readonly root: string) {}

  read(path: string): Promise<string | null> {
    return invoke<string | null>('plugin_read', { root: this.root, path: ainotesPath(path) });
  }

  write(path: string, contents: string): Promise<void> {
    return invoke('plugin_write', { root: this.root, path: ainotesPath(path), contents });
  }

  list(dir: string): Promise<readonly string[]> {
    return invoke<string[]>('plugin_list', { root: this.root, path: ainotesPath(dir) });
  }
}

export class BrowserPluginStorage implements PluginStorage {
  constructor(private readonly root: FileSystemDirectoryHandle) {}

  async read(path: string): Promise<string | null> {
    const parts = path.split('/').filter(Boolean);
    const file = parts.pop();
    if (!file) return null;
    try {
      let current = await this.root.getDirectoryHandle('.ainotes');
      for (const part of parts) current = await current.getDirectoryHandle(part);
      const handle = await current.getFileHandle(file);
      return (await handle.getFile()).text();
    } catch {
      return null;
    }
  }

  async write(path: string, contents: string): Promise<void> {
    const parts = path.split('/').filter(Boolean);
    const file = parts.pop();
    if (!file) throw new Error('插件路径无效');
    let current = await this.root.getDirectoryHandle('.ainotes', { create: true });
    for (const part of parts) current = await current.getDirectoryHandle(part, { create: true });
    const handle = await current.getFileHandle(file, { create: true });
    const writable = await handle.createWritable();
    await writable.write(contents);
    await writable.close();
  }

  async list(dir: string): Promise<readonly string[]> {
    try {
      let current = await this.root.getDirectoryHandle('.ainotes');
      for (const part of dir.split('/').filter(Boolean)) {
        current = await current.getDirectoryHandle(part);
      }
      const names: string[] = [];
      for await (const [name] of current.entries()) names.push(name);
      return names.sort();
    } catch {
      return [];
    }
  }
}
