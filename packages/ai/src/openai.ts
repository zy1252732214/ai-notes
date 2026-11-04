import { assertHttpBaseUrl, isRecord, iterateSseData, joinUrl, parseJson, postJson } from "./http.js";
import type {
  ChatRequest,
  ChatResult,
  ChatStreamEvent,
  EmbedRequest,
  EmbedResult,
  FetchLike,
  ModelProvider,
  TokenUsage,
} from "./types.js";
import { estimatePromptTokens, estimateTokens, usageFromCounts } from "./usage.js";
import { assertChatRequest, assertEmbedRequest } from "./validate.js";

export interface OpenAICompatibleOptions {
  /** Defaults to `openai`. */
  id?: string;
  /** API root, for example `https://api.openai.com/v1` or `https://api.deepseek.com/v1`. */
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  headers?: Record<string, string>;
  fetch?: FetchLike;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/**
 * Chat completions and embeddings over the OpenAI HTTP protocol.
 * Any vendor that speaks `/chat/completions` and `/embeddings` can use this provider.
 */
export class OpenAICompatibleProvider implements ModelProvider {
  readonly id: string;
  readonly defaultModel?: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly extraHeaders: Record<string, string>;
  private readonly fetchImpl: FetchLike;

  constructor(options: OpenAICompatibleOptions = {}) {
    this.id = options.id ?? "openai";
    this.defaultModel = options.defaultModel;
    this.baseUrl = assertHttpBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.apiKey = options.apiKey;
    this.extraHeaders = options.headers ?? {};
    this.fetchImpl = options.fetch ?? fetch;
  }

  async chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResult> {
    const model = requiredModel(request.model, this.defaultModel);
    assertChatRequest(request, model);
    const url = joinUrl(this.baseUrl, "chat/completions");
    const response = await postJson(this.fetchImpl, url, this.headers(), chatBody(request, model, false), signal);
    const json = parseJson(await response.text(), url);
    return readChatResult(json, this.id, model, request);
  }

  async *stream(request: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
    const model = requiredModel(request.model, this.defaultModel);
    assertChatRequest(request, model);
    const url = joinUrl(this.baseUrl, "chat/completions");
    const response = await postJson(this.fetchImpl, url, this.headers(), chatBody(request, model, true), signal);
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = parseJson(await response.text(), url);
      yield* eventsFromCompleteChat(json, this.id, model, request);
      return;
    }

    let resolvedModel = model;
    let accumulated = "";
    let finishReason: string | null = null;
    let usage: TokenUsage | undefined;
    for await (const data of iterateSseData(response.body)) {
      if (data === "[DONE]") break;
      const json = parseJson(data, url);
      if (!isRecord(json)) continue;
      if (typeof json.model === "string" && json.model) resolvedModel = json.model;
      const choice = firstChoice(json);
      const delta = choice ? messageText(choice.delta) : "";
      if (delta) {
        accumulated += delta;
        yield { delta, model: resolvedModel, done: false };
      }
      if (choice && typeof choice.finish_reason === "string") finishReason = choice.finish_reason;
      const parsedUsage = readUsage(json.usage, this.id, resolvedModel, request, accumulated);
      if (parsedUsage) usage = parsedUsage;
    }
    yield {
      delta: "",
      model: resolvedModel,
      done: true,
      finishReason,
      usage:
        usage ??
        usageFromCounts(
          this.id,
          resolvedModel,
          undefined,
          undefined,
          estimatePromptTokens(request.messages),
          estimateTokens(accumulated),
        ),
    };
  }

  async embed(request: EmbedRequest, signal?: AbortSignal): Promise<EmbedResult> {
    const model = requiredModel(request.model, this.defaultModel);
    const input = assertEmbedRequest(request, model);
    const url = joinUrl(this.baseUrl, "embeddings");
    const response = await postJson(
      this.fetchImpl,
      url,
      this.headers(),
      { model, input: input.length === 1 ? input[0] : input },
      signal,
    );
    const json = parseJson(await response.text(), url);
    if (!isRecord(json) || !Array.isArray(json.data)) {
      throw new Error(`Embedding response from ${url} is missing data`);
    }
    const ordered: Array<number[] | undefined> = Array.from({ length: input.length }, () => undefined);
    for (const item of json.data) {
      if (!isRecord(item) || !Array.isArray(item.embedding)) continue;
      const index = typeof item.index === "number" ? item.index : ordered.findIndex((slot) => slot === undefined);
      if (index < 0 || index >= ordered.length) continue;
      ordered[index] = item.embedding.map((value) => Number(value));
    }
    if (ordered.some((vector) => vector === undefined)) {
      throw new Error(`Embedding response from ${url} did not include every input`);
    }
    const usage =
      readUsage(json.usage, this.id, typeof json.model === "string" ? json.model : model, request, "") ??
      usageFromCounts(this.id, model, undefined, 0, estimateTokens(input.join("\n")), 0);
    return {
      embeddings: ordered as number[][],
      model: typeof json.model === "string" ? json.model : model,
      usage: { ...usage, tokensOut: usage.tokensOut },
    };
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
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
  return {
    model,
    messages: request.messages,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
  };
}

function readChatResult(json: unknown, provider: string, model: string, request: ChatRequest): ChatResult {
  if (!isRecord(json)) throw new Error("Chat response was not an object");
  const choice = firstChoice(json);
  const content = choice ? messageText(choice.message) : "";
  const resolvedModel = typeof json.model === "string" && json.model ? json.model : model;
  const finishReason = choice && typeof choice.finish_reason === "string" ? choice.finish_reason : null;
  const usage =
    readUsage(json.usage, provider, resolvedModel, request, content) ??
    usageFromCounts(provider, resolvedModel, undefined, undefined, estimatePromptTokens(request.messages), estimateTokens(content));
  return { content, model: resolvedModel, finishReason, usage };
}

function* eventsFromCompleteChat(
  json: unknown,
  provider: string,
  model: string,
  request: ChatRequest,
): Generator<ChatStreamEvent> {
  const result = readChatResult(json, provider, model, request);
  if (result.content) yield { delta: result.content, model: result.model, done: false };
  yield {
    delta: "",
    model: result.model,
    done: true,
    finishReason: result.finishReason,
    usage: result.usage,
  };
}

function firstChoice(json: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!Array.isArray(json.choices)) return undefined;
  const choice = json.choices[0];
  return isRecord(choice) ? choice : undefined;
}

function messageText(message: unknown): string {
  if (!isRecord(message)) return "";
  const { content } = message;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (isRecord(part) && typeof part.text === "string") return part.text;
      return "";
    })
    .join("");
}

function readUsage(
  raw: unknown,
  provider: string,
  model: string,
  request: { messages?: ChatRequest["messages"]; input?: EmbedRequest["input"] },
  output: string,
): TokenUsage | undefined {
  if (!isRecord(raw)) return undefined;
  const prompt = numberField(raw, "prompt_tokens");
  const completion = numberField(raw, "completion_tokens");
  if (prompt === undefined && completion === undefined) return undefined;
  const fallbackIn = request.messages
    ? estimatePromptTokens(request.messages)
    : estimateTokens(typeof request.input === "string" ? request.input : (request.input ?? []).join("\n"));
  return usageFromCounts(provider, model, prompt, completion ?? 0, fallbackIn, estimateTokens(output));
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
