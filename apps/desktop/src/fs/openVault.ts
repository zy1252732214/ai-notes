import { Vault, VaultError } from '@ai-notes/core';
import type { PluginStorage } from '@ai-notes/plugin-host';
import { BrowserPluginStorage, TauriPluginStorage } from '../plugins/storage';
import { BrowserDirectoryFileSystem } from './browserFs';
import { folderName, isTauri } from './runtime';
import { TauriVaultFileSystem } from './tauriFs';

export interface OpenedVault {
  vault: Vault;
  plugins: PluginStorage;
}

export async function openFolderVault(): Promise<OpenedVault | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择笔记文件夹',
    });
    if (selected === null || Array.isArray(selected)) return null;
    return {
      vault: new Vault(folderName(selected), new TauriVaultFileSystem(selected)),
      plugins: new TauriPluginStorage(selected),
    };
  }

  const picker = (
    window as Window & {
      showDirectoryPicker?: (options?: {
        mode?: 'read' | 'readwrite';
      }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker;

  if (!picker) {
    throw new VaultError('当前环境不能打开本地文件夹。请使用桌面应用，或换用 Chrome / Edge。');
  }

  try {
    const handle = await picker({ mode: 'readwrite' });
    return {
      vault: new Vault(handle.name || 'Vault', new BrowserDirectoryFileSystem(handle)),
      plugins: new BrowserPluginStorage(handle),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
}
