import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../fs/runtime';
import { enableKeychain, type SecretStore } from './settings';

const KEYCHAIN_PROBE_MS = 3000;

/**
 * 桌面壳启动时把 API Key 接到系统钥匙串。
 * 浏览器、示例库，或这台机器没有钥匙串时什么都不做，密钥仍留在 localStorage。
 */
export async function installDesktopSecrets(): Promise<void> {
  if (!isTauri()) return;
  try {
    const available = await probeKeychain();
    if (!available) return;
    const store: SecretStore = {
      get: (account) => invoke<string | null>('secret_get', { account }),
      set: (account, secret) => invoke('secret_set', { account, secret }),
      delete: (account) => invoke('secret_delete', { account }),
    };
    await enableKeychain(store);
  } catch {
    // 钥匙串不可用时保留本地存储里的明文，避免把密钥清掉又写不进去。
  }
}

function probeKeychain(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const probe = invoke<boolean>('secret_available').catch(() => false);
  const expired = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), KEYCHAIN_PROBE_MS);
  });
  return Promise.race([probe, expired]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
