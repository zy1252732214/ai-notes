import { describe, expect, it } from 'vitest';
import { installDesktopSecrets } from './keychain.js';
import {
  loadAiSettings,
  saveAiSettings,
  secretsInKeychain,
  type KeyValueStore,
} from './settings.js';

function memoryStore(): KeyValueStore & { raw: () => string | null } {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
    raw: () => value,
  };
}

describe('installDesktopSecrets', () => {
  it('keeps local storage when the shell has no keychain', async () => {
    expect(secretsInKeychain()).toBe(false);
    await expect(installDesktopSecrets()).resolves.toBeUndefined();
    expect(secretsInKeychain()).toBe(false);

    const store = memoryStore();
    saveAiSettings(
      {
        provider: 'openai',
        openai: {
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          apiKey: 'sk-browser',
        },
        ollama: {
          baseUrl: 'http://127.0.0.1:11434',
          model: 'llama3.2',
          apiKey: '',
        },
        embedModel: '',
      },
      store,
    );
    expect(loadAiSettings(store).openai.apiKey).toBe('sk-browser');
    expect(store.raw()).toContain('sk-browser');
  });
});
