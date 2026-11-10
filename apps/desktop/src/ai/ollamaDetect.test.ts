import { describe, expect, it } from 'vitest';
import type { FetchLike } from '@ai-notes/ai';
import {
  DEFAULT_OLLAMA_BASE_URL,
  detectLocalOllama,
  pickChatModel,
  pickEmbedModel,
  type OllamaListedModel,
} from './ollamaDetect';

function model(
  name: string,
  details?: { family?: string; parameter_size?: string },
): OllamaListedModel & { details?: { family?: string; parameter_size?: string } } {
  return {
    name,
    ...(details?.family ? { family: details.family } : {}),
    ...(details?.parameter_size ? { parameterSize: details.parameter_size } : {}),
    ...(details ? { details } : {}),
  };
}

function tags(models: ReturnType<typeof model>[]): { models: typeof models } {
  return { models };
}

describe('local Ollama detection', () => {
  it('lists models from GET /api/tags and does not pull', async () => {
    const calls: { url: string; method: string }[] = [];
    const fetchImpl: FetchLike = (input, init) => {
      calls.push({ url: String(input), method: init?.method ?? 'GET' });
      expect(init?.redirect).toBe('manual');
      return Promise.resolve(
        Response.json(
          tags([
            model('nomic-embed-text:latest'),
            model('mxbai-embed-large'),
            model('llama3.1:70b', { parameter_size: '70B' }),
            model('qwen2.5:7b', { parameter_size: '7B' }),
            model('llama3.2:latest', { family: 'llama', parameter_size: '3.2B' }),
          ]),
        ),
      );
    };

    const detected = await detectLocalOllama({ fetch: fetchImpl });
    expect(calls).toEqual([{ url: `${DEFAULT_OLLAMA_BASE_URL}/api/tags`, method: 'GET' }]);
    expect(detected).toMatchObject({
      ok: true,
      baseUrl: DEFAULT_OLLAMA_BASE_URL,
      chatModel: 'llama3.2',
      embedModel: 'nomic-embed-text',
    });
  });

  it('prefers a smaller model in the same family, then earlier families', () => {
    expect(
      pickChatModel([
        model('qwen2.5:1.5b', { parameter_size: '1.5B' }),
        model('llama3.1:70b', { parameter_size: '70B' }),
        model('llama3.1:8b', { parameter_size: '8B' }),
      ]),
    ).toBe('llama3.1:8b');
    expect(
      pickChatModel([
        model('llama3.2:latest', { parameter_size: '3.2B' }),
        model('llama3.2:1b', { parameter_size: '1B' }),
      ]),
    ).toBe('llama3.2:1b');
  });

  it('does not recommend embedding models as the chat model', () => {
    const embeddings = [
      model('nomic-embed-text'),
      model('mxbai-embed-large'),
      model('all-minilm'),
      model('bge-m3'),
      model('qwen3-embedding:0.6b'),
      model('custom-bert', { family: 'bert', parameter_size: '0.1B' }),
    ];
    expect(pickChatModel(embeddings)).toBeNull();
    expect(pickEmbedModel(embeddings)).toBe('nomic-embed-text');
    expect(pickChatModel([...embeddings, model('qwen2.5:3b')])).toBe('qwen2.5:3b');
    expect(pickEmbedModel([model('mxbai-embed-large'), model('bge-m3')])).toBeNull();
  });

  it('recommends an installed chat model that is not in the preference list', () => {
    expect(pickChatModel([model('my-notes:7b', { parameter_size: '7B' })])).toBe('my-notes:7b');
  });

  it('fails closed when Ollama is down, redirects, or is not on this machine', async () => {
    const down = await detectLocalOllama({
      fetch: () => Promise.reject(new Error('connect ECONNREFUSED')),
    });
    expect(down).toMatchObject({ ok: false, reason: 'unreachable' });

    const redirected = await detectLocalOllama({
      fetch: () => Promise.resolve(new Response(null, { status: 302 })),
    });
    expect(redirected).toMatchObject({ ok: false, reason: 'unreachable' });

    let calls = 0;
    const remote = await detectLocalOllama({
      baseUrl: 'https://example.com',
      fetch: () => {
        calls += 1;
        return Promise.resolve(Response.json({ models: [] }));
      },
    });
    expect(calls).toBe(0);
    expect(remote.ok).toBe(false);
  });

  it('times out instead of waiting on a hung socket', async () => {
    const fetchImpl: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    const detected = await detectLocalOllama({ fetch: fetchImpl, timeoutMs: 20 });
    expect(detected).toMatchObject({ ok: false, reason: 'unreachable' });
  });

  it('rejects a body that is not a model list', async () => {
    const invalid = await detectLocalOllama({
      fetch: () => Promise.resolve(Response.json({ version: '0.5.0' })),
    });
    expect(invalid).toMatchObject({ ok: false, reason: 'invalid-response' });

    const empty = await detectLocalOllama({
      fetch: () => Promise.resolve(Response.json({ models: [] })),
    });
    expect(empty).toMatchObject({ ok: true, chatModel: null, embedModel: null });
  });
});
