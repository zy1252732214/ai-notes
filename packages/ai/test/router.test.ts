import { describe, expect, it, vi } from "vitest";

import {
  HttpError,
  MemoryUsageStore,
  ModelRouter,
  OllamaProvider,
  OpenAICompatibleProvider,
  ProviderFallbackError,
  type ChatRequest,
  type ChatResult,
  type ChatStreamEvent,
  type EmbedRequest,
  type EmbedResult,
  type ModelProvider,
} from "../src/index.js";
import { collect, jsonResponse, mockFetch, streamResponse } from "./helpers.js";

function result(provider: string, model: string, content: string): ChatResult {
  return {
    content,
    model,
    finishReason: "stop",
    usage: {
      provider,
      model,
      tokensIn: 3,
      tokensOut: content.length,
      totalTokens: 3 + content.length,
      estimated: false,
    },
  };
}

class FakeProvider implements ModelProvider {
  calls = 0;
  constructor(
    readonly id: string,
    private readonly mode: "ok" | "http" | "partial" | "network",
    readonly defaultModel?: string,
    private readonly status = 503,
  ) {}

  async chat(request: ChatRequest): Promise<ChatResult> {
    this.calls += 1;
    this.failBefore();
    return result(this.id, request.model ?? this.id, `${this.id}-chat`);
  }

  async *stream(request: ChatRequest): AsyncGenerator<ChatStreamEvent> {
    this.calls += 1;
    if (this.mode === "partial") {
      yield { delta: "partial", model: request.model ?? this.id, done: false };
      throw new HttpError(503, "http://partial", "midway");
    }
    this.failBefore();
    yield { delta: `${this.id}:`, model: request.model ?? this.id, done: false };
    yield {
      delta: "",
      model: request.model ?? this.id,
      done: true,
      usage: result(this.id, request.model ?? this.id, "x").usage,
    };
  }

  async embed(request: EmbedRequest): Promise<EmbedResult> {
    this.calls += 1;
    this.failBefore();
    const model = request.model ?? this.id;
    return {
      embeddings: [[1, this.calls]],
      model,
      usage: {
        provider: this.id,
        model,
        tokensIn: 2,
        tokensOut: 0,
        totalTokens: 2,
        estimated: false,
      },
    };
  }

  private failBefore(): void {
    if (this.mode === "http") throw new HttpError(this.status, `http://${this.id}`, "nope");
    if (this.mode === "network") throw new TypeError("fetch failed");
  }
}

describe("ModelRouter", () => {
  it("falls back when the first provider is unavailable and records one usage", async () => {
    const primary = new FakeProvider("cloud", "http", undefined, 503);
    const local = new FakeProvider("local", "ok", "llama3.2");
    const store = new MemoryUsageStore();
    const onUsage = vi.fn();
    const router = new ModelRouter({ providers: [primary, local], onUsage, usageStore: store });

    const chat = await router.chat(
      { messages: [{ role: "user", content: "hi" }], feature: "rewrite" },
      { models: { local: "llama3.2", cloud: "gpt-4o-mini" } },
    );
    expect(chat.content).toBe("local-chat");
    expect(chat.model).toBe("llama3.2");
    expect(primary.calls).toBe(1);
    expect(local.calls).toBe(1);
    expect(onUsage).toHaveBeenCalledOnce();
    expect(store.records[0]).toMatchObject({
      provider: "local",
      model: "llama3.2",
      feature: "rewrite",
      tokensIn: 3,
      tokensOut: "local-chat".length,
      estimated: false,
    });
    expect(store.records[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const embedded = await router.embed({ input: "block" }, { provider: "local", models: { local: "nomic" } });
    expect(embedded.embeddings).toEqual([[1, 2]]);
    expect(primary.calls).toBe(1);
  });

  it("does not fall back on authentication errors or after a stream has started", async () => {
    const denied = new FakeProvider("cloud", "http", undefined, 401);
    const local = new FakeProvider("local", "ok");
    const router = new ModelRouter({ providers: [denied, local] });
    await expect(router.chat({ model: "gpt", messages: [{ role: "user", content: "hi" }] })).rejects.toBeInstanceOf(
      HttpError,
    );
    expect(local.calls).toBe(0);

    const partial = new FakeProvider("partial", "partial");
    const backup = new FakeProvider("backup", "ok");
    const streaming = new ModelRouter({ providers: [partial, backup] });
    await expect(
      collect(streaming.stream({ model: "m", messages: [{ role: "user", content: "hi" }] })),
    ).rejects.toBeInstanceOf(HttpError);
    expect(backup.calls).toBe(0);
  });

  it("streams from the next provider when the first one fails before any token", async () => {
    const down = new FakeProvider("down", "network");
    const local = new FakeProvider("local", "ok");
    const router = new ModelRouter({ providers: [down, local], order: ["down", "local"] });
    const events = await collect(router.stream({ model: "m", messages: [{ role: "user", content: "hi" }] }));
    expect(events.map((event) => event.delta).join("")).toBe("local:");
    expect(events.at(-1)?.done).toBe(true);
    expect(events.at(-1)?.usage?.provider).toBe("local");
  });

  it("wraps a total outage in ProviderFallbackError and ignores an aborted call", async () => {
    const router = new ModelRouter({
      providers: [new FakeProvider("a", "http", undefined, 503), new FakeProvider("b", "http", undefined, 429)],
    });
    await expect(router.chat({ model: "m", messages: [{ role: "user", content: "hi" }] })).rejects.toBeInstanceOf(
      ProviderFallbackError,
    );

    const called = new FakeProvider("local", "ok");
    const aborted = new AbortController();
    aborted.abort();
    const live = new ModelRouter({ providers: [new FakeProvider("cloud", "http", undefined, 503), called] });
    await expect(
      live.chat({ model: "m", messages: [{ role: "user", content: "hi" }] }, undefined, aborted.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    await expect(
      collect(live.stream({ model: "m", messages: [{ role: "user", content: "hi" }] }, undefined, aborted.signal)),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(called.calls).toBe(0);
  });

  it("completes one streamed conversation through each concrete provider, then falls back", async () => {
    const openai = new OpenAICompatibleProvider({
      id: "compat",
      baseUrl: "https://vendor.example/v1",
      apiKey: "sk-test",
      fetch: mockFetch(async () => jsonResponse({ error: { message: "overloaded" } }, 503)),
    });
    const ollama = new OllamaProvider({
      fetch: mockFetch(async () =>
        streamResponse(
          [
            '{"message":{"role":"assistant","content":"引用"},"done":false}\n',
            '{"message":{"role":"assistant","content":"已附上"},"done":true,"prompt_eval_count":4,"eval_count":2}\n',
          ],
          "application/x-ndjson",
        ),
      ),
    });
    const store = new MemoryUsageStore();
    const router = new ModelRouter({ providers: [openai, ollama], usageStore: store });
    const events = await collect(
      router.stream(
        { messages: [{ role: "user", content: "根据笔记回答" }], feature: "chat" },
        { models: { compat: "vendor-chat", ollama: "llama3.2" } },
      ),
    );
    expect(events.filter((event) => !event.done).map((event) => event.delta).join("")).toBe("引用已附上");
    expect(store.totals()).toEqual({ tokensIn: 4, tokensOut: 2 });
    expect(store.records[0]).toMatchObject({ provider: "ollama", model: "llama3.2", feature: "chat" });
  });

  it("rejects an empty provider list and duplicate ids", () => {
    expect(() => new ModelRouter({ providers: [] })).toThrow(/At least one/);
    expect(
      () => new ModelRouter({ providers: [new FakeProvider("same", "ok"), new FakeProvider("same", "ok")] }),
    ).toThrow(/Duplicate provider/);
  });
});
