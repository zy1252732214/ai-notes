import type { ChatMessage } from './types.js';

/** One retrieved chunk, numbered from 1 when it is placed in the prompt. */
export interface RagSource {
  chunkId: number;
  path: string;
  title: string;
  headingPath: string;
  start: number;
  end: number;
  text: string;
}

export interface RagCitation {
  /** 1-based index used in the prompt, for example `[1]`. */
  index: number;
  notePath: string;
  title: string;
  chunkId: string;
  headingPath: readonly string[];
  startOffset: number;
  endOffset: number;
  quote: string;
}

/**
 * The open note is included when retrieval did not already return it,
 * so a question about the current page still has something to cite.
 */
export function withActiveNote(
  sources: readonly RagSource[],
  active: RagSource | null,
  limit = 6,
): RagSource[] {
  const cap = Number.isInteger(limit) && limit > 0 ? limit : 6;
  if (!active || sources.some((source) => source.path === active.path)) {
    return sources.slice(0, cap);
  }
  return [active, ...sources].slice(0, cap);
}

export function ragMessages(
  question: string,
  sources: readonly RagSource[],
  activePath?: string,
): ChatMessage[] {
  const context =
    sources.length > 0
      ? sources.map((source, index) => formatSource(index + 1, source)).join('\n\n')
      : '（没有检索到笔记片段）';
  const where = activePath ? `用户正在查看：${activePath}\n\n` : '';
  return [
    {
      role: 'system',
      content:
        '你是 ai-notes 的笔记助手。只根据给出的笔记片段回答，不要使用片段之外的知识。用到某个片段时，用它的编号标注，例如 [1]。编号必须来自给出的片段。如果片段里没有依据，就直接说笔记里没有找到依据，不要编造。',
    },
    {
      role: 'user',
      content: `${where}笔记片段：\n${context}\n\n问题：${question.trim()}`,
    },
  ];
}

/**
 * Citations explicitly marked in the answer. If the model marks none,
 * every source that was sent is returned so the answer still has a trail.
 */
export function citationsForAnswer(answer: string, sources: readonly RagSource[]): RagCitation[] {
  const marked: number[] = [];
  for (const match of answer.matchAll(/\[(\d+)\]/g)) {
    const index = Number(match[1]);
    if (!Number.isInteger(index) || index < 1 || index > sources.length || marked.includes(index)) {
      continue;
    }
    marked.push(index);
  }
  const indexes = marked.length > 0 ? marked : sources.map((_, index) => index + 1);
  return indexes.flatMap((index) => {
    const source = sources[index - 1];
    return source ? [toCitation(index, source)] : [];
  });
}

function formatSource(index: number, source: RagSource): string {
  const heading = source.headingPath ? ` · ${source.headingPath}` : '';
  const title = source.title || source.path;
  return `[${index}] ${title}（${source.path}${heading}）\n${source.text.trim()}`;
}

function toCitation(index: number, source: RagSource): RagCitation {
  return {
    index,
    notePath: source.path,
    title: source.title || source.path,
    chunkId: String(source.chunkId),
    headingPath: source.headingPath.split(' / ').filter((part) => part.length > 0),
    startOffset: source.start,
    endOffset: source.end,
    quote: excerpt(source.text),
  };
}

function excerpt(text: string): string {
  const collapsed = text.trim().replace(/\s+/g, ' ');
  return collapsed.length > 160 ? `${collapsed.slice(0, 160)}…` : collapsed;
}
