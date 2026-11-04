export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  /** Used when the route does not override the model for this provider. */
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Usage feature name. The router defaults this to `chat`. */
  feature?: string;
}

export interface EmbedRequest {
  model?: string;
  input: string | readonly string[];
  /** Usage feature name. The router defaults this to `embed`. */
  feature?: string;
}

export interface TokenUsage {
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  /** True when the provider omitted counts and the router estimated them. */
  estimated: boolean;
}

export interface ChatResult {
  content: string;
  model: string;
  finishReason: string | null;
  usage: TokenUsage;
}

export interface ChatStreamEvent {
  delta: string;
  model: string;
  done: boolean;
  usage?: TokenUsage;
  finishReason?: string | null;
}

export interface EmbedResult {
  embeddings: number[][];
  model: string;
  usage: TokenUsage;
}

/**
 * One model backend. `id` is stable and shows up in usage records.
 * Implementations must be safe to call concurrently.
 */
export interface ModelProvider {
  readonly id: string;
  readonly defaultModel?: string;
  chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResult>;
  stream(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamEvent>;
  embed(request: EmbedRequest, signal?: AbortSignal): Promise<EmbedResult>;
}

export interface RouteOptions {
  /** Try this provider first, then the remaining router order. */
  provider?: string;
  /** Per-provider model name. Falls back to `request.model`, then `provider.defaultModel`. */
  models?: Record<string, string>;
}

export interface UsageRecord {
  /** UTC day, `YYYY-MM-DD`. */
  date: string;
  provider: string;
  model: string;
  feature: string;
  tokensIn: number;
  tokensOut: number;
  estimated: boolean;
}

export interface UsageStore {
  record(usage: UsageRecord): void;
}

export interface ModelRouterOptions {
  providers: readonly ModelProvider[];
  /**
   * Provider ids to try, in order. Defaults to registration order.
   * A call's `route.provider` is moved to the front and is not required to be in this list.
   */
  order?: readonly string[];
  onUsage?: (record: UsageRecord) => void;
  usageStore?: UsageStore;
}

/** `fetch` compatible function so tests and hosts can inject a transport. */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
