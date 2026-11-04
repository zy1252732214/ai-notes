import type { FsEntry, VaultFileSystem, VaultPath } from '@ai-notes/core';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export class TauriVaultFileSystem implements VaultFileSystem {
  constructor(private readonly root: string) {}

  list(): Promise<FsEntry[]> {
    return invoke<FsEntry[]>('vault_list', { root: this.root });
  }

  readText(path: VaultPath): Promise<string> {
    return invoke<string>('vault_read', { root: this.root, path });
  }

  writeText(path: VaultPath, contents: string): Promise<void> {
    return invoke('vault_write', { root: this.root, path, contents });
  }

  remove(path: VaultPath): Promise<void> {
    return invoke('vault_remove', { root: this.root, path });
  }

  rename(from: VaultPath, to: VaultPath): Promise<void> {
    return invoke('vault_rename', { root: this.root, from, to });
  }

  createDirectory(path: VaultPath): Promise<void> {
    return invoke('vault_create_directory', { root: this.root, path });
  }

  watch(onChange: () => void): () => void {
    let unlisten: UnlistenFn | undefined;
    let stopped = false;
    void (async () => {
      try {
        await invoke('vault_watch', { root: this.root });
        const stop = await listen('vault-changed', () => onChange());
        if (stopped) stop();
        else unlisten = stop;
      } catch {
        // 监听失败时，本地操作之后仍会主动刷新文件树。
      }
    })();
    return () => {
      stopped = true;
      unlisten?.();
      void invoke('vault_unwatch').catch(() => undefined);
    };
  }
}
