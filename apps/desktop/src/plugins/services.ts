import { VaultError, basename, parentVaultPath, type Vault } from '@ai-notes/core';
import type { PluginServices } from '@ai-notes/plugin-host';
import type { NoteEvent, NoteMetadata, VaultEntry, VaultSearchHit } from '@ai-notes/plugin-sdk';
import { getNoteIndex, retrieveNotes } from '../search/client';

export interface PluginServiceHooks {
  getVault: () => Vault | null;
  getActive: () => { path: string; content: string } | null;
  onEvent: (event: NoteEvent) => void;
  onRefresh: () => Promise<void>;
  onIndexChange: () => void;
  insertAtCursor: (text: string) => void;
  replaceSelection: (text: string) => void;
}

function metadata(path: string, content: string): NoteMetadata {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return {
    path,
    title: heading || basename(path).replace(/\.md$/i, ''),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    size: new TextEncoder().encode(content).length,
    frontmatter: {},
    tags: [],
    links: [],
  };
}

async function saved(path: string, content: string, hooks: PluginServiceHooks) {
  await getNoteIndex()
    ?.noteSaved(path, content)
    .catch(() => undefined);
  hooks.onIndexChange();
}

function clampSearchLimit(limit: number | undefined): number {
  if (!Number.isInteger(limit) || limit === undefined || limit < 1) return 8;
  return Math.min(20, limit);
}

function requireVault(getVault: () => Vault | null): Vault {
  const vault = getVault();
  if (!vault) throw new VaultError('还没有打开笔记库');
  return vault;
}

export function createVaultPluginServices(hooks: PluginServiceHooks): PluginServices {
  return {
    async listNotes(folder, recursive = false) {
      const vault = hooks.getVault();
      if (!vault) return [];
      const entries = await vault.fs.list();
      const items: VaultEntry[] = entries.map((entry) => ({
        path: entry.path,
        name: basename(entry.path),
        kind: entry.kind === 'directory' ? 'folder' : 'note',
      }));
      if (!folder) return items;
      return items.filter((item) => {
        if (item.path === folder) return false;
        if (!item.path.startsWith(`${folder}/`)) return false;
        return recursive || parentVaultPath(item.path) === folder;
      });
    },
    async readNote(path) {
      return requireVault(hooks.getVault).readNote(path);
    },
    async createNote(path, content, overwrite = false) {
      const vault = requireVault(hooks.getVault);
      let created = false;
      try {
        await vault.createNote(path, content);
        created = true;
      } catch (error) {
        if (!overwrite) throw error;
        await vault.writeNote(path, content);
      }
      hooks.onEvent({ type: created ? 'note:created' : 'note:modified', path });
      await saved(path, content, hooks);
      await hooks.onRefresh();
      return metadata(path, content);
    },
    async modifyNote(path, content) {
      const vault = requireVault(hooks.getVault);
      await vault.writeNote(path, content);
      hooks.onEvent({ type: 'note:modified', path });
      await saved(path, content, hooks);
      await hooks.onRefresh();
      return metadata(path, content);
    },
    async deleteNote(path) {
      await requireVault(hooks.getVault).delete(path);
      hooks.onEvent({ type: 'note:deleted', path });
      await getNoteIndex()
        ?.noteDeleted(path)
        .catch(() => undefined);
      hooks.onIndexChange();
      await hooks.onRefresh();
    },
    async renameNote(from, to) {
      await requireVault(hooks.getVault).rename(from, to);
      hooks.onEvent({ type: 'note:renamed', from, to });
      await getNoteIndex()
        ?.noteRenamed(from, to)
        .catch(() => undefined);
      hooks.onIndexChange();
      await hooks.onRefresh();
    },
    async metadata(path) {
      const content = await requireVault(hooks.getVault).readNote(path);
      return metadata(path, content);
    },
    async searchNotes(query, limit) {
      if (!hooks.getVault()) return [];
      const hits = await retrieveNotes(query, clampSearchLimit(limit));
      return hits.map((hit): VaultSearchHit => ({
        path: hit.path,
        title: hit.title,
        headingPath: hit.headingPath,
        startOffset: hit.start,
        endOffset: hit.end,
        snippet: hit.snippet.replaceAll('<b>', '').replaceAll('</b>', ''),
      }));
    },
    activeNote() {
      const active = hooks.getActive();
      return active ? { ...active, selection: '' } : null;
    },
    async replaceSelection(text) {
      hooks.replaceSelection(text);
    },
    async insertAtCursor(text) {
      hooks.insertAtCursor(text);
    },
    async readClipboard() {
      return navigator.clipboard.readText();
    },
    async writeClipboard(text) {
      await navigator.clipboard.writeText(text);
    },
    async fetch(request) {
      const response = await fetch(request.url, {
        method: request.method ?? 'GET',
        ...(request.body !== undefined ? { body: request.body } : {}),
        ...(request.headers ? { headers: request.headers } : {}),
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return { status: response.status, headers, body: await response.text() };
    },
    async chat() {
      throw new Error('还没有配置模型');
    },
    async complete() {
      throw new Error('还没有配置模型');
    },
  };
}
