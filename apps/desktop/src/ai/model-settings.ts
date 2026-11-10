import { ModelRouter, OllamaProvider, OpenAICompatibleProvider } from '@ai-notes/ai';

import { getEmbedError, getNoteIndex, setEmbedderProvider } from '../search/client';

export type ChatProviderId = 'openai' | 'ollama';
export type EmbedProviderId = 'off' | 'openai' | 'ollama';

export interface ModelSettings {
  chatProvider: ChatProviderId;
  chatBaseUrl: string;
  chatModel: string;
  embedProvider: EmbedProviderId;
  embedBaseUrl: string;
  embedModel: string;
}

export interface ModelSecrets {
  chatApiKey: string;
  embedApiKey: string;
}

export const OPENAI_ROOT = 'https://api.openai.com/v1';
export const OLLAMA_ROOT = 'http://127.0.0.1:11434';

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  chatProvider: 'openai',
  chatBaseUrl: OPENAI_ROOT,
  chatModel: '',
  embedProvider: 'off',
  embedBaseUrl: OLLAMA_ROOT,
  embedModel: '',
};

const STORAGE_KEY = 'ai-notes.model-settings';

interface ModelSnapshot {
  settings: ModelSettings;
  secrets: ModelSecrets;
}

let settings = loadSettings();
let secrets: ModelSecrets = { chatApiKey: '', embedApiKey: '' };
let snapshot: ModelSnapshot = { settings, secrets };
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = { settings, secrets };
  for (const listener of listeners) listener();
}

export function subscribeModelSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getModelSettings(): ModelSnapshot {
  return snapshot;
}

export function chatConfigured(value: ModelSettings = settings): boolean {
  return value.chatModel.trim().length > 0 && value.chatBaseUrl.trim().length > 0;
}

export function embedConfigured(value: ModelSettings = settings): boolean {
  return (
    value.embedProvider !== 'off' &&
    value.embedModel.trim().length > 0 &&
    value.embedBaseUrl.trim().length > 0
  );
}

export function embedModelId(value: ModelSettings = settings): string {
  return `${value.embedProvider}:${value.embedModel.trim()}`;
}

export function defaultBaseUrl(provider: ChatProviderId | EmbedProviderId): string {
  if (provider === 'ollama') return OLLAMA_ROOT;
  if (provider === 'openai') return OPENAI_ROOT;
  return '';
}

export async function updateModelSettings(next: ModelSettings): Promise<void> {
  settings = sanitize(next);
  persist(settings);
  emit();
  await getNoteIndex()?.syncEmbeddings();
  emit();
}

export function updateModelSecrets(next: Partial<ModelSecrets>): void {
  secrets = { ...secrets, ...next };
  emit();
}

/** Retry embeddings after a key is entered. Partial keystrokes should not call the model. */
export async function retryEmbeddings(): Promise<void> {
  await getNoteIndex()?.syncEmbeddings();
  emit();
}

export function createChatRouter(): ModelRouter | null {
  if (!chatConfigured()) return null;
  const apiKey = secrets.chatApiKey.trim() || undefined;
  const provider =
    settings.chatProvider === 'ollama'
      ? new OllamaProvider({
          id: 'chat',
          baseUrl: settings.chatBaseUrl.trim(),
          ...(apiKey ? { apiKey } : {}),
          defaultModel: settings.chatModel.trim(),
        })
      : new OpenAICompatibleProvider({
          id: 'chat',
          baseUrl: settings.chatBaseUrl.trim(),
          ...(apiKey ? { apiKey } : {}),
          defaultModel: settings.chatModel.trim(),
        });
  return new ModelRouter({ providers: [provider] });
}

setEmbedderProvider(() => {
  if (!embedConfigured()) return null;
  return {
    model: embedModelId(),
    embed: (texts) => embedTexts(texts),
  };
});

async function embedTexts(texts: readonly string[]): Promise<number[][]> {
  if (!embedConfigured() || texts.length === 0) return [];
  const apiKey =
    secrets.embedApiKey.trim() ||
    (settings.embedProvider === settings.chatProvider ? secrets.chatApiKey.trim() : '');
  const provider =
    settings.embedProvider === 'ollama'
      ? new OllamaProvider({
          id: 'embed',
          baseUrl: settings.embedBaseUrl.trim(),
          ...(apiKey ? { apiKey } : {}),
          defaultModel: settings.embedModel.trim(),
        })
      : new OpenAICompatibleProvider({
          id: 'embed',
          baseUrl: settings.embedBaseUrl.trim(),
          ...(apiKey ? { apiKey } : {}),
          defaultModel: settings.embedModel.trim(),
        });
  const router = new ModelRouter({ providers: [provider] });
  const result = await router.embed({
    input: texts.length === 1 ? (texts[0] ?? '') : [...texts],
    model: settings.embedModel.trim(),
    feature: 'embed',
  });
  return result.embeddings;
}

function sanitize(value: ModelSettings): ModelSettings {
  const chatProvider = value.chatProvider === 'ollama' ? 'ollama' : 'openai';
  const embedProvider =
    value.embedProvider === 'openai' || value.embedProvider === 'ollama'
      ? value.embedProvider
      : 'off';
  return {
    chatProvider,
    chatBaseUrl: value.chatBaseUrl.trim() || defaultBaseUrl(chatProvider),
    chatModel: value.chatModel.trim(),
    embedProvider,
    embedBaseUrl:
      value.embedBaseUrl.trim() ||
      defaultBaseUrl(embedProvider === 'off' ? 'ollama' : embedProvider),
    embedModel: value.embedModel.trim(),
  };
}

function loadSettings(): ModelSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_MODEL_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MODEL_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ModelSettings>;
    return sanitize({ ...DEFAULT_MODEL_SETTINGS, ...parsed });
  } catch {
    return DEFAULT_MODEL_SETTINGS;
  }
}

function persist(value: ModelSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // 记不住地址和模型名时，这次会话里的选择仍然生效。密钥本来就不写这里。
  }
}

export function currentEmbedError(): string | null {
  return getEmbedError();
}
