import { isMarkdownPath, type Vault } from '@ai-notes/core';
import { MemoryIndex, type Backlink, type SearchHit } from '@ai-notes/indexer';
import { isTauri } from '../fs/runtime';

export interface DesktopIndex {
  search(query: string, limit?: number): Promise<SearchHit[]>;
  backlinks(path: string): Promise<Backlink[]>;
  reindex(): Promise<void>;
  noteSaved(path: string, content: string): Promise<void>;
  noteDeleted(path: string): Promise<void>;
  noteRenamed(from: string, to: string): Promise<void>;
  dispose(): void;
}

let active: DesktopIndex | null = null;

export function getNoteIndex(): DesktopIndex | null {
  return active;
}

export async function openNoteIndex(vault: Vault): Promise<void> {
  active?.dispose();
  active = createDesktopIndex(vault);
  await active.reindex();
}

export function closeNoteIndex(): void {
  active?.dispose();
  active = null;
}

export function createDesktopIndex(vault: Vault): DesktopIndex {
  if (vault.root && isTauri()) return new TauriNoteIndex(vault.root);
  return new MemoryDesktopIndex(vault);
}

class MemoryDesktopIndex implements DesktopIndex {
  private readonly index = new MemoryIndex();

  constructor(private readonly vault: Vault) {}

  search(query: string, limit = 20): Promise<SearchHit[]> {
    return Promise.resolve(this.index.search(query, { limit }));
  }

  backlinks(path: string): Promise<Backlink[]> {
    return Promise.resolve(this.index.backlinks(path));
  }

  async reindex(): Promise<void> {
    const notes = [];
    for (const entry of await this.vault.fs.list()) {
      if (entry.kind !== 'file' || !isMarkdownPath(entry.path)) continue;
      notes.push({
        path: entry.path,
        content: await this.vault.fs.readText(entry.path),
        mtime: Date.now(),
      });
    }
    this.index.sync(notes);
  }

  noteSaved(path: string, content: string): Promise<void> {
    this.index.upsertNote({ path, content, mtime: Date.now() });
    return Promise.resolve();
  }

  noteDeleted(path: string): Promise<void> {
    this.index.deletePath(path);
    return Promise.resolve();
  }

  noteRenamed(from: string, to: string): Promise<void> {
    this.index.renamePath(from, to);
    return Promise.resolve();
  }

  dispose(): void {
    // The memory index is discarded with the session.
  }
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const tauri = await import('@tauri-apps/api/core');
  return tauri.invoke<T>(command, args);
}

class TauriNoteIndex implements DesktopIndex {
  private opening: Promise<void> | null = null;

  constructor(private readonly root: string) {}

  private open(): Promise<void> {
    this.opening ??= invoke('index_open', { root: this.root });
    return this.opening;
  }

  async search(query: string, limit = 20): Promise<SearchHit[]> {
    await this.open();
    return invoke<SearchHit[]>('search', { query, limit });
  }

  async backlinks(path: string): Promise<Backlink[]> {
    await this.open();
    return invoke<Backlink[]>('backlinks', { path });
  }

  async reindex(): Promise<void> {
    await this.open();
    await invoke('reindex');
  }

  async noteSaved(path: string, content: string): Promise<void> {
    await this.open();
    await invoke('index_upsert', { path, content });
  }

  async noteDeleted(path: string): Promise<void> {
    await this.open();
    await invoke('index_delete', { path });
  }

  async noteRenamed(from: string, to: string): Promise<void> {
    await this.open();
    await invoke('index_rename', { from, to });
  }

  dispose(): void {
    this.opening = null;
  }
}
