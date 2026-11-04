import { describe, expect, it } from 'vitest';

import { OpenAICompatibleProvider } from './index.js';
import { bodyOf, collect, jsonResponse, mockFetch, streamResponse } from './test-helpers.js';

const messages = [{ role: 'user' as const, content: '用一句话打个招呼' }];

describe('OpenAICompatibleProvider', () => {
  it('posts a chat completion and reports token usage', async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const provider = new OpenAICompatibleProvider({
      id: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1/',
      apiKey: 'sk-test',
      headers: { 'x-title': 'ai-notes' },
      fetch: mockFetch(async (url, init) => {
        seen.push({ url, init });
        return jsonResponse({
          model: 'deepseek-chat',
          choices: [{ message: { role: 'assistant', content: '你好。' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 11, completion_tokens: 3, total_tokens: 14 },
        });
      }),
    });

    const result = await provider.chat({
      model: 'deepseek-chat',
      messages,
      temperature: 0.2,
      maxTokens: 32,
    });

    expect(result.content).toBe('你好。');
    expect(result.model).toBe('deepseek-chat');
    expect(result.finishReason).toBe('stop');
    expect(result.usage).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-chat',
      tokensIn: 11,
      tokensOut: 3,
      totalTokens: 14,
      estimated: false,
    });
    expect(seen[0]?.url).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(seen[0]?.init.headers).toMatchObject({
      authorization: 'Bearer sk-test',
      'x-title': 'ai-notes',
    });
    expect(bodyOf(seen[0]?.init ?? {})).toMatchObject({
      model: 'deepseek-chat',
      stream: false,
      temperature: 0.2,
      max_tokens: 32,
      messages,
    });
  });

  it('streams SSE deltas, including a line split across packets, and usage', async () => {
    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://example.test/v1',
      apiKey: 'sk-test',
      fetch: mockFetch(async () =>
        streamResponse([
          'data: {"choices":[{"delta":{"content":"你"}}]}\n\ndata: {"choi',
          'ces":[{"delta":{"content":"好"},"finish_reason":"stop"}],"model":"demo"}\n',
          'data: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n',
          'data: [DONE]\n',
        ]),
      ),
    });

    const events = await collect(provider.stream({ model: 'demo', messages }));
    expect(events.map((event) => event.delta).join('')).toBe('你好');
    expect(events.at(-1)).toMatchObject({
      done: true,
      finishReason: 'stop',
      usage: { provider: 'openai', tokensIn: 5, tokensOut: 2, estimated: false },
    });
  });

  it('estimates tokens when the provider omits usage', async () => {
    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://example.test/v1',
      fetch: mockFetch(async () =>
        jsonResponse({
          model: 'm',
          choices: [{ message: { content: 'Hi' }, finish_reason: 'stop' }],
        }),
      ),
    });
    const result = await provider.chat({
      model: 'm',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(result.content).toBe('Hi');
    expect(result.usage.estimated).toBe(true);
    expect(result.usage.tokensIn).toBeGreaterThan(0);
    expect(result.usage.tokensOut).toBeGreaterThan(0);
  });

  it('sorts embedding vectors by index', async () => {
    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://example.test/v1',
      fetch: mockFetch(async (_url, init) => {
        expect(bodyOf(init)).toMatchObject({ model: 'embed-small', input: ['甲', '乙'] });
        return jsonResponse({
          model: 'embed-small',
          data: [
            { index: 1, embedding: [2, 2] },
            { index: 0, embedding: [1, 1] },
          ],
          usage: { prompt_tokens: 4, total_tokens: 4 },
        });
      }),
    });
    const result = await provider.embed({ model: 'embed-small', input: ['甲', '乙'] });
    expect(result.embeddings).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(result.usage).toMatchObject({ tokensIn: 4, tokensOut: 0, estimated: false });
  });

  it('surfaces the provider error message on non-2xx responses', async () => {
    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://example.test/v1',
      fetch: mockFetch(async () => jsonResponse({ error: { message: 'invalid api key' } }, 401)),
    });
    await expect(provider.chat({ model: 'm', messages })).rejects.toThrow(/invalid api key/);
  });
});
