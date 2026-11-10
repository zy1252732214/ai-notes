import { afterEach, describe, expect, it } from 'vitest';
import {
  defaultAiSettings,
  loadAiSettings,
  saveAiSettings,
  type KeyValueStore,
} from '../ai/settings';
import type { OllamaDetection } from '../ai/ollamaDetect';
import {
  VAULT_OPENED_KEY,
  applyOllamaDetection,
  beginOllamaOnboarding,
  ollamaHint,
  rememberVaultOpened,
  resetOnboardingProbe,
  welcomeMode,
} from './guide';

function memoryStore(initial?: string): KeyValueStore & { raw: () => string | null } {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set('ai-notes.ai', initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    raw: () => values.get('ai-notes.ai') ?? null,
  };
}

const found: OllamaDetection = {
  ok: true,
  baseUrl: 'http://127.0.0.1:11434',
  models: [],
  chatModel: 'llama3.2',
  embedModel: 'nomic-embed-text',
};

describe('onboarding branches', () => {
  afterEach(() => {
    resetOnboardingProbe();
  });

  it('shows the first-run guide before a vault or saved settings exist', () => {
    const store = memoryStore();
    expect(welcomeMode(store)).toBe('first-run');
    rememberVaultOpened(store);
    expect(store.getItem(VAULT_OPENED_KEY)).toBe('1');
    expect(welcomeMode(store)).toBe('library');
  });

  it('prefills Ollama on first entry and leaves the API key empty', async () => {
    const store = memoryStore();
    const result = await beginOllamaOnboarding(store, () => Promise.resolve(found));
    expect(result.applied).toBe(true);
    const saved = loadAiSettings(store);
    expect(saved.provider).toBe('ollama');
    expect(saved.ollama).toEqual({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.2',
      apiKey: '',
    });
    expect(saved.embedModel).toBe('');
    expect(saved.openai.apiKey).toBe('');
    expect(ollamaHint(result)).toContain('llama3.2');
    expect(ollamaHint(result)).toContain('API Key 留空');
    expect(ollamaHint(result)).toContain('nomic-embed-text');
    expect(ollamaHint(result)).toContain('搜索仍用全文');
  });

  it('does not write settings or block the sample vault when Ollama is absent', async () => {
    const store = memoryStore();
    const result = await beginOllamaOnboarding(store, () =>
      Promise.resolve({
        ok: false,
        baseUrl: 'http://127.0.0.1:11434',
        reason: 'unreachable',
      }),
    );
    expect(result.applied).toBe(false);
    expect(store.raw()).toBeNull();
    expect(welcomeMode(store)).toBe('first-run');
    const hint = ollamaHint(result) ?? '';
    expect(hint).toContain('ollama serve');
    expect(hint).toContain('OLLAMA_ORIGINS');
    expect(hint).toContain('打开示例库');
  });

  it('does not download a chat model when Ollama has only embeddings', async () => {
    const store = memoryStore();
    const result = await beginOllamaOnboarding(store, () =>
      Promise.resolve({
        ok: true,
        baseUrl: 'http://127.0.0.1:11434',
        models: [],
        chatModel: null,
        embedModel: 'nomic-embed-text',
      }),
    );
    expect(result.applied).toBe(false);
    expect(store.raw()).toBeNull();
    expect(ollamaHint(result)).toContain('ollama pull llama3.2');
    expect(ollamaHint(result)).toContain('不会自动下载');
  });

  it('does not probe or overwrite settings that were already saved', async () => {
    const store = memoryStore();
    saveAiSettings(
      {
        ...defaultAiSettings,
        provider: 'openai',
        openai: {
          baseUrl: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat',
          apiKey: 'sk-keep',
        },
      },
      store,
    );
    expect(welcomeMode(store)).toBe('library');
    let calls = 0;
    const result = await beginOllamaOnboarding(store, () => {
      calls += 1;
      return Promise.resolve(found);
    });
    expect(calls).toBe(0);
    expect(result.applied).toBe(false);
    expect(result.detection).toBeNull();
    expect(ollamaHint(result)).toBeNull();
    expect(loadAiSettings(store).openai.apiKey).toBe('sk-keep');
    expect(loadAiSettings(store).provider).toBe('openai');
    expect(await applyOllamaDetection(found, store)).toBe(false);
    expect(loadAiSettings(store).ollama.model).toBe(defaultAiSettings.ollama.model);
  });

  it('keeps a saved model if the user stores one while detection is in flight', async () => {
    const store = memoryStore();
    let release: () => void = () => undefined;
    const detected = new Promise<OllamaDetection>((resolve) => {
      release = () => resolve(found);
    });
    const pending = beginOllamaOnboarding(store, () => detected);
    saveAiSettings(
      {
        ...defaultAiSettings,
        provider: 'ollama',
        ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'qwen2.5:7b', apiKey: '' },
      },
      store,
    );
    release();
    const result = await pending;
    expect(result.applied).toBe(false);
    expect(loadAiSettings(store).ollama.model).toBe('qwen2.5:7b');
  });
});
