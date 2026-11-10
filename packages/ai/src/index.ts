/** Stable workspace id. Desktop and web placeholders import this. */
export const packageId = '@ai-notes/ai' as const;

export { HttpError, isFallbackError, ProviderFallbackError } from './errors.js';
export { OllamaProvider } from './ollama.js';
export type { OllamaOptions } from './ollama.js';
export { OpenAICompatibleProvider } from './openai.js';
export type { OpenAICompatibleOptions } from './openai.js';
export { citationsForAnswer, ragMessages, withActiveNote } from './rag.js';
export type { RagCitation, RagSource } from './rag.js';
export { ModelRouter } from './router.js';
export type {
  ChatMessage,
  ChatRequest,
  ChatResult,
  ChatRole,
  ChatStreamEvent,
  EmbedRequest,
  EmbedResult,
  FetchLike,
  ModelProvider,
  ModelRouterOptions,
  RouteOptions,
  TokenUsage,
  UsageRecord,
  UsageStore,
} from './types.js';
export { MemoryUsageStore } from './usage.js';
