import {
  HttpError,
  ModelRouter,
  OllamaProvider,
  OpenAICompatibleProvider,
  ProviderFallbackError,
  type ChatMessage,
  type ChatStreamEvent,
  type FetchLike,
} from '@ai-notes/ai';
import type { SearchHit } from '@ai-notes/indexer';
import type { NoteName } from '../search/fuzzy.js';
import { resolveNoteLink } from '../search/links.js';
import { stripSnippet } from '../search/snippet.js';
import { activeProvider, normalizeAiSettings, type AiSettings } from './settings.js';

export interface CitationSource {
  path: string;
  title: string;
  excerpt: string;
  start: number;
  end?: number;
}

const NOTE_LIMIT = 4000;
const EXCERPT_LIMIT = 480;
const WIKILINK = /\[\[([^\]\n]+?)\]\]/g;

export function sourceFromNote(path: string, content: string): CitationSource {
  const title = headingTitle(content) || fileTitle(path);
  return {
    path,
    title,
    excerpt: clip(content, NOTE_LIMIT),
    start: 0,
  };
}

export function sourceFromHit(hit: SearchHit): CitationSource {
  return {
    path: hit.path,
    title: hit.title || fileTitle(hit.path),
    excerpt: clip(hit.text || stripSnippet(hit.snippet), EXCERPT_LIMIT),
    start: hit.start,
    end: hit.end,
  };
}

export function buildAskMessages(
  question: string,
  active: CitationSource | null,
  sources: readonly CitationSource[],
): ChatMessage[] {
  const current = active
    ? `当前打开的笔记：${active.title}\n路径：${active.path}\n${active.excerpt}`
    : '当前没有打开笔记。';
  const blocks =
    sources.length === 0
      ? '（没有检索到其他笔记）'
      : sources
          .map(
            (source, index) =>
              `[${index + 1}] ${source.title}\n路径：${source.path}\n${source.excerpt}`,
          )
          .join('\n\n');
  return [
    {
      role: 'system',
      content: [
        '你是本地笔记库的助手。只根据用户给出的笔记回答。',
        '引用时写成 [[路径]]，路径必须与笔记列表里的路径完全一致。',
        '笔记里没有依据时直接说明，不要编造。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `${current}\n\n可引用的笔记：\n${blocks}\n\n问题：${question}`,
    },
  ];
}

export function citationsFromAnswer(
  answer: string,
  sources: readonly CitationSource[],
  files: readonly NoteName[],
  fallback: boolean,
): CitationSource[] {
  const byPath = new Map(sources.map((source) => [source.path, source]));
  const found: CitationSource[] = [];
  const seen = new Set<string>();
  for (const match of answer.matchAll(WIKILINK)) {
    const path = resolveNoteLink(match[1] ?? '', files);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    found.push(byPath.get(path) ?? placeholder(path));
  }
  if (found.length > 0 || !fallback) return found;
  for (const source of sources) {
    if (seen.has(source.path)) continue;
    seen.add(source.path);
    found.push(source);
  }
  return found;
}

export function answerParts(answer: string): Array<{ kind: 'text' | 'link'; text: string }> {
  const parts: Array<{ kind: 'text' | 'link'; text: string }> = [];
  let cursor = 0;
  for (const match of answer.matchAll(WIKILINK)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ kind: 'text', text: answer.slice(cursor, index) });
    parts.push({ kind: 'link', text: match[1] ?? '' });
    cursor = index + match[0].length;
  }
  if (cursor < answer.length) parts.push({ kind: 'text', text: answer.slice(cursor) });
  return parts;
}

export function createModelRouter(settings: AiSettings, fetchImpl?: FetchLike): ModelRouter {
  const ready = normalizeAiSettings(settings);
  const active = activeProvider(ready);
  if (ready.provider === 'ollama') {
    return new ModelRouter({
      providers: [
        new OllamaProvider({
          baseUrl: active.baseUrl,
          defaultModel: active.model,
          apiKey: active.apiKey || undefined,
          fetch: fetchImpl,
        }),
      ],
    });
  }
  return new ModelRouter({
    providers: [
      new OpenAICompatibleProvider({
        baseUrl: active.baseUrl,
        apiKey: active.apiKey,
        defaultModel: active.model,
        fetch: fetchImpl,
      }),
    ],
  });
}

export async function* streamAnswer(
  settings: AiSettings,
  messages: readonly ChatMessage[],
  fetchImpl?: FetchLike,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const router = createModelRouter(settings, fetchImpl);
  yield* router.stream({ messages: [...messages], feature: 'chat' }, undefined, signal);
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function explainAiError(error: unknown): string {
  if (isAbortError(error)) return '已停止生成';
  if (error instanceof HttpError) {
    if (error.status === 401 || error.status === 403) return 'API Key 被拒绝，请检查设置';
    if (error.status === 404) return '找不到这个模型或接口';
    return `模型服务返回 ${error.status}`;
  }
  if (error instanceof ProviderFallbackError) {
    return explainAiError(error.errors.at(-1));
  }
  if (error instanceof TypeError) return '无法连接模型服务';
  if (error instanceof Error && error.message) return error.message;
  return '回答失败';
}

function placeholder(path: string): CitationSource {
  return { path, title: fileTitle(path), excerpt: '', start: 0 };
}

function fileTitle(path: string): string {
  return path.split('/').pop()?.replace(/\.md$/i, '') || path;
}

function headingTitle(content: string): string {
  const match = /^#\s+(.+)$/m.exec(content);
  return match?.[1]?.trim() ?? '';
}

function clip(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}…`;
}
