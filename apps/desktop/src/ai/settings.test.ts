import { describe, expect, it } from 'vitest';
import {
  AI_SETTINGS_KEY,
  defaultAiSettings,
  loadAiSettings,
  normalizeAiSettings,
  saveAiSettings,
  type AiSettings,
  type KeyValueStore,
} from './settings.js';

function memoryStore(initial?: string): KeyValueStore & { raw: () => string | null } {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
    raw: () => value,
  };
}

describe('AI settings', () => {
  it('round-trips the provider and API key in local storage', () => {
    const store = memoryStore();
    const settings: AiSettings = {
      ...defaultAiSettings,
      provider: 'openai',
      openai: {
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        apiKey: 'sk-test',
      },
    };
    saveAiSettings(settings, store);
    expect(store.raw()).toContain('sk-test');
    expect(loadAiSettings(store)).toEqual(settings);
    expect(JSON.parse(store.raw() ?? '{}')).toMatchObject({ version: 1 });
  });

  it('keeps the other provider when switching', () => {
    const store = memoryStore();
    saveAiSettings(
      {
        ...defaultAiSettings,
        openai: { ...defaultAiSettings.openai, apiKey: 'sk-keep' },
      },
      store,
    );
    saveAiSettings({ ...loadAiSettings(store), provider: 'ollama' }, store);
    expect(loadAiSettings(store).openai.apiKey).toBe('sk-keep');
    expect(loadAiSettings(store).provider).toBe('ollama');
  });

  it('falls back when the stored value is unreadable', () => {
    expect(loadAiSettings(memoryStore('not-json'))).toEqual(defaultAiSettings);
    expect(loadAiSettings(memoryStore()).provider).toBe('openai');
    expect(AI_SETTINGS_KEY).toBe('ai-notes.ai');
  });

  it('requires an API key for the OpenAI-compatible provider', () => {
    expect(() => normalizeAiSettings(defaultAiSettings)).toThrow(/API Key/);
    expect(() =>
      normalizeAiSettings({
        ...defaultAiSettings,
        openai: { ...defaultAiSettings.openai, apiKey: 'sk-test', baseUrl: 'ftp://example.test' },
      }),
    ).toThrow(/http/);
  });
});
