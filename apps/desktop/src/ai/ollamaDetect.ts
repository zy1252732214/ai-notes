import type { FetchLike } from '@ai-notes/ai';

/** 只探测这个地址，不访问别的主机，也不拉取模型。 */
export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

const DETECT_TIMEOUT_MS = 2000;

export interface OllamaListedModel {
  name: string;
  family?: string;
  parameterSize?: string;
}

export type OllamaDetection =
  | {
      ok: true;
      baseUrl: string;
      models: OllamaListedModel[];
      /** 已安装的聊天模型。没有聊天模型时为 null，不会拿嵌入模型来顶替。 */
      chatModel: string | null;
      /** 仅当安装了 `nomic-embed-text` 时有值，供界面建议，不自动开启混合检索。 */
      embedModel: string | null;
    }
  | {
      ok: false;
      baseUrl: string;
      reason: 'unreachable' | 'invalid-response';
    };

export interface DetectOllamaOptions {
  baseUrl?: string;
  fetch?: FetchLike;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const EMBEDDING_NAME = /embed|minilm|^bge[-_]/i;

/** 越靠前越优先。同一族里再选参数量更小的。 */
const CHAT_PREFERENCE: readonly RegExp[] = [
  /^llama3\.2(?:$|[-_.])/i,
  /^llama3\.1(?:$|[-_.])/i,
  /^qwen2\.5(?:$|[-_.])/i,
  /^qwen3(?:$|[-_.])/i,
  /^qwen2(?:$|[-_.])/i,
  /^qwen(?:$|[-_.])/i,
  /^gemma3(?:$|[-_.])/i,
  /^gemma2(?:$|[-_.])/i,
  /^phi3(?:$|[-_.])/i,
  /^phi4(?:$|[-_.])/i,
  /^mistral(?:$|[-_.])/i,
  /^llama3(?:$|[-_.])/i,
  /^gemma(?:$|[-_.])/i,
  /^phi(?:$|[-_.])/i,
  /^llama3\.3(?:$|[-_.])/i,
  /^llama2(?:$|[-_.])/i,
];

/**
 * 请求本机 Ollama 的 `GET /api/tags`。
 * 连不上、超时、或地址不是本机时返回失败，不抛错，也不跟随跳转到其他主机。
 */
export async function detectLocalOllama(
  options: DetectOllamaOptions = {},
): Promise<OllamaDetection> {
  const requested = options.baseUrl ?? DEFAULT_OLLAMA_BASE_URL;
  const local = localBaseUrl(requested);
  if (!local) {
    return { ok: false, baseUrl: DEFAULT_OLLAMA_BASE_URL, reason: 'unreachable' };
  }
  if (options.signal?.aborted) {
    return { ok: false, baseUrl: local, reason: 'unreachable' };
  }

  const fetchImpl = options.fetch ?? fetch;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DETECT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetchImpl(`${local}/api/tags`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
      redirect: 'manual',
      credentials: 'omit',
    });
    if (
      response.type === 'opaqueredirect' ||
      (response.status >= 300 && response.status < 400) ||
      !response.ok
    ) {
      return { ok: false, baseUrl: local, reason: 'unreachable' };
    }
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { ok: false, baseUrl: local, reason: 'invalid-response' };
    }
    const models = parseModels(json);
    if (!models) return { ok: false, baseUrl: local, reason: 'invalid-response' };
    return {
      ok: true,
      baseUrl: local,
      models,
      chatModel: pickChatModel(models),
      embedModel: pickEmbedModel(models),
    };
  } catch {
    return { ok: false, baseUrl: local, reason: 'unreachable' };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

export function pickChatModel(models: readonly OllamaListedModel[]): string | null {
  const chats = models.filter((model) => model.name.trim() && !isEmbeddingModel(model));
  if (chats.length === 0) return null;
  const ranked = chats.map((model, index) => ({
    model,
    index,
    rank: preferenceRank(baseName(model.name)),
    size: parameterBillions(model),
  }));
  ranked.sort((a, b) => a.rank - b.rank || a.size - b.size || a.index - b.index);
  const best = ranked[0];
  return best ? canonicalModelName(best.model.name) : null;
}

export function pickEmbedModel(models: readonly OllamaListedModel[]): string | null {
  const matches = models.filter((model) =>
    /^nomic-embed-text(?:$|[-_.:])/i.test(model.name.trim()),
  );
  const first = matches[0];
  if (!first) return null;
  const exact = matches.find((model) => model.name.trim().toLowerCase() === 'nomic-embed-text');
  return canonicalModelName((exact ?? first).name.trim());
}

export function isEmbeddingModel(model: OllamaListedModel): boolean {
  if (EMBEDDING_NAME.test(model.name)) return true;
  const family = model.family?.toLowerCase() ?? '';
  return family.includes('bert') || family.includes('embed');
}

function localBaseUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') return null;
  return value.replace(/\/$/, '');
}

function parseModels(json: unknown): OllamaListedModel[] | null {
  if (!json || typeof json !== 'object') return null;
  const models = (json as { models?: unknown }).models;
  if (!Array.isArray(models)) return null;
  const listed: OllamaListedModel[] = [];
  for (const item of models) {
    if (!item || typeof item !== 'object') continue;
    const record = item as {
      name?: unknown;
      model?: unknown;
      details?: { family?: unknown; parameter_size?: unknown };
    };
    const name =
      typeof record.name === 'string' && record.name.trim()
        ? record.name.trim()
        : typeof record.model === 'string'
          ? record.model.trim()
          : '';
    if (!name) continue;
    const family = typeof record.details?.family === 'string' ? record.details.family : undefined;
    const parameterSize =
      typeof record.details?.parameter_size === 'string'
        ? record.details.parameter_size
        : undefined;
    listed.push({
      name,
      ...(family ? { family } : {}),
      ...(parameterSize ? { parameterSize } : {}),
    });
  }
  return listed;
}

function baseName(name: string): string {
  return name.split(':')[0]?.trim() ?? name;
}

function preferenceRank(base: string): number {
  const found = CHAT_PREFERENCE.findIndex((pattern) => pattern.test(base));
  return found === -1 ? CHAT_PREFERENCE.length : found;
}

function parameterBillions(model: OllamaListedModel): number {
  const fromDetails = parseSize(model.parameterSize);
  if (fromDetails !== null) return fromDetails;
  const fromName = /(?:^|[:._-])(\d+(?:\.\d+)?)b(?:$|[:._-])/i.exec(model.name);
  if (fromName?.[1]) return Number(fromName[1]);
  return Number.POSITIVE_INFINITY;
}

function parseSize(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(\d+(?:\.\d+)?)\s*([bmk])\b/i.exec(value.trim());
  if (!match?.[1] || !match[2]) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'm') return amount / 1000;
  if (unit === 'k') return amount / 1_000_000;
  return amount;
}

function canonicalModelName(name: string): string {
  return name.replace(/:latest$/i, '');
}
