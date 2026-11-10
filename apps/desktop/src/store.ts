import {
  VaultError,
  assertEntryName,
  basename,
  createDebouncedSaver,
  createSampleVault,
  ensureMarkdownName,
  joinVaultPath,
  parentVaultPath,
  remapVaultPath,
  type DebouncedSaver,
  type Vault,
  type VaultNode,
} from '@ai-notes/core';
import { MemoryPluginStorage, type PluginStorage } from '@ai-notes/plugin-host';
import type { NoteEvent } from '@ai-notes/plugin-sdk';
import { create } from 'zustand';
import { pluginController } from './plugins/controller';
import { ensureHelloNotes } from './plugins/example';
import { createVaultPluginServices } from './plugins/services';
import { closeNoteIndex, getNoteIndex, openNoteIndex } from './search/client';

export interface NoteTab {
  path: string;
  content: string;
  savedContent: string;
  dirty: boolean;
}

export interface DialogRequest {
  kind: 'create-note' | 'create-folder' | 'rename' | 'delete';
  path?: string;
  entryKind?: 'file' | 'directory';
}

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppState {
  themeMode: ThemeMode;
  leftOpen: boolean;
  rightOpen: boolean;
  commandOpen: boolean;
  pluginsOpen: boolean;
  dialog: DialogRequest | null;
  banner: string | null;
  vault: Vault | null;
  tree: VaultNode[];
  expanded: Record<string, boolean>;
  filter: string;
  selectedDirectory: string;
  tabs: NoteTab[];
  activePath: string | null;
  saveError: string | null;
  cursor: { line: number; column: number };
  indexRevision: number;
  reveal: { path: string; start: number; end: number; token: number } | null;
  setThemeMode: (mode: ThemeMode) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  setLeftOpen: (open: boolean) => void;
  setRightOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setPluginsOpen: (open: boolean) => void;
  setFilter: (filter: string) => void;
  setCursor: (cursor: { line: number; column: number }) => void;
  setBanner: (banner: string | null) => void;
  openDialog: (dialog: DialogRequest) => void;
  closeDialog: () => void;
  openVault: (vault: Vault, plugins?: PluginStorage) => Promise<void>;
  openSampleVault: () => Promise<void>;
  refreshTree: () => Promise<void>;
  toggleExpanded: (path: string) => void;
  selectDirectory: (path: string) => void;
  openNote: (path: string, at?: { start: number; end: number }) => Promise<void>;
  closeTab: (path: string) => Promise<void>;
  updateContent: (path: string, content: string) => void;
  saveActive: () => Promise<void>;
  createNote: (name: string) => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  renameEntry: (path: string, name: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
}

const THEME_KEY = 'ai-notes.theme';
let revealToken = 0;

function nextReveal(path: string, at: { start: number; end: number }) {
  revealToken += 1;
  return { path, start: at.start, end: at.end, token: revealToken };
}
const AUTOSAVE_MS = 800;

const savers = new Map<string, DebouncedSaver>();
let stopWatch: (() => void) | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshing = false;
let refreshAgain = false;

function loadTheme(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'system';
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // 隐私模式可能禁用 localStorage。
  }
  return 'system';
}

function rememberTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // 记不住主题时，这次会话里的选择仍然生效。
  }
}

function disposeSavers() {
  for (const saver of savers.values()) saver.dispose();
  savers.clear();
}

function defaultExpanded(
  nodes: readonly VaultNode[],
  depth = 0,
  acc: Record<string, boolean> = {},
) {
  for (const node of nodes) {
    if (node.kind !== 'directory') continue;
    if (depth < 2) acc[node.path] = true;
    defaultExpanded(node.children, depth + 1, acc);
  }
  return acc;
}

function findNode(nodes: readonly VaultNode[], path: string): VaultNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    const nested = findNode(node.children, path);
    if (nested) return nested;
  }
  return null;
}

function findByName(nodes: readonly VaultNode[], name: string): string | null {
  for (const node of nodes) {
    if (node.kind === 'file' && node.name === name) return node.path;
    const nested = findByName(node.children, name);
    if (nested) return nested;
  }
  return null;
}

function firstFile(nodes: readonly VaultNode[]): string | null {
  for (const node of nodes) {
    if (node.kind === 'file') return node.path;
    const nested = firstFile(node.children);
    if (nested) return nested;
  }
  return null;
}

function remapExpanded(expanded: Record<string, boolean>, from: string, to: string) {
  const next: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(expanded)) {
    next[remapVaultPath(key, from, to)] = value;
  }
  return next;
}

async function persist(path: string, content: string): Promise<void> {
  const vault = useAppStore.getState().vault;
  if (!vault) return;
  try {
    await vault.writeNote(path, content);
    await getNoteIndex()
      ?.noteSaved(path, content)
      .catch(() => undefined);
    useAppStore.setState((state) => ({
      indexRevision: state.indexRevision + 1,
      tabs: state.tabs.map((tab) =>
        tab.path === path ? { ...tab, savedContent: content, dirty: tab.content !== content } : tab,
      ),
      saveError: state.activePath === path ? null : state.saveError,
    }));
    pluginController.emit({ type: 'note:modified', path });
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存失败';
    useAppStore.setState({ saveError: message });
    throw error;
  }
}

function saverFor(path: string): DebouncedSaver {
  const existing = savers.get(path);
  if (existing) return existing;
  const saver = createDebouncedSaver((content) => persist(path, content), AUTOSAVE_MS);
  savers.set(path, saver);
  return saver;
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    void runRefresh();
  }, 150);
}

async function runRefresh() {
  if (refreshing) {
    refreshAgain = true;
    return;
  }
  refreshing = true;
  try {
    await useAppStore.getState().refreshTree();
  } finally {
    refreshing = false;
    if (refreshAgain) {
      refreshAgain = false;
      await runRefresh();
    }
  }
}

function attachWatch(vault: Vault) {
  stopWatch?.();
  stopWatch = vault.watch(() => scheduleRefresh());
}

async function flushAffected(path: string) {
  const affected = [...savers.keys()].filter((key) => key === path || key.startsWith(`${path}/`));
  for (const key of affected) {
    await savers.get(key)?.flush();
  }
  return affected;
}

function dropSavers(paths: readonly string[]) {
  for (const path of paths) {
    savers.get(path)?.dispose();
    savers.delete(path);
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  themeMode: loadTheme(),
  leftOpen: true,
  rightOpen: true,
  commandOpen: false,
  pluginsOpen: false,
  dialog: null,
  banner: null,
  vault: null,
  tree: [],
  expanded: {},
  filter: '',
  selectedDirectory: '',
  tabs: [],
  activePath: null,
  saveError: null,
  cursor: { line: 1, column: 1 },
  indexRevision: 0,
  reveal: null,

  setThemeMode: (themeMode) => {
    rememberTheme(themeMode);
    set({ themeMode });
  },
  toggleLeft: () => set((state) => ({ leftOpen: !state.leftOpen })),
  toggleRight: () => set((state) => ({ rightOpen: !state.rightOpen })),
  setLeftOpen: (leftOpen) => set({ leftOpen }),
  setRightOpen: (rightOpen) => set({ rightOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setPluginsOpen: (pluginsOpen) => set({ pluginsOpen }),
  setFilter: (filter) => set({ filter }),
  setCursor: (cursor) => set({ cursor }),
  setBanner: (banner) => set({ banner }),
  openDialog: (dialog) => set({ dialog, commandOpen: false }),
  closeDialog: () => set({ dialog: null }),

  openVault: async (vault, plugins) => {
    stopWatch?.();
    stopWatch = null;
    disposeSavers();
    pluginController.detach();
    closeNoteIndex();
    if (refreshTimer) clearTimeout(refreshTimer);
    set({
      vault,
      tree: [],
      expanded: {},
      tabs: [],
      activePath: null,
      selectedDirectory: '',
      filter: '',
      saveError: null,
      banner: null,
      cursor: { line: 1, column: 1 },
      dialog: null,
      commandOpen: false,
    });
    await get().refreshTree();
    try {
      await openNoteIndex(vault);
      set((state) => ({ indexRevision: state.indexRevision + 1 }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '索引失败';
      set({ banner: message });
    }
    attachWatch(vault);
    if (plugins) {
      await ensureHelloNotes(plugins);
      await pluginController.attach(plugins, vaultServices(), {
        onLog: (message) => useAppStore.getState().setBanner(message),
      });
    }
    const tree = get().tree;
    const initial = findByName(tree, '欢迎.md') ?? firstFile(tree);
    if (initial) await get().openNote(initial);
  },

  openSampleVault: async () => {
    await get().openVault(createSampleVault(), new MemoryPluginStorage());
  },

  refreshTree: async () => {
    const vault = get().vault;
    if (!vault) return;
    const tree = await vault.listTree();
    set((state) => {
      const expanded = { ...state.expanded };
      for (const [path, open] of Object.entries(defaultExpanded(tree))) {
        if (!(path in expanded)) expanded[path] = open;
      }
      return { tree, expanded };
    });

    const activePath = get().activePath;
    const tab = get().tabs.find((item) => item.path === activePath);
    if (!activePath || !tab || tab.dirty) return;
    try {
      const content = await vault.readNote(activePath);
      if (content === tab.content) return;
      set((state) => ({
        tabs: state.tabs.map((item) =>
          item.path === activePath
            ? { ...item, content, savedContent: content, dirty: false }
            : item,
        ),
      }));
    } catch {
      set((state) => {
        const tabs = state.tabs.filter((item) => item.path !== activePath);
        return { tabs, activePath: tabs.at(-1)?.path ?? null };
      });
    }
  },

  toggleExpanded: (path) =>
    set((state) => ({
      expanded: { ...state.expanded, [path]: !state.expanded[path] },
    })),

  selectDirectory: (selectedDirectory) => set({ selectedDirectory }),

  openNote: async (path, at) => {
    const vault = get().vault;
    if (!vault) return;
    const reveal = at ? nextReveal(path, at) : null;
    const existing = get().tabs.find((tab) => tab.path === path);
    if (existing) {
      set({
        activePath: path,
        selectedDirectory: parentVaultPath(path),
        saveError: null,
        cursor: { line: 1, column: 1 },
        reveal,
      });
      pluginController.emit({ type: 'note:opened', path });
      return;
    }
    const content = await vault.readNote(path);
    set((state) => ({
      tabs: [...state.tabs, { path, content, savedContent: content, dirty: false }],
      activePath: path,
      selectedDirectory: parentVaultPath(path),
      saveError: null,
      cursor: { line: 1, column: 1 },
      reveal,
    }));
    pluginController.emit({ type: 'note:opened', path });
  },

  closeTab: async (path) => {
    try {
      await savers.get(path)?.flush();
    } catch {
      return;
    }
    savers.get(path)?.dispose();
    savers.delete(path);
    set((state) => {
      const tabs = state.tabs.filter((tab) => tab.path !== path);
      const activePath = state.activePath === path ? (tabs.at(-1)?.path ?? null) : state.activePath;
      return { tabs, activePath, saveError: null };
    });
  },

  updateContent: (path, content) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path === path ? { ...tab, content, dirty: content !== tab.savedContent } : tab,
      ),
      saveError: state.activePath === path ? null : state.saveError,
    }));
    const tab = get().tabs.find((item) => item.path === path);
    if (!tab?.dirty) {
      savers.get(path)?.cancel();
      return;
    }
    saverFor(path).schedule(content);
  },

  saveActive: async () => {
    const path = get().activePath;
    if (!path) return;
    const tab = get().tabs.find((item) => item.path === path);
    if (!tab) return;
    if (!savers.has(path)) {
      if (!tab.dirty) return;
      saverFor(path).schedule(tab.content);
    }
    try {
      await savers.get(path)?.flush();
    } catch {
      // persist 已经把原因写进 saveError。
    }
  },

  createNote: async (name) => {
    const vault = get().vault;
    if (!vault) throw new VaultError('还没有打开笔记库');
    const fileName = ensureMarkdownName(name);
    const path = joinVaultPath(get().selectedDirectory, fileName);
    const title = fileName.replace(/\.md$/i, '');
    const content = `# ${title}\n\n`;
    await vault.createNote(path, content);
    pluginController.emit({ type: 'note:created', path });
    await getNoteIndex()
      ?.noteSaved(path, content)
      .catch(() => undefined);
    set((state) => ({ indexRevision: state.indexRevision + 1 }));
    await get().refreshTree();
    const directory = parentVaultPath(path);
    if (directory) {
      set((state) => ({ expanded: { ...state.expanded, [directory]: true } }));
    }
    await get().openNote(path);
  },

  createFolder: async (name) => {
    const vault = get().vault;
    if (!vault) throw new VaultError('还没有打开笔记库');
    const path = joinVaultPath(get().selectedDirectory, assertEntryName(name));
    await vault.createFolder(path);
    await get().refreshTree();
    set((state) => ({
      selectedDirectory: path,
      expanded: {
        ...state.expanded,
        [path]: true,
        ...(parentVaultPath(path) ? { [parentVaultPath(path)]: true } : {}),
      },
    }));
  },

  renameEntry: async (path, name) => {
    const vault = get().vault;
    if (!vault) throw new VaultError('还没有打开笔记库');
    const node = findNode(get().tree, path);
    if (!node) throw new VaultError('找不到要重命名的项目');
    const nextName = node.kind === 'file' ? ensureMarkdownName(name) : assertEntryName(name);
    const target = joinVaultPath(parentVaultPath(path), nextName);
    if (target === path) return;
    const affected = await flushAffected(path);
    await vault.rename(path, target);
    pluginController.emit({ type: 'note:renamed', from: path, to: target });
    await getNoteIndex()
      ?.noteRenamed(path, target)
      .catch(() => undefined);
    set((state) => ({ indexRevision: state.indexRevision + 1 }));
    dropSavers(affected);
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        const next = remapVaultPath(tab.path, path, target);
        return next === tab.path ? tab : { ...tab, path: next };
      }),
      activePath: state.activePath ? remapVaultPath(state.activePath, path, target) : null,
      selectedDirectory: state.selectedDirectory
        ? remapVaultPath(state.selectedDirectory, path, target)
        : '',
      expanded: remapExpanded(state.expanded, path, target),
    }));
    await get().refreshTree();
  },

  deleteEntry: async (path) => {
    const vault = get().vault;
    if (!vault) throw new VaultError('还没有打开笔记库');
    const affected = [...savers.keys()].filter((key) => key === path || key.startsWith(`${path}/`));
    for (const key of affected) savers.get(key)?.cancel();
    for (const key of affected) await savers.get(key)?.flush();
    await vault.delete(path);
    pluginController.emit({ type: 'note:deleted', path });
    await getNoteIndex()
      ?.noteDeleted(path)
      .catch(() => undefined);
    set((state) => ({ indexRevision: state.indexRevision + 1 }));
    dropSavers(affected);
    set((state) => {
      const tabs = state.tabs.filter(
        (tab) => tab.path !== path && !tab.path.startsWith(`${path}/`),
      );
      const activeGone =
        state.activePath === path || Boolean(state.activePath?.startsWith(`${path}/`));
      const directoryGone =
        state.selectedDirectory === path || state.selectedDirectory.startsWith(`${path}/`);
      return {
        tabs,
        activePath: activeGone ? (tabs.at(-1)?.path ?? null) : state.activePath,
        selectedDirectory: directoryGone ? parentVaultPath(path) : state.selectedDirectory,
      };
    });
    await get().refreshTree();
  },
}));

function vaultServices() {
  return createVaultPluginServices({
    getVault: () => useAppStore.getState().vault,
    getActive: () => {
      const state = useAppStore.getState();
      const tab = state.tabs.find((item) => item.path === state.activePath);
      return tab && state.activePath ? { path: state.activePath, content: tab.content } : null;
    },
    onEvent: (event: NoteEvent) => pluginController.emit(event),
    onRefresh: () => useAppStore.getState().refreshTree(),
    onIndexChange: () =>
      useAppStore.setState((state) => ({ indexRevision: state.indexRevision + 1 })),
    insertAtCursor: (text) => appendToActive(text),
    replaceSelection: (text) => appendToActive(text),
  });
}

function appendToActive(text: string) {
  const state = useAppStore.getState();
  if (!state.activePath) return;
  const tab = state.tabs.find((item) => item.path === state.activePath);
  if (!tab) return;
  state.updateContent(state.activePath, `${tab.content}${text}`);
}

export function noteTitle(path: string): string {
  return basename(path).replace(/\.md$/i, '');
}
