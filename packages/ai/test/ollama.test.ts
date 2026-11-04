import { describe, expect, it } from "vitest";

import { OllamaProvider } from "../src/index.js";
import { bodyOf, collect, jsonResponse, mockFetch, streamResponse } from "./helpers.js";

const messages = [
  { role: "system" as const, content: "你是笔记助手" },
  { role: "user" as const, content: "总结一下" },
];

describe("OllamaProvider", () => {
  it("reads a non-streaming chat response and eval counts", async () => {
    const provider = new OllamaProvider({
      fetch: mockFetch(async (url, init) => {
        expect(url).toBe("http://127.0.0.1:11434/api/chat");
        expect(init.headers).not.toHaveProperty("authorization");
        expect(bodyOf(init)).toMatchObject({
          model: "llama3.2",
          stream: false,
          messages,
          options: { temperature: 0.1, num_predict: 64 },
        });
        return jsonResponse({
          model: "llama3.2",
          message: { role: "assistant", content: "这是总结。" },
          done: true,
          prompt_eval_count: 9,
          eval_count: 4,
        });
      }),
    });
    const result = await provider.chat({
      model: "llama3.2",
      messages,
      temperature: 0.1,
      maxTokens: 64,
    });
    expect(result.content).toBe("这是总结。");
    expect(result.usage).toMatchObject({
      provider: "ollama",
      tokensIn: 9,
      tokensOut: 4,
      estimated: false,
    });
  });

  it("streams NDJSON chat deltas", async () => {
    const provider = new OllamaProvider({
      baseUrl: "http://localhost:11434",
      fetch: mockFetch(async (url, init) => {
        expect(url).toBe("http://localhost:11434/api/chat");
        expect(bodyOf(init)).toMatchObject({ stream: true, model: "qwen2.5" });
        return streamResponse(
          [
            '{"model":"qwen2.5","message":{"role":"assistant","content":"你"},"done":false}\n',
            '{"model":"qwen2.5","message":{"role":"assistant","content":"好"},"done":false}\n{"model":"qwen2.5","message":{"role":"assistant","content":""},"done":true,"prompt_eval_count":6,"eval_count":2}\n',
          ],
          "application/x-ndjson",
        );
      }),
    });
    const events = await collect(provider.stream({ model: "qwen2.5", messages }));
    expect(events.filter((event) => !event.done).map((event) => event.delta).join("")).toBe("你好");
    expect(events.at(-1)?.done).toBe(true);
    expect(events.at(-1)?.usage).toMatchObject({ tokensIn: 6, tokensOut: 2, estimated: false });
  });

  it("embeds with /api/embed and accepts the legacy single vector", async () => {
    const provider = new OllamaProvider({
      apiKey: "local-token",
      fetch: mockFetch(async (url, init) => {
        expect(init.headers).toMatchObject({ authorization: "Bearer local-token" });
        if (url.endsWith("/api/embed") && Array.isArray((bodyOf(init) as { input: unknown }).input)) {
          return jsonResponse({ model: "nomic-embed-text", embeddings: [[0.1, 0.2], [0.3, 0.4]], prompt_eval_count: 5 });
        }
        return jsonResponse({ model: "nomic-embed-text", embedding: [0.5, 0.6] });
      }),
    });
    const batch = await provider.embed({ model: "nomic-embed-text", input: ["a", "b"] });
    expect(batch.embeddings).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(batch.usage.tokensIn).toBe(5);
    const single = await provider.embed({ model: "nomic-embed-text", input: "only" });
    expect(single.embeddings).toEqual([[0.5, 0.6]]);
  });
});
