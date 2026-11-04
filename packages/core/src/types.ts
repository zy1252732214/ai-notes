/** Vault 内的相对路径，使用 `/`，不以 `/` 开头，也不包含 `.` 或 `..`。 */
export type VaultPath = string;

export interface FsEntry {
  path: VaultPath;
  kind: 'file' | 'directory';
}

export interface VaultNode {
  name: string;
  path: VaultPath;
  kind: 'file' | 'directory';
  children: VaultNode[];
}

/**
 * 笔记存储端口。桌面版走 Tauri，测试走内存实现。
 * 以后可以再加 File System Access 或 IndexedDB 适配器。
 */
export interface VaultFileSystem {
  list(): Promise<FsEntry[]>;
  readText(path: VaultPath): Promise<string>;
  writeText(path: VaultPath, contents: string): Promise<void>;
  remove(path: VaultPath): Promise<void>;
  rename(from: VaultPath, to: VaultPath): Promise<void>;
  createDirectory(path: VaultPath): Promise<void>;
  /** 外部改动时回调。返回取消订阅。 */
  watch?(onChange: () => void): () => void;
}
