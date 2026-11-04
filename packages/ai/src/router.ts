import { isAbortError, isFallbackError, ProviderFallbackError } from './errors.js';
import type {
  ChatRequest,
  ChatResult,
  ChatStreamEvent,
  EmbedRequest,
  EmbedResult,
  ModelProvider,
  ModelRouterOptions,
  RouteOptions,
  TokenUsage,
} from './types.js';
import { toUsageRecord } from './usage.js';

/**
 * Tries providers in order. A later provider runs when the earlier one fails
 * before producing tokens (network error, 404, 408, 429, or 5xx).
 * A stream that already yielded text is not restarted on another provider.
 */
export class ModelRouter {
  private readonly providers: readonly ModelProvider[];
  private readonly order: readonly string[];

  constructor(private readonly options: ModelRouterOptions) {
    if (options.providers.length === 0) {
      throw new Error('At least one model provider is required');
    }
    const seen = new Set<string>();
    for (const provider of options.providers) {
      if (seen.has(provider.id)) throw new Error(`Duplicate provider id: ${provider.id}`);
      seen.add(provider.id);
    }
    this.providers = options.providers;
    this.order = options.order ?? options.providers.map((provider) => provider.id);
    for (const id of this.order) {
      if (!seen.has(id)) throw new Error(`Unknown provider in order: ${id}`);
    }
  }

  chat(request: ChatRequest, route?: RouteOptions, signal?: AbortSignal): Promise<ChatResult> {
    return this.run(request, route, signal, 'chat', (provider, model) =>
      provider.chat({ ...request, model }, signal),
    );
  }

  embed(request: EmbedRequest, route?: RouteOptions, signal?: AbortSignal): Promise<EmbedResult> {
    return this.run(request, route, signal, 'embed', (provider, model) =>
      provider.embed({ ...request, model }, signal),
    );
  }

  async *stream(
    request: ChatRequest,
    route?: RouteOptions,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    if (signal?.aborted) throw abortError();
    const errors: unknown[] = [];
    for (const provider of this.plan(route)) {
      const model = this.resolveModel(provider, request.model, route);
      if (!model) {
        errors.push(new Error(`No model configured for provider ${provider.id}`));
        continue;
      }
      let started = false;
      try {
        for await (const event of provider.stream({ ...request, model }, signal)) {
          started = true;
          if (event.usage) this.report(event.usage, request.feature, 'chat');
          yield event;
        }
        return;
      } catch (error) {
        if (started || isAbortError(error) || !isFallbackError(error)) throw error;
        errors.push(error);
      }
    }
    throw new ProviderFallbackError(errors);
  }

  private async run<T extends { usage: TokenUsage }>(
    request: { model?: string; feature?: string },
    route: RouteOptions | undefined,
    signal: AbortSignal | undefined,
    feature: string,
    call: (provider: ModelProvider, model: string) => Promise<T>,
  ): Promise<T> {
    const errors: unknown[] = [];
    for (const provider of this.plan(route)) {
      if (signal?.aborted) throw abortError();
      const model = this.resolveModel(provider, request.model, route);
      if (!model) {
        errors.push(new Error(`No model configured for provider ${provider.id}`));
        continue;
      }
      try {
        const result = await call(provider, model);
        this.report(result.usage, request.feature, feature);
        return result;
      } catch (error) {
        if (isAbortError(error) || !isFallbackError(error)) throw error;
        errors.push(error);
      }
    }
    throw new ProviderFallbackError(errors);
  }

  private plan(route?: RouteOptions): ModelProvider[] {
    const byId = new Map(this.providers.map((provider) => [provider.id, provider]));
    const ordered = this.order.map((id) => {
      const provider = byId.get(id);
      if (!provider) throw new Error(`Unknown provider in order: ${id}`);
      return provider;
    });
    if (!route?.provider) return ordered;
    const preferred = byId.get(route.provider);
    if (!preferred) throw new Error(`Unknown provider: ${route.provider}`);
    return [preferred, ...ordered.filter((provider) => provider.id !== preferred.id)];
  }

  private resolveModel(
    provider: ModelProvider,
    requestModel: string | undefined,
    route: RouteOptions | undefined,
  ): string | undefined {
    return route?.models?.[provider.id] ?? requestModel ?? provider.defaultModel;
  }

  private report(usage: TokenUsage, feature: string | undefined, fallback: string): void {
    const record = toUsageRecord(usage, feature?.trim() || fallback);
    this.options.onUsage?.(record);
    this.options.usageStore?.record(record);
  }
}

function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}
