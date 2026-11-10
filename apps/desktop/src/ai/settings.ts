export type AiProviderId = 'openai' | 'ollama';

export interface ProviderSettings {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface AiSettings {
  provider: AiProviderId;
  openai: ProviderSettings;
  ollama: ProviderSettings;
  /** Empty means keyword search only. Uses the active provider's address and API key. */
  embedModel: string;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** 系统钥匙串。浏览器里没有实现时，密钥继续留在本地存储。 */
export interface SecretStore {
  get(account: string): Promise<string | null>;
  set(account: string, secret: string): Promise<void>;
  delete(account: string): Promise<void>;
}

export const AI_SETTINGS_KEY = 'ai-notes.ai';

/** 与桌面端 Rust 命令允许的账户名一致。 */
export const API_KEY_ACCOUNTS = {
  openai: 'openai-api-key',
  ollama: 'ollama-api-key',
} as const;

type ProviderKey = keyof typeof API_KEY_ACCOUNTS;

interface SecretCache {
  openai: string;
  ollama: string;
}

export const defaultAiSettings: AiSettings = {
  provider: 'openai',
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: '',
  },
  ollama: {
    baseUrl: 'http://127.0.0.1:11434',
    model: 'llama3.2',
    apiKey: '',
  },
  embedModel: '',
};

let keychain: SecretStore | null = null;
let cache: SecretCache | null = null;
let migrating = false;
let tail: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): Promise<void> {
  const run = tail.then(task, task);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** 当前进程是否已经把 API Key 交给钥匙串。 */
export function secretsInKeychain(): boolean {
  return keychain !== null && cache !== null;
}

/** 测试用：忘掉已接上的钥匙串，不改存储里的内容。 */
export function resetAiSecretStore(): void {
  keychain = null;
  cache = null;
  migrating = false;
  tail = Promise.resolve();
}

export function loadAiSettings(store: KeyValueStore = localStorage): AiSettings {
  return overlay(readStore(store));
}

export function saveAiSettings(
  settings: AiSettings,
  store: KeyValueStore = localStorage,
): Promise<void> {
  const next = normalizeAiSettings(settings);
  if (keychain && cache) return enqueue(() => persistSecrets(next, store));
  if (migrating) return enqueue(() => persistSecrets(next, store));
  writeStore(store, next);
  return Promise.resolve();
}

/**
 * 把本地存储里的明文 Key 迁进钥匙串并清掉明文。
 * 钥匙串写入失败时保持原样，调用方可以继续用本地存储。
 */
export function enableKeychain(
  store: SecretStore,
  kv: KeyValueStore = localStorage,
): Promise<void> {
  migrating = true;
  return enqueue(async () => {
    try {
      await adoptKeychain(store, kv);
    } finally {
      migrating = false;
    }
  });
}

export function normalizeAiSettings(input: AiSettings): AiSettings {
  const provider: AiProviderId = input.provider === 'ollama' ? 'ollama' : 'openai';
  const openai = cleanProvider(input.openai, defaultAiSettings.openai);
  const ollama = cleanProvider(input.ollama, defaultAiSettings.ollama);
  const active = provider === 'ollama' ? ollama : openai;
  if (!active.baseUrl) throw new Error('请填写接口地址');
  if (!active.model) throw new Error('请填写模型名称');
  if (provider === 'openai' && !active.apiKey) throw new Error('请填写 API Key');
  assertBaseUrl(active.baseUrl);
  if (openai.baseUrl) assertBaseUrl(openai.baseUrl);
  if (ollama.baseUrl) assertBaseUrl(ollama.baseUrl);
  return {
    provider,
    openai,
    ollama,
    embedModel: typeof input.embedModel === 'string' ? input.embedModel.trim() : '',
  };
}

export function activeProvider(settings: AiSettings): ProviderSettings {
  return settings.provider === 'ollama' ? settings.ollama : settings.openai;
}

async function adoptKeychain(store: SecretStore, kv: KeyValueStore): Promise<void> {
  const parsed = readStore(kv);
  let existing: SecretCache;
  try {
    existing = await readSecrets(store);
  } catch {
    throw new Error('无法读取系统钥匙串');
  }
  const secrets: SecretCache = {
    openai: parsed.openai.apiKey || existing.openai,
    ollama: parsed.ollama.apiKey || existing.ollama,
  };
  try {
    await copyPlaintext(store, parsed, existing);
  } catch {
    throw new Error('无法写入系统钥匙串');
  }
  keychain = store;
  cache = secrets;
  if (parsed.openai.apiKey || parsed.ollama.apiKey) writeStore(kv, stripKeys(parsed));
}

async function persistSecrets(next: AiSettings, store: KeyValueStore): Promise<void> {
  if (!keychain || !cache) {
    writeStore(store, next);
    return;
  }
  const secrets: SecretCache = {
    openai: next.openai.apiKey,
    ollama: next.ollama.apiKey,
  };
  try {
    await writeSecrets(keychain, secrets);
  } catch {
    throw new Error('无法写入系统钥匙串');
  }
  cache = secrets;
  writeStore(store, stripKeys(next));
}

async function readSecrets(store: SecretStore): Promise<SecretCache> {
  const [openai, ollama] = await Promise.all([
    store.get(API_KEY_ACCOUNTS.openai),
    store.get(API_KEY_ACCOUNTS.ollama),
  ]);
  return { openai: openai ?? '', ollama: ollama ?? '' };
}

async function copyPlaintext(
  store: SecretStore,
  parsed: AiSettings,
  existing: SecretCache,
): Promise<void> {
  const writes: Promise<void>[] = [];
  if (parsed.openai.apiKey && parsed.openai.apiKey !== existing.openai) {
    writes.push(store.set(API_KEY_ACCOUNTS.openai, parsed.openai.apiKey));
  }
  if (parsed.ollama.apiKey && parsed.ollama.apiKey !== existing.ollama) {
    writes.push(store.set(API_KEY_ACCOUNTS.ollama, parsed.ollama.apiKey));
  }
  await Promise.all(writes);
}

async function writeSecrets(store: SecretStore, secrets: SecretCache): Promise<void> {
  await Promise.all(
    (Object.keys(API_KEY_ACCOUNTS) as ProviderKey[]).map(async (provider) => {
      const account = API_KEY_ACCOUNTS[provider];
      const value = secrets[provider];
      if (value) await store.set(account, value);
      else await store.delete(account);
    }),
  );
}

function overlay(settings: AiSettings): AiSettings {
  if (!cache) return settings;
  return {
    ...settings,
    openai: { ...settings.openai, apiKey: cache.openai },
    ollama: { ...settings.ollama, apiKey: cache.ollama },
  };
}

function stripKeys(settings: AiSettings): AiSettings {
  return {
    ...settings,
    openai: { ...settings.openai, apiKey: '' },
    ollama: { ...settings.ollama, apiKey: '' },
  };
}

function readStore(store: KeyValueStore): AiSettings {
  try {
    const raw = store.getItem(AI_SETTINGS_KEY);
    if (!raw) return defaultAiSettings;
    return parseAiSettings(JSON.parse(raw) as unknown);
  } catch {
    return defaultAiSettings;
  }
}

function writeStore(store: KeyValueStore, settings: AiSettings): void {
  try {
    store.setItem(AI_SETTINGS_KEY, JSON.stringify({ version: 1, ...settings }));
  } catch {
    // 隐私模式可能禁用本地存储。这次会话里调用方仍可使用内存中的设置。
  }
}

function parseAiSettings(value: unknown): AiSettings {
  if (!value || typeof value !== 'object') return defaultAiSettings;
  const record = value as Partial<AiSettings> & { provider?: string };
  return {
    provider: record.provider === 'ollama' ? 'ollama' : 'openai',
    openai: cleanProvider(record.openai, defaultAiSettings.openai),
    ollama: cleanProvider(record.ollama, defaultAiSettings.ollama),
    embedModel: typeof record.embedModel === 'string' ? record.embedModel.trim() : '',
  };
}

function cleanProvider(value: unknown, fallback: ProviderSettings): ProviderSettings {
  if (!value || typeof value !== 'object') return { ...fallback };
  const record = value as Partial<ProviderSettings>;
  return {
    baseUrl: typeof record.baseUrl === 'string' ? record.baseUrl.trim() : fallback.baseUrl,
    model: typeof record.model === 'string' ? record.model.trim() : fallback.model,
    apiKey: typeof record.apiKey === 'string' ? record.apiKey.trim() : '',
  };
}

function assertBaseUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('接口地址需要是 http 或 https 链接');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('接口地址需要是 http 或 https 链接');
  }
}
