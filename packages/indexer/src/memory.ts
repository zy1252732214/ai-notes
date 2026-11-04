import { chunkMarkdown, extractTitle } from './chunk.js';
import { contentHash } from './hash.js';
import { extractLinks, remapIndexPath, resolveDestination, type LinkNoteRef } from './links.js';
import { buildSnippet, countOccurrences } from './snippet.js';
import type {
  Backlink,
  Chunk,
  NoteInput,
  SearchHit,
  SearchOptions,
  SyncResult,
  UpsertResult,
} from './types.js';
import { normalizeNotePath, type IndexOptions } from './indexer.js';

interface MemoryNote {
  id: number;
  path: string;
  title: string;
  hash: string;
  mtime: number;
  content: string;
  chunks: Chunk[];
}

interface MemoryLink {
  srcId: number;
  dstPath: string;
  dstId: number | null;
  kind: Backlink['kind'];
}

/** In-memory index used by the browser dev shell. The operation set matches {@link VaultIndex}. */
export class MemoryIndex {
  private nextId = 1;
  private readonly notes = new Map<number, MemoryNote>();
  private readonly links: MemoryLink[] = [];

  constructor(private readonly options: IndexOptions = {}) {}

  upsertNote(input: NoteInput): UpsertResult {
    const path = normalizeNotePath(input.path);
    if (typeof input.content !== 'string') throw new Error('content must be a string');
    if (!Number.isFinite(input.mtime)) throw new Error('mtime must be a finite number');
    const mtime = Math.trunc(input.mtime);
    const hash = contentHash(input.content);
    const existing = this.noteByPath(path);
    if (existing && existing.hash === hash) {
      existing.mtime = mtime;
      this.resolveLinks();
      return { status: 'unchanged', noteId: existing.id, chunkCount: existing.chunks.length };
    }
    const title = extractTitle(path, input.content);
    const chunks = chunkMarkdown(input.content, this.options).map((chunk, ordinal) => ({
      ...chunk,
      ordinal,
    }));
    let noteId: number;
    let status: UpsertResult['status'];
    if (!existing) {
      noteId = this.nextId;
      this.nextId += 1;
      status = 'created';
      this.notes.set(noteId, {
        id: noteId,
        path,
        title,
        hash,
        mtime,
        content: input.content,
        chunks,
      });
    } else {
      noteId = existing.id;
      status = 'updated';
      existing.title = title;
      existing.hash = hash;
      existing.mtime = mtime;
      existing.content = input.content;
      existing.chunks = chunks;
    }
    this.replaceLinks(noteId, input.content);
    return { status, noteId, chunkCount: chunks.length };
  }

  deleteNote(path: string): boolean {
    const note = this.noteByPath(normalizeNotePath(path));
    if (!note) return false;
    this.notes.delete(note.id);
    for (let index = this.links.length - 1; index >= 0; index -= 1) {
      const link = this.links[index];
      if (!link) continue;
      if (link.srcId === note.id) this.links.splice(index, 1);
      else if (link.dstId === note.id) link.dstId = null;
    }
    this.resolveLinks();
    return true;
  }

  deletePath(path: string): number {
    const normalized = normalizeNotePath(path);
    const paths = [...this.notes.values()]
      .map((note) => note.path)
      .filter((notePath) => notePath === normalized || notePath.startsWith(`${normalized}/`));
    let removed = 0;
    for (const notePath of paths) {
      if (this.deleteNote(notePath)) removed += 1;
    }
    return removed;
  }

  renamePath(from: string, to: string): number {
    const source = normalizeNotePath(from);
    const target = normalizeNotePath(to);
    if (source === target) return 0;
    let moved = 0;
    for (const note of this.notes.values()) {
      const next = remapIndexPath(note.path, source, target);
      if (next === note.path) continue;
      note.path = next;
      moved += 1;
    }
    for (const link of this.links) {
      link.dstPath = remapIndexPath(link.dstPath, source, target);
    }
    this.resolveLinks();
    return moved;
  }

  sync(notes: readonly NoteInput[]): SyncResult {
    const byPath = new Map<string, NoteInput>();
    for (const note of notes) {
      const path = normalizeNotePath(note.path);
      byPath.set(path, { ...note, path });
    }
    const result: SyncResult = { created: 0, updated: 0, deleted: 0, unchanged: 0 };
    for (const note of byPath.values()) {
      result[this.upsertNote(note).status] += 1;
    }
    for (const note of [...this.notes.values()]) {
      if (!byPath.has(note.path)) {
        this.deleteNote(note.path);
        result.deleted += 1;
      }
    }
    return result;
  }

  search(query: string, options: SearchOptions = {}): SearchHit[] {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const limit = options.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('limit must be an integer from 1 to 100');
    }
    const hits: SearchHit[] = [];
    for (const note of this.notes.values()) {
      for (const chunk of note.chunks) {
        const score =
          countOccurrences(chunk.text, trimmed) * 2 +
          countOccurrences(chunk.headingPath, trimmed) +
          countOccurrences(note.title, trimmed);
        if (score === 0) continue;
        hits.push({
          noteId: note.id,
          path: note.path,
          title: note.title,
          chunkId: note.id * 1000 + chunk.ordinal,
          headingPath: chunk.headingPath,
          start: chunk.start,
          end: chunk.end,
          text: chunk.text,
          snippet: buildSnippet(chunk.text, chunk.headingPath, note.title, trimmed),
          score,
        });
      }
    }
    return hits
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
      .slice(0, limit);
  }

  backlinks(path: string): Backlink[] {
    const normalized = normalizeNotePath(path);
    const notes = this.noteRefs();
    const basename = normalized.split('/').pop() ?? normalized;
    const sameName = notes.filter(
      (note) => note.path === basename || note.path.endsWith(`/${basename}`),
    );
    const noteId = notes.find((note) => note.path === normalized)?.id;
    return this.links
      .filter((link) => {
        if (noteId !== undefined && link.dstId === noteId) return true;
        if (link.dstPath === normalized) return true;
        return link.dstPath === basename && sameName.length === 1;
      })
      .map((link) => {
        const source = this.notes.get(link.srcId);
        return {
          path: source?.path ?? '',
          title: source?.title ?? '',
          kind: link.kind,
          dstPath: link.dstPath,
        };
      })
      .filter((link) => link.path.length > 0)
      .sort(
        (left, right) => left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind),
      );
  }

  private noteByPath(path: string): MemoryNote | undefined {
    for (const note of this.notes.values()) {
      if (note.path === path) return note;
    }
    return undefined;
  }

  private noteRefs(): LinkNoteRef[] {
    return [...this.notes.values()].map((note) => ({
      id: note.id,
      path: note.path,
      title: note.title,
    }));
  }

  private replaceLinks(noteId: number, content: string): void {
    for (let index = this.links.length - 1; index >= 0; index -= 1) {
      if (this.links[index]?.srcId === noteId) this.links.splice(index, 1);
    }
    for (const link of extractLinks(content)) {
      this.links.push({ srcId: noteId, dstPath: link.dstPath, dstId: null, kind: link.kind });
    }
    this.resolveLinks();
  }

  private resolveLinks(): void {
    const notes = this.noteRefs();
    for (const link of this.links) link.dstId = resolveDestination(link.dstPath, notes);
  }
}
