import { remapVaultPath } from '@ai-notes/core';

/**
 * Memory cards live in the vault as Markdown so they can be read by git and
 * by the existing full-text / hybrid index. See docs/cards.md.
 */
export const CARD_DIRECTORY = '记忆';

export type CardKind = 'qa' | 'cloze';
export type CardOrigin = 'generated' | 'handwritten' | 'manual';
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export interface MemoryCard {
  id: string;
  /** Vault path of the card file. Usually `记忆/<id>.md`. */
  path: string;
  kind: CardKind;
  origin: CardOrigin;
  /** Question, or a cloze sentence that still contains `{{answers}}`. */
  prompt: string;
  answer: string;
  sourcePath: string | null;
  sourceStart: number | null;
  sourceEnd: number | null;
  /** SM-2 easiness factor. Starts at 2.5 and never drops below 1.3. */
  ease: number;
  /** Days until the next review. `0` means the card is still due today. */
  interval: number;
  /** Successful reviews since the last lapse. */
  repetitions: number;
  /** Calendar day `YYYY-MM-DD`. Due when this is today or earlier. */
  due: string;
  lapses: number;
}

export interface CardDraft {
  kind: CardKind;
  prompt: string;
  answer: string;
}

export interface HandwrittenDraft extends CardDraft {
  id: string;
  sourcePath: string;
  sourceStart: number;
  sourceEnd: number;
}

export interface HandwrittenSyncPlan {
  upserts: MemoryCard[];
  /** Card files whose handwritten source no longer contains that card. */
  removals: string[];
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,40}$/;
const QUALITY: Record<ReviewGrade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export function isCardPath(path: string): boolean {
  return path === CARD_DIRECTORY || path.startsWith(`${CARD_DIRECTORY}/`);
}

export function cardFilePath(id: string): string {
  return `${CARD_DIRECTORY}/${id}.md`;
}

export function todayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, days: number): string {
  const match = DATE_RE.exec(isoDate);
  if (!match || !Number.isInteger(days)) throw new Error('date must be YYYY-MM-DD');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isDue(card: MemoryCard, today: string): boolean {
  return card.due <= today;
}

export function dueCards(cards: readonly MemoryCard[], today: string): MemoryCard[] {
  return cards
    .filter((card) => isDue(card, today))
    .sort(
      (left, right) =>
        left.due.localeCompare(right.due) ||
        (left.sourceStart ?? 0) - (right.sourceStart ?? 0) ||
        left.id.localeCompare(right.id),
    );
}

export function newCardId(prefix: 'g' | 'm' | 'h' = 'g'): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return `${prefix}${raw.replace(/-/g, '').slice(0, 12)}`;
}

export function createCard(
  draft: CardDraft & {
    origin: CardOrigin;
    today: string;
    id?: string;
    sourcePath?: string | null;
    sourceStart?: number | null;
    sourceEnd?: number | null;
  },
): MemoryCard {
  const id = draft.id && SAFE_ID.test(draft.id) ? draft.id : newCardId(prefixFor(draft.origin));
  return {
    id,
    path: cardFilePath(id),
    kind: draft.kind,
    origin: draft.origin,
    prompt: draft.prompt.trim(),
    answer: draft.answer.trim(),
    sourcePath: draft.sourcePath ?? null,
    sourceStart: draft.sourceStart ?? null,
    sourceEnd: draft.sourceEnd ?? null,
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    due: draft.today,
    lapses: 0,
  };
}

/**
 * SM-2 easiness update, with four review buttons.
 *
 * Ease follows SuperMemo 2 and never goes below 1.3. Intervals are whole days
 * because the due date is a calendar day:
 *
 * - again (q=1): back in today's queue, repetitions reset, lapse counted
 * - hard (q=3): 1 day the first time, then `round(interval * 1.2)`
 * - good (q=4): 3 days the first time, then `round(interval * ease)`
 * - easy (q=5): 7 days the first time, then `round(interval * ease * 1.3)`
 *
 * The interval uses the ease from before this review.
 */
export function applyReview(card: MemoryCard, grade: ReviewGrade, today: string): MemoryCard {
  const quality = QUALITY[grade];
  const ease = nextEase(card.ease, quality);
  if (quality < 3) {
    return { ...card, ease, interval: 0, repetitions: 0, lapses: card.lapses + 1, due: today };
  }
  const interval = nextInterval(card, grade);
  return {
    ...card,
    ease,
    interval,
    repetitions: card.repetitions + 1,
    due: addDays(today, interval),
  };
}

export function intervalLabel(days: number): string {
  if (days <= 0) return '今天';
  if (days === 1) return '明天';
  return `${days} 天`;
}

export function maskCloze(prompt: string): string {
  return prompt.replace(/\{\{[^{}\n]+\}\}/g, '____');
}

export function revealCloze(prompt: string): string {
  return prompt.replace(/\{\{([^{}\n]+)\}\}/g, '$1');
}

export function serializeCard(card: MemoryCard): string {
  const lines = [
    '---',
    'type: card',
    `id: ${card.id}`,
    `title: ${yamlString(cardTitle(card.prompt))}`,
    `kind: ${card.kind}`,
    `origin: ${card.origin}`,
  ];
  if (card.sourcePath) lines.push(`source: ${yamlString(card.sourcePath)}`);
  if (card.sourceStart != null) lines.push(`sourceStart: ${Math.trunc(card.sourceStart)}`);
  if (card.sourceEnd != null) lines.push(`sourceEnd: ${Math.trunc(card.sourceEnd)}`);
  lines.push(
    `ease: ${formatEase(card.ease)}`,
    `interval: ${Math.trunc(card.interval)}`,
    `repetitions: ${Math.trunc(card.repetitions)}`,
    `due: ${card.due}`,
    `lapses: ${Math.trunc(card.lapses)}`,
    '---',
    '',
    '## 问题',
    '',
    card.prompt.trim(),
    '',
    '## 答案',
    '',
    card.answer.trim(),
    ...(card.sourcePath ? ['', `来源：[[${card.sourcePath}]]`] : []),
    '',
  );
  return lines.join('\n');
}

export function parseCard(content: string, path: string): MemoryCard | null {
  const frontmatter = readFrontmatter(content);
  if (!frontmatter || frontmatter.data.type !== 'card') return null;
  const id = frontmatter.data.id ?? '';
  if (!SAFE_ID.test(id)) return null;
  const body = splitCardBody(content.slice(frontmatter.end));
  if (!body) return null;
  const kind: CardKind =
    frontmatter.data.kind === 'cloze' || body.prompt.includes('{{') ? 'cloze' : 'qa';
  const origin = parseOrigin(frontmatter.data.origin);
  const sourceStart = parseOffset(frontmatter.data.sourceStart);
  const sourceEnd = parseOffset(frontmatter.data.sourceEnd);
  return {
    id,
    path,
    kind,
    origin,
    prompt: body.prompt,
    answer: body.answer,
    sourcePath: frontmatter.data.source?.trim() || null,
    sourceStart,
    sourceEnd:
      sourceEnd != null && sourceStart != null && sourceEnd >= sourceStart
        ? sourceEnd
        : sourceStart,
    ease: clampEase(numberOr(frontmatter.data.ease, 2.5)),
    interval: Math.max(0, Math.trunc(numberOr(frontmatter.data.interval, 0))),
    repetitions: Math.max(0, Math.trunc(numberOr(frontmatter.data.repetitions, 0))),
    due: DATE_RE.test(frontmatter.data.due ?? '') ? (frontmatter.data.due ?? '') : '1970-01-01',
    lapses: Math.max(0, Math.trunc(numberOr(frontmatter.data.lapses, 0))),
  };
}

export function extractHandwritten(content: string, sourcePath: string): HandwrittenDraft[] {
  if (isCardPath(sourcePath)) return [];
  const lines = splitLines(content);
  const drafts: HandwrittenDraft[] = [];
  let fence: { char: string; length: number } | null = null;
  let paragraph: LineSpan[] = [];

  const flushParagraph = () => {
    const draft = clozeFromParagraph(paragraph, sourcePath);
    if (draft) drafts.push(draft);
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    if (fence) {
      if (closesFence(line.text, fence.char, fence.length)) fence = null;
      continue;
    }
    const opened = openFence(line.text);
    if (opened) {
      flushParagraph();
      if (opened.info.toLowerCase() === 'card') {
        const closed = findClosingFence(lines, index + 1, opened.char, opened.length);
        const endIndex = closed ?? lines.length - 1;
        const inner = lines
          .slice(index + 1, endIndex)
          .map((item) => item.text)
          .join('\n');
        const last = lines[endIndex];
        const draft = parseCardFence(
          inner,
          sourcePath,
          line.start,
          last ? last.start + last.text.length : line.start,
        );
        if (draft) drafts.push(draft);
        index = endIndex;
      } else {
        fence = opened;
      }
      continue;
    }
    if (!line.text.trim()) {
      flushParagraph();
      continue;
    }
    const qa = parseQaLine(line, sourcePath);
    if (qa) {
      flushParagraph();
      drafts.push(qa);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return drafts;
}

export function planHandwrittenSync(
  notes: readonly { path: string; content: string }[],
  existing: readonly MemoryCard[],
  today: string,
): HandwrittenSyncPlan {
  const scanned = new Set(notes.map((note) => note.path).filter((path) => !isCardPath(path)));
  const drafts = notes.flatMap((note) => extractHandwritten(note.content, note.path));
  const seen = new Set<string>();
  const upserts: MemoryCard[] = [];
  const existingById = new Map(existing.map((card) => [card.id, card]));

  for (const draft of drafts) {
    let id = draft.id;
    if (seen.has(id))
      id = hashId(`${draft.sourcePath}\n${draft.kind}\n${normalizeText(draft.prompt)}`);
    const taken = existingById.get(id);
    if (taken && taken.origin !== 'handwritten' && taken.sourcePath !== draft.sourcePath) {
      id = hashId(`${draft.sourcePath}\n${draft.kind}\n${normalizeText(draft.prompt)}`);
    }
    if (seen.has(id)) continue;
    seen.add(id);
    const previous = existingById.get(id);
    const next = previous
      ? {
          ...previous,
          kind: draft.kind,
          prompt: draft.prompt,
          answer: draft.answer,
          sourcePath: draft.sourcePath,
          sourceStart: draft.sourceStart,
          sourceEnd: draft.sourceEnd,
        }
      : createCard({ ...draft, origin: 'handwritten', today, id });
    if (previous && sameHandwritten(previous, next)) continue;
    upserts.push(next);
  }

  const removals = existing
    .filter(
      (card) =>
        card.origin === 'handwritten' &&
        card.sourcePath != null &&
        scanned.has(card.sourcePath) &&
        !seen.has(card.id),
    )
    .map((card) => card.path);

  return { upserts, removals };
}

export function remapCardSource(card: MemoryCard, from: string, to: string): MemoryCard {
  if (!card.sourcePath) return card;
  const sourcePath = remapVaultPath(card.sourcePath, from, to);
  return sourcePath === card.sourcePath ? card : { ...card, sourcePath };
}

/**
 * Prefer a short unique phrase inside the generated passage so the card can
 * scroll back to the paragraph it came from. Falls back to the whole passage.
 */
export function sourceSpanForDraft(
  source: string,
  fallback: { start: number; end: number },
  draft: CardDraft,
): { start: number; end: number } {
  const start = clampOffset(fallback.start, source.length);
  const end = Math.max(start, Math.min(fallback.end, source.length));
  const within = source.slice(start, end);
  const probes = [draft.answer, draft.prompt.replace(/\{\{|\}\}/g, '')]
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length >= 4);
  for (const probe of probes) {
    const needle = probe.slice(0, 80);
    const index = within.indexOf(needle);
    if (index >= 0) return { start: start + index, end: start + index + needle.length };
    const compact = needle.slice(0, 24);
    const loose = within.indexOf(compact);
    if (compact.length >= 4 && loose >= 0)
      return { start: start + loose, end: start + loose + compact.length };
  }
  return { start, end };
}

export function parseGeneratedCards(text: string): CardDraft[] {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const raw = fenced?.[1] ?? text;
  const arrayStart = raw.indexOf('[');
  const arrayEnd = raw.lastIndexOf(']');
  let parsed: unknown;
  try {
    if (arrayStart >= 0 && arrayEnd > arrayStart)
      parsed = JSON.parse(raw.slice(arrayStart, arrayEnd + 1));
    else {
      const objectStart = raw.indexOf('{');
      const objectEnd = raw.lastIndexOf('}');
      if (objectStart < 0 || objectEnd <= objectStart) throw new Error('empty');
      parsed = JSON.parse(raw.slice(objectStart, objectEnd + 1));
    }
  } catch {
    throw new Error('模型没有返回卡片');
  }
  const list = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.cards)
      ? parsed.cards
      : null;
  if (!list) throw new Error('模型没有返回卡片');
  const drafts: CardDraft[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : '';
    const answer = typeof item.answer === 'string' ? item.answer.trim() : '';
    if (!prompt || !answer) continue;
    const kind: CardKind = item.kind === 'cloze' || prompt.includes('{{') ? 'cloze' : 'qa';
    drafts.push({ kind, prompt, answer });
    if (drafts.length >= 8) break;
  }
  if (drafts.length === 0) throw new Error('模型没有返回可用的卡片');
  return drafts;
}

export const CARD_SYSTEM_PROMPT = [
  '你是记忆卡片编辑。只根据用户给出的笔记提炼卡片，不要补充笔记里没有的事实。',
  '只输出一个 JSON 数组，不要输出其它文字。每项是：',
  '{"kind":"qa","prompt":"可以单独读懂的问题","answer":"简短答案"}',
  '或 {"kind":"cloze","prompt":"用 {{关键词}} 挖空的句子","answer":"关键词"}。',
  '一共 3 到 6 张。挖空每次只藏一个词或短语。',
].join('\n');

function nextEase(ease: number, quality: number): number {
  const next = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return clampEase(next);
}

function nextInterval(card: MemoryCard, grade: ReviewGrade): number {
  if (card.repetitions <= 0) {
    if (grade === 'hard') return 1;
    if (grade === 'easy') return 7;
    return 3;
  }
  if (grade === 'hard') return Math.max(1, Math.round(card.interval * 1.2));
  if (grade === 'easy') return Math.max(1, Math.round(card.interval * card.ease * 1.3));
  return Math.max(1, Math.round(card.interval * card.ease));
}

function clampEase(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded < 1.3 ? 1.3 : rounded;
}

function formatEase(value: number): string {
  return String(clampEase(value));
}

function prefixFor(origin: CardOrigin): 'g' | 'm' | 'h' {
  if (origin === 'handwritten') return 'h';
  if (origin === 'manual') return 'm';
  return 'g';
}

function cardTitle(prompt: string): string {
  const line = prompt
    .replace(/\{\{|\}\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return line.length > 80 ? `${line.slice(0, 80)}…` : line || '记忆卡片';
}

function yamlString(value: string): string {
  if (value === '' || /[:#{}[\],&*!|>'"%@`]/.test(value) || value !== value.trim()) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, "'")}"`;
  }
  return value;
}

function readFrontmatter(content: string): { data: Record<string, string>; end: number } | null {
  if (!content.startsWith('---')) return null;
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n)?/.exec(content);
  if (!match) return null;
  const data: Record<string, string> = {};
  for (const line of (match[1] ?? '').split(/\r?\n/)) {
    const pair = /^\s*([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    const key = pair?.[1];
    if (!key) continue;
    data[key] = unquote(pair[2]?.trim() ?? '');
  }
  return { data, end: match[0].length };
}

function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'"))
      return value.slice(1, -1);
  }
  return value;
}

function splitCardBody(body: string): { prompt: string; answer: string } | null {
  const match = /##[ \t]*问题[ \t]*\r?\n([\s\S]*?)\r?\n##[ \t]*答案[ \t]*\r?\n([\s\S]*)$/.exec(
    body,
  );
  if (!match) return null;
  const prompt = (match[1] ?? '').trim();
  const answer = (match[2] ?? '').replace(/\n*来源：\[\[[^\]]+\]\]\s*$/, '').trim();
  if (!prompt || !answer) return null;
  return { prompt, answer };
}

function parseOrigin(value: string | undefined): CardOrigin {
  if (value === 'handwritten' || value === 'manual' || value === 'generated') return value;
  return 'generated';
}

function parseOffset(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return Number(value);
}

function numberOr(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

interface LineSpan {
  start: number;
  text: string;
}

function splitLines(content: string): LineSpan[] {
  const lines: LineSpan[] = [];
  let start = 0;
  for (let index = 0; index <= content.length; index += 1) {
    if (index !== content.length && content[index] !== '\n') continue;
    const raw = content.slice(start, index);
    lines.push({ start, text: raw.endsWith('\r') ? raw.slice(0, -1) : raw });
    start = index + 1;
  }
  return lines;
}

function openFence(line: string): { char: string; length: number; info: string } | null {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  const marker = match?.[1];
  if (!marker) return null;
  return { char: marker[0] ?? '`', length: marker.length, info: (match?.[2] ?? '').trim() };
}

function closesFence(line: string, char: string, length: number): boolean {
  const match = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
  const marker = match?.[1];
  return Boolean(marker && marker[0] === char && marker.length >= length);
}

function findClosingFence(
  lines: readonly LineSpan[],
  from: number,
  char: string,
  length: number,
): number | null {
  for (let index = from; index < lines.length; index += 1) {
    if (closesFence(lines[index]?.text ?? '', char, length)) return index;
  }
  return null;
}

function parseCardFence(
  body: string,
  sourcePath: string,
  start: number,
  end: number,
): HandwrittenDraft | null {
  let explicitId = '';
  let mode: 'idle' | 'q' | 'a' = 'idle';
  const question: string[] = [];
  const answer: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const id = /^id:\s*(\S+)\s*$/.exec(line.trim());
    if (mode === 'idle' && id?.[1]) {
      explicitId = id[1];
      continue;
    }
    const questionLine = /^Q:[ \t]?(.*)$/.exec(line);
    if (questionLine) {
      mode = 'q';
      question.push(questionLine[1] ?? '');
      continue;
    }
    const answerLine = /^A:[ \t]?(.*)$/.exec(line);
    if (answerLine) {
      mode = 'a';
      answer.push(answerLine[1] ?? '');
      continue;
    }
    if (mode === 'q') question.push(line);
    else if (mode === 'a') answer.push(line);
  }
  const prompt = question.join('\n').trim();
  const answerText = answer.join('\n').trim();
  if (!prompt || !answerText) return null;
  const kind: CardKind = prompt.includes('{{') ? 'cloze' : 'qa';
  return {
    id: handwrittenId(kind, prompt, explicitId),
    kind,
    prompt,
    answer: answerText,
    sourcePath,
    sourceStart: start,
    sourceEnd: end,
  };
}

function parseQaLine(line: LineSpan, sourcePath: string): HandwrittenDraft | null {
  const match = /^(.+?)\s*::\s*(.+)$/.exec(line.text.trim());
  const prompt = match?.[1]?.trim() ?? '';
  const answer = match?.[2]?.trim() ?? '';
  if (!prompt || !answer || prompt.includes('://')) return null;
  return {
    id: handwrittenId('qa', prompt),
    kind: 'qa',
    prompt,
    answer,
    sourcePath,
    sourceStart: line.start,
    sourceEnd: line.start + line.text.length,
  };
}

function clozeFromParagraph(
  lines: readonly LineSpan[],
  sourcePath: string,
): HandwrittenDraft | null {
  if (lines.length === 0) return null;
  const prompt = lines
    .map((line) => line.text)
    .join('\n')
    .trim();
  const answers = [...prompt.matchAll(/\{\{([^{}\n]+)\}\}/g)]
    .map((match) => match[1]?.trim() ?? '')
    .filter((item) => item.length > 0);
  if (answers.length === 0) return null;
  const first = lines[0];
  const last = lines[lines.length - 1];
  if (!first || !last) return null;
  return {
    id: handwrittenId('cloze', prompt),
    kind: 'cloze',
    prompt,
    answer: answers.join('、'),
    sourcePath,
    sourceStart: first.start,
    sourceEnd: last.start + last.text.length,
  };
}

function handwrittenId(kind: string, prompt: string, explicit = ''): string {
  if (explicit && SAFE_ID.test(explicit)) return explicit;
  return hashId(`${kind}\n${normalizeText(prompt)}`);
}

function hashId(seed: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const symbol of seed) {
    hash ^= BigInt(symbol.codePointAt(0) ?? 0);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return `h${hash.toString(16).padStart(16, '0').slice(0, 10)}`;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sameHandwritten(previous: MemoryCard, next: MemoryCard): boolean {
  return (
    previous.kind === next.kind &&
    previous.prompt === next.prompt &&
    previous.answer === next.answer &&
    previous.sourcePath === next.sourcePath &&
    previous.sourceStart === next.sourceStart &&
    previous.sourceEnd === next.sourceEnd &&
    previous.path === next.path
  );
}

function clampOffset(offset: number, length: number): number {
  if (!Number.isFinite(offset)) return 0;
  return Math.max(0, Math.min(Math.trunc(offset), length));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
