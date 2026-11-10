import { isMarkdownPath, type Vault } from '@ai-notes/core';
import {
  fillMissingEmbeddings,
  MemoryIndex,
  type Backlink,
  type ChunkVectorWrite,
  type PendingChunk,
  type SearchHit,
} from '@ai-notes/indexer';
import { isTauri } from '../fs/runtime';

export interface NoteEmbedder {
  readonly model: string;
  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
}

export interface DesktopIndex {
  search(query: string, limit?: number): Promise<SearchHit[]>;
  searchHybrid(
    query: string,
    embedding: ArrayLike<number> | null,
    limit?: number,
    model?: string,
  ): Promise<SearchHit[]>;
  backlinks(path: string): Promise<Backlink[]>;
  reindex(): Promise<void>;
  noteSaved(path: string, content: string): Promise<void>;
  noteDeleted(path: string): Promise<void>;
  noteRenamed(from: string, to: string): Promise<void>;
  /** Embed chunks that the current model has not seen yet. Failures stay on {@link getEmbedError}. */
  syncEmbeddings(): Promise<void>;
  dispose(): void;
}

let embedderProvider: () => NoteEmbedder | null = () => null;
let embedError: string | null = null;

export function setEmbedderProvider(provider: () => NoteEmbedder | null): void {
  embedderProvider = provider;
}

export function getEmbedError(): string | null {
  return embedError;
}

async function syncEmbeddings(target: {
  pendingChunks(model: string): readonly PendingChunk[] | Promise<readonly PendingChunk[]>;
  setChunkVectors(model: string, vectors: readonly ChunkVectorWrite[]): void | Promise<void>;
}): Promise<void> {
  const embedder = embedderProvider();
  if (!embedder) {
    embedError = null;
    return;
  }
  try {
    await fillMissingEmbeddings(target, embedder.model, embedder);
    embedError = null;
  } catch (error) {
    embedError = error instanceof Error ? error.message : '嵌入失败';
  }
}

/** Embed the question when a model is configured. A failure falls back to keyword search. */
export async function retrieveNotes(query: string, limit = 6): Promise<SearchHit[]> {
  const index = getNoteIndex();
  if (!index) return [];
  const embedder = embedderProvider();
  if (!embedder) return index.searchHybrid(query, null, limit);
  try {
    const [embedding] = await embedder.embed([query]);
    if (!embedding || embedding.length === 0) return index.searchHybrid(query, null, limit);
    return index.searchHybrid(query, embedding, limit, embedder.model);
  } catch (error) {
    embedError = error instanceof Error ? error.message : '嵌入失败';
    return index.searchHybrid(query, null, limit);
  }
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

  searchHybrid(
    query: string,
    embedding: ArrayLike<number> | null,
    limit = 20,
    model?: string,
  ): Promise<SearchHit[]> {
    return Promise.resolve(
      this.index.searchHybrid(query, embedding, { limit, ...(model ? { model } : {}) }),
    );
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
    await syncEmbeddings(this.index);
  }

  noteSaved(path: string, content: string): Promise<void> {
    this.index.upsertNote({ path, content, mtime: Date.now() });
    return syncEmbeddings(this.index);
  }

  noteDeleted(path: string): Promise<void> {
    this.index.deletePath(path);
    return Promise.resolve();
  }

  noteRenamed(from: string, to: string): Promise<void> {
    this.index.renamePath(from, to);
    return Promise.resolve();
  }

  syncEmbeddings(): Promise<void> {
    return syncEmbeddings(this.index);
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

  async searchHybrid(
    query: string,
    embedding: ArrayLike<number> | null,
    limit = 20,
    model?: string,
  ): Promise<SearchHit[]> {
    await this.open();
    return invoke<SearchHit[]>('search_hybrid', {
      query,
      embedding: embedding ? Array.from(embedding) : null,
      limit,
      model: model ?? null,
    });
  }

  async backlinks(path: string): Promise<Backlink[]> {
    await this.open();
    return invoke<Backlink[]>('backlinks', { path });
  }

  async reindex(): Promise<void> {
    await this.open();
    await invoke('reindex');
    await syncEmbeddings(this.vectorTarget());
  }

  async noteSaved(path: string, content: string): Promise<void> {
    await this.open();
    await invoke('index_upsert', { path, content });
    await syncEmbeddings(this.vectorTarget());
  }

  async noteDeleted(path: string): Promise<void> {
    await this.open();
    await invoke('index_delete', { path });
  }

  async noteRenamed(from: string, to: string): Promise<void> {
    await this.open();
    await invoke('index_rename', { from, to });
  }

  async syncEmbeddings(): Promise<void> {
    await this.open();
    await syncEmbeddings(this.vectorTarget());
  }

  dispose(): void {
    this.opening = null;
  }

  private vectorTarget() {
    return {
      pendingChunks: (model: string) => invoke<PendingChunk[]>('index_pending_chunks', { model }),
      setChunkVectors: async (model: string, vectors: readonly ChunkVectorWrite[]) => {
        await invoke('index_set_vectors', {
          model,
          vectors: vectors.map((row) => ({
            chunkId: row.chunkId,
            embedding: Array.from(row.embedding),
          })),
        });
      },
    };
  }
}
