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

export const AI_SETTINGS_KEY = 'ai-notes.ai';

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

export function loadAiSettings(store: KeyValueStore = localStorage): AiSettings {
  try {
    const raw = store.getItem(AI_SETTINGS_KEY);
    if (!raw) return defaultAiSettings;
    return parseAiSettings(JSON.parse(raw) as unknown);
  } catch {
    return defaultAiSettings;
  }
}

export function saveAiSettings(settings: AiSettings, store: KeyValueStore = localStorage): void {
  const next = normalizeAiSettings(settings);
  try {
    store.setItem(AI_SETTINGS_KEY, JSON.stringify({ version: 1, ...next }));
  } catch {
    // 隐私模式可能禁用本地存储。这次会话里调用方仍可使用返回前的设置。
  }
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
