/** Stable workspace id. Desktop and web placeholders import this. */
export const packageId = '@ai-notes/ai' as const;

export { HttpError, isFallbackError, ProviderFallbackError } from './errors.js';
export { OllamaProvider } from './ollama.js';
export type { OllamaOptions } from './ollama.js';
export { OpenAICompatibleProvider } from './openai.js';
export type { OpenAICompatibleOptions } from './openai.js';
export {
  CARD_DIRECTORY,
  CARD_SYSTEM_PROMPT,
  addDays,
  applyReview,
  cardFilePath,
  createCard,
  dueCards,
  extractHandwritten,
  intervalLabel,
  isCardPath,
  isDue,
  maskCloze,
  newCardId,
  parseCard,
  parseGeneratedCards,
  planHandwrittenSync,
  remapCardSource,
  revealCloze,
  serializeCard,
  sourceSpanForDraft,
  todayIso,
} from './cards.js';
export type {
  CardDraft,
  CardKind,
  CardOrigin,
  HandwrittenDraft,
  HandwrittenSyncPlan,
  MemoryCard,
  ReviewGrade,
} from './cards.js';
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
