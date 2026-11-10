import { afterEach, describe, expect, it } from 'vitest';
import {
  AI_SETTINGS_KEY,
  API_KEY_ACCOUNTS,
  defaultAiSettings,
  enableKeychain,
  hasSavedAiSettings,
  loadAiSettings,
  normalizeAiSettings,
  prefillAiSettings,
  resetAiSecretStore,
  saveAiSettings,
  secretsInKeychain,
  type AiSettings,
  type KeyValueStore,
  type SecretStore,
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

function secretVault(seed?: Record<string, string>): SecretStore & {
  values: Map<string, string>;
  sets: string[];
} {
  const values = new Map(Object.entries(seed ?? {}));
  const sets: string[] = [];
  return {
    values,
    sets,
    get: (account) => Promise.resolve(values.get(account) ?? null),
    set: (account, secret) => {
      sets.push(account);
      values.set(account, secret);
      return Promise.resolve();
    },
    delete: (account) => {
      values.delete(account);
      return Promise.resolve();
    },
  };
}

describe('AI settings', () => {
  afterEach(() => {
    resetAiSecretStore();
  });

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

describe('keychain migration', () => {
  afterEach(() => {
    resetAiSecretStore();
  });

  const saved: AiSettings = {
    ...defaultAiSettings,
    provider: 'openai',
    openai: {
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      apiKey: 'sk-live-secret',
    },
    ollama: { ...defaultAiSettings.ollama, apiKey: 'ollama-token' },
    embedModel: 'text-embedding-3-small',
  };

  it('moves plaintext keys into the vault and reloads them from memory', async () => {
    const store = memoryStore();
    const vault = secretVault();
    saveAiSettings(saved, store);
    expect(store.raw()).toContain('sk-live-secret');

    await enableKeychain(vault, store);

    expect(secretsInKeychain()).toBe(true);
    expect(vault.values.get(API_KEY_ACCOUNTS.openai)).toBe('sk-live-secret');
    expect(vault.values.get(API_KEY_ACCOUNTS.ollama)).toBe('ollama-token');
    expect(store.raw()).not.toContain('sk-live-secret');
    expect(store.raw()).not.toContain('ollama-token');
    const loaded = loadAiSettings(store);
    expect(loaded.openai.apiKey).toBe('sk-live-secret');
    expect(loaded.ollama.apiKey).toBe('ollama-token');
    expect(loaded.openai.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(loaded.embedModel).toBe('text-embedding-3-small');
    const stored = JSON.parse(store.raw() ?? '{}') as {
      embedModel?: string;
      openai?: { apiKey?: string };
    };
    expect(stored.embedModel).toBe('text-embedding-3-small');
    expect(stored.openai?.apiKey).toBe('');
  });

  it('keeps the keychain value on the next launch after plaintext is gone', async () => {
    const store = memoryStore();
    const vault = secretVault();
    saveAiSettings(saved, store);
    await enableKeychain(vault, store);
    resetAiSecretStore();

    await enableKeychain(vault, store);

    expect(loadAiSettings(store).openai.apiKey).toBe('sk-live-secret');
    expect(store.raw()).not.toContain('sk-live-secret');
    expect(vault.sets).toHaveLength(2);
  });

  it('lets a newer plaintext key replace the one already in the vault', async () => {
    const store = memoryStore();
    const vault = secretVault({ [API_KEY_ACCOUNTS.openai]: 'sk-old' });
    saveAiSettings(saved, store);

    await enableKeychain(vault, store);

    expect(vault.values.get(API_KEY_ACCOUNTS.openai)).toBe('sk-live-secret');
    expect(loadAiSettings(store).openai.apiKey).toBe('sk-live-secret');
  });

  it('writes later edits to the vault and still omits them from local storage', async () => {
    const store = memoryStore();
    const vault = secretVault();
    saveAiSettings(saved, store);
    await enableKeychain(vault, store);

    await saveAiSettings(
      {
        ...loadAiSettings(store),
        openai: { ...saved.openai, apiKey: 'sk-rotated' },
      },
      store,
    );

    expect(vault.values.get(API_KEY_ACCOUNTS.openai)).toBe('sk-rotated');
    expect(vault.values.get(API_KEY_ACCOUNTS.ollama)).toBe('ollama-token');
    expect(store.raw()).not.toContain('sk-rotated');
    expect(store.raw()).not.toContain('ollama-token');
    expect(loadAiSettings(store).openai.apiKey).toBe('sk-rotated');
  });

  it('deletes a cleared key without dropping the other provider', async () => {
    const store = memoryStore();
    const vault = secretVault();
    saveAiSettings(saved, store);
    await enableKeychain(vault, store);

    await saveAiSettings(
      {
        ...loadAiSettings(store),
        provider: 'ollama',
        ollama: { ...defaultAiSettings.ollama, apiKey: '' },
      },
      store,
    );

    expect(vault.values.has(API_KEY_ACCOUNTS.ollama)).toBe(false);
    expect(vault.values.get(API_KEY_ACCOUNTS.openai)).toBe('sk-live-secret');
    expect(loadAiSettings(store).openai.apiKey).toBe('sk-live-secret');
    expect(loadAiSettings(store).ollama.apiKey).toBe('');
  });

  it('leaves plaintext in place when the vault cannot be written', async () => {
    const store = memoryStore();
    saveAiSettings(saved, store);
    const vault: SecretStore = {
      get: () => Promise.resolve(null),
      set: () => Promise.reject(new Error('secret service down')),
      delete: () => Promise.resolve(),
    };

    await expect(enableKeychain(vault, store)).rejects.toThrow(/钥匙串/);

    expect(secretsInKeychain()).toBe(false);
    expect(store.raw()).toContain('sk-live-secret');
    expect(loadAiSettings(store).openai.apiKey).toBe('sk-live-secret');
  });

  it('applies a save that arrives while migration is still writing', async () => {
    const store = memoryStore();
    saveAiSettings(saved, store);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let opened = false;
    let markOpen: () => void = () => undefined;
    const setStarted = new Promise<void>((resolve) => {
      markOpen = resolve;
    });
    const vault = secretVault();
    const waiting: SecretStore = {
      get: (account) => vault.get(account),
      delete: (account) => vault.delete(account),
      set: async (account, secret) => {
        if (!opened) {
          opened = true;
          markOpen();
          await gate;
        }
        await vault.set(account, secret);
      },
    };

    const migrating = enableKeychain(waiting, store);
    await setStarted;
    const saving = saveAiSettings(
      { ...saved, openai: { ...saved.openai, apiKey: 'sk-during-migrate' } },
      store,
    );
    release();
    await migrating;
    await saving;

    expect(loadAiSettings(store).openai.apiKey).toBe('sk-during-migrate');
    expect(vault.values.get(API_KEY_ACCOUNTS.openai)).toBe('sk-during-migrate');
    expect(store.raw()).not.toContain('sk-live-secret');
    expect(store.raw()).not.toContain('sk-during-migrate');
  });
});

describe('first-run prefill', () => {
  afterEach(() => {
    resetAiSecretStore();
  });

  it('treats a missing key as unsaved and a broken value as saved', () => {
    expect(hasSavedAiSettings(memoryStore())).toBe(false);
    expect(hasSavedAiSettings(memoryStore('not-json'))).toBe(true);
    expect(hasSavedAiSettings(memoryStore('null'))).toBe(false);
  });

  it('writes a provider once and will not replace a model the user saved later', async () => {
    const store = memoryStore();
    const draft: AiSettings = {
      ...defaultAiSettings,
      provider: 'ollama',
      ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2', apiKey: '' },
    };
    expect(await prefillAiSettings(draft, store)).toBe(true);
    expect(loadAiSettings(store).ollama.model).toBe('llama3.2');
    expect(loadAiSettings(store).ollama.apiKey).toBe('');
    saveAiSettings(
      {
        ...loadAiSettings(store),
        ollama: { ...loadAiSettings(store).ollama, model: 'qwen2.5' },
      },
      store,
    );
    expect(
      await prefillAiSettings({ ...draft, ollama: { ...draft.ollama, model: 'llama3.1' } }, store),
    ).toBe(false);
    expect(loadAiSettings(store).ollama.model).toBe('qwen2.5');
  });

  it('does not delete a key already stored in the keychain', async () => {
    const store = memoryStore();
    const vault = secretVault({ [API_KEY_ACCOUNTS.ollama]: 'keep-me' });
    await enableKeychain(vault, store);
    expect(hasSavedAiSettings(store)).toBe(false);

    const applied = await prefillAiSettings(
      {
        ...defaultAiSettings,
        provider: 'ollama',
        ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2', apiKey: '' },
      },
      store,
    );

    expect(applied).toBe(true);
    expect(vault.values.get(API_KEY_ACCOUNTS.ollama)).toBe('keep-me');
    expect(store.raw()).not.toContain('keep-me');
    expect(loadAiSettings(store).provider).toBe('ollama');
    expect(loadAiSettings(store).ollama.model).toBe('llama3.2');
    expect(loadAiSettings(store).ollama.apiKey).toBe('keep-me');
  });
});
