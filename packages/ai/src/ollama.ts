import { assertHttpBaseUrl, isRecord, iterateLines, joinUrl, parseJson, postJson } from "./http.js";
import type {
  ChatRequest,
  ChatResult,
  ChatStreamEvent,
  EmbedRequest,
  EmbedResult,
  FetchLike,
  ModelProvider,
} from "./types.js";
import { estimatePromptTokens, estimateTokens, usageFromCounts } from "./usage.js";
import { assertChatRequest, assertEmbedRequest } from "./validate.js";

export interface OllamaOptions {
  /** Defaults to `ollama`. */
  id?: string;
  /** Server root. Defaults to `http://127.0.0.1:11434`. */
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  headers?: Record<string, string>;
  fetch?: FetchLike;
}

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";

/** Local Ollama chat (`/api/chat`) and embeddings (`/api/embed`). */
export class OllamaProvider implements ModelProvider {
  readonly id: string;
  readonly defaultModel?: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly extraHeaders: Record<string, string>;
  private readonly fetchImpl: FetchLike;

  constructor(options: OllamaOptions = {}) {
    this.id = options.id ?? "ollama";
    this.defaultModel = options.defaultModel;
    this.baseUrl = assertHttpBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.apiKey = options.apiKey;
    this.extraHeaders = options.headers ?? {};
    this.fetchImpl = options.fetch ?? fetch;
  }

  async chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResult> {
    const model = requiredModel(request.model, this.defaultModel);
    assertChatRequest(request, model);
    const url = joinUrl(this.baseUrl, "api/chat");
    const response = await postJson(this.fetchImpl, url, this.headers(), chatBody(request, model, false), signal);
    const json = parseJson(await response.text(), url);
    if (!isRecord(json)) throw new Error(`Chat response from ${url} was not an object`);
    const content = messageContent(json.message);
    const resolved = typeof json.model === "string" && json.model ? json.model : model;
    return {
      content,
      model: resolved,
      finishReason: json.done === true ? "stop" : null,
      usage: ollamaUsage(json, this.id, resolved, request, content),
    };
  }

  async *stream(request: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
    const model = requiredModel(request.model, this.defaultModel);
    assertChatRequest(request, model);
    const url = joinUrl(this.baseUrl, "api/chat");
    const response = await postJson(this.fetchImpl, url, this.headers(), chatBody(request, model, true), signal);
    let resolvedModel = model;
    let accumulated = "";
    let last: Record<string, unknown> | undefined;
    for await (const line of iterateLines(response.body)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const json = parseJson(trimmed, url);
      if (!isRecord(json)) continue;
      last = json;
      if (typeof json.model === "string" && json.model) resolvedModel = json.model;
      const delta = messageContent(json.message);
      if (delta) {
        accumulated += delta;
        yield { delta, model: resolvedModel, done: false };
      }
      if (json.done === true) {
        yield {
          delta: "",
          model: resolvedModel,
          done: true,
          finishReason: "stop",
          usage: ollamaUsage(json, this.id, resolvedModel, request, accumulated),
        };
        return;
      }
    }
    yield {
      delta: "",
      model: resolvedModel,
      done: true,
      finishReason: null,
      usage: ollamaUsage(last ?? {}, this.id, resolvedModel, request, accumulated),
    };
  }

  async embed(request: EmbedRequest, signal?: AbortSignal): Promise<EmbedResult> {
    const model = requiredModel(request.model, this.defaultModel);
    const input = assertEmbedRequest(request, model);
    const url = joinUrl(this.baseUrl, "api/embed");
    const response = await postJson(
      this.fetchImpl,
      url,
      this.headers(),
      { model, input: input.length === 1 ? input[0] : input },
      signal,
    );
    const json = parseJson(await response.text(), url);
    if (!isRecord(json)) throw new Error(`Embedding response from ${url} was not an object`);
    const embeddings = readEmbeddings(json, input.length, url);
    const resolved = typeof json.model === "string" && json.model ? json.model : model;
    const promptTokens = numberField(json, "prompt_eval_count");
    return {
      embeddings,
      model: resolved,
      usage: usageFromCounts(
        this.id,
        resolved,
        promptTokens,
        0,
        estimateTokens(input.join("\n")),
        0,
      ),
    };
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      accept: "application/json, application/x-ndjson",
      ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      ...this.extraHeaders,
    };
  }
}

function requiredModel(requestModel: string | undefined, fallback: string | undefined): string {
  const model = requestModel ?? fallback;
  if (!model) throw new Error("model is required");
  return model;
}

function chatBody(request: ChatRequest, model: string, stream: boolean): Record<string, unknown> {
  const options: Record<string, number> = {};
  if (request.temperature !== undefined) options.temperature = request.temperature;
  if (request.maxTokens !== undefined) options.num_predict = request.maxTokens;
  return {
    model,
    messages: request.messages,
    stream,
    ...(Object.keys(options).length > 0 ? { options } : {}),
  };
}

function messageContent(message: unknown): string {
  if (!isRecord(message)) return "";
  return typeof message.content === "string" ? message.content : "";
}

function ollamaUsage(
  json: Record<string, unknown>,
  provider: string,
  model: string,
  request: ChatRequest,
  output: string,
) {
  return usageFromCounts(
    provider,
    model,
    numberField(json, "prompt_eval_count"),
    numberField(json, "eval_count"),
    estimatePromptTokens(request.messages),
    estimateTokens(output),
  );
}

function readEmbeddings(json: Record<string, unknown>, expected: number, url: string): number[][] {
  if (Array.isArray(json.embeddings)) {
    const vectors = json.embeddings.map(asVector);
    if (vectors.length !== expected || vectors.some((vector) => vector === null)) {
      throw new Error(`Embedding response from ${url} did not include every input`);
    }
    return vectors as number[][];
  }
  if (Array.isArray(json.embedding) && expected === 1) {
    const vector = asVector(json.embedding);
    if (!vector) throw new Error(`Embedding response from ${url} was empty`);
    return [vector];
  }
  throw new Error(`Embedding response from ${url} is missing embeddings`);
}

function asVector(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((item) => typeof item === "number" && Number.isFinite(item))) return null;
  return value;
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
