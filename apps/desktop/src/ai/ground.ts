import type { CitationSource } from './ask.js';

export const UNKNOWN_ANSWER = '笔记里没有找到依据。';
export const CONFLICT_ANSWER = '笔记记载不一致，无法确定。';

const MIN_OVERLAP = 4;
const STUFF_QUESTION = 8;

export interface SettledAnswer {
  text: string;
  citations: CitationSource[];
}

/** Drop echoed wrappers. The words inside stay. */
export function stripEcho(text: string): string {
  return text
    .replace(/<\|im_start\|>|<\|im_end\|>/gi, '')
    .replace(/<\/?\s*note\b[^>\n]*>/gi, '')
    .replace(/<\s*\/\s*note\b[^>\n]*>/gi, '')
    .trim();
}

/**
 * Decide what to show after the model speaks.
 * Retrieved notes are the only evidence. A note that merely repeats the question
 * cannot outrank a note that shares part of the question and then adds its own text.
 * The displayed fact has to occur in that note. This does not run commands.
 */
export function settleAnswer(
  question: string,
  evidence: readonly CitationSource[],
  modelText: string,
): SettledAnswer {
  const clean = stripEcho(modelText);
  const ranked = rankEvidence(question, evidence);
  if (ranked.length === 0) return { text: UNKNOWN_ANSWER, citations: [] };
  const bestScore = ranked[0]?.score ?? 0;
  const best = ranked.filter((item) => item.score === bestScore);
  if (best.length !== 1) return { text: CONFLICT_ANSWER, citations: [] };
  const chosen = best[0]?.source;
  if (!chosen) return { text: UNKNOWN_ANSWER, citations: [] };
  const needle = longestShared(normalize(question), normalize(chosen.excerpt));
  if (quotesChosen(clean, question, chosen.excerpt)) {
    return { text: clean, citations: [chosen] };
  }
  const quote = sentenceAround(chosen.excerpt, needle);
  if (!quote) return { text: UNKNOWN_ANSWER, citations: [] };
  return { text: quote, citations: [chosen] };
}

function rankEvidence(
  question: string,
  evidence: readonly CitationSource[],
): Array<{ source: CitationSource; score: number }> {
  const asked = normalize(question);
  if (asked.length < MIN_OVERLAP) return [];
  const ranked: Array<{ source: CitationSource; score: number }> = [];
  for (const source of evidence) {
    const body = normalize(source.excerpt);
    if (asked.length >= STUFF_QUESTION && body.includes(asked)) continue;
    const score = longestShared(asked, body).length;
    if (score < MIN_OVERLAP) continue;
    if (!hasOwnText(source.excerpt, question)) continue;
    ranked.push({ source, score });
  }
  ranked.sort(
    (left, right) => right.score - left.score || left.source.path.localeCompare(right.source.path),
  );
  return ranked;
}

function quotesChosen(answer: string, question: string, excerpt: string): boolean {
  const asked = normalize(question);
  const body = normalize(excerpt);
  const spoken = normalize(answer);
  if (!spoken) return false;
  for (let index = 0; index + MIN_OVERLAP <= spoken.length; index += 1) {
    const slice = spoken.slice(index, index + MIN_OVERLAP);
    if (asked.includes(slice)) continue;
    if (!body.includes(slice)) return false;
  }
  const own = ownSlices(excerpt, question);
  return own.some((slice) => spoken.includes(normalize(slice)));
}

function hasOwnText(excerpt: string, question: string): boolean {
  return ownSlices(excerpt, question).length > 0;
}

function ownSlices(excerpt: string, question: string): string[] {
  const asked = normalize(question);
  const found: string[] = [];
  for (const match of excerpt.matchAll(/[\p{Script=Han}]{4,}|[A-Za-z0-9][A-Za-z0-9-]{5,}/gu)) {
    const slice = match[0] ?? '';
    if (slice && !asked.includes(normalize(slice))) found.push(slice);
  }
  return found;
}

function sentenceAround(excerpt: string, needle: string): string {
  const raw = needleInExcerpt(excerpt, needle);
  const sentences = excerpt
    .split(/(?<=[。！？\n])/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const found = raw ? sentences.find((part) => part.includes(raw)) : undefined;
  const quote = (found ?? excerpt.trim()).replace(/\s+/g, ' ').trim();
  if (!quote) return '';
  return quote.length > 240 ? `${quote.slice(0, 240)}…` : quote;
}

function needleInExcerpt(excerpt: string, needle: string): string {
  if (!needle) return '';
  if (excerpt.includes(needle)) return needle;
  const compact = normalize(excerpt);
  const at = compact.indexOf(needle);
  if (at < 0) return '';
  let seen = 0;
  let start = 0;
  let end = excerpt.length;
  for (let index = 0; index < excerpt.length; index += 1) {
    if (!isKept(excerpt[index] ?? '')) continue;
    if (seen === at) start = index;
    seen += 1;
    if (seen === at + needle.length) {
      end = index + 1;
      break;
    }
  }
  return excerpt.slice(start, end);
}

function normalize(text: string): string {
  return [...text].filter((char) => isKept(char)).join('');
}

function isKept(char: string): boolean {
  return /[\p{Script=Han}\p{Script=Latin}0-9]/u.test(char);
}

function longestShared(left: string, right: string): string {
  if (!left || !right) return '';
  let previous = new Array<number>(right.length + 1).fill(0);
  let best = '';
  for (let row = 1; row <= left.length; row += 1) {
    const current = new Array<number>(right.length + 1).fill(0);
    for (let column = 1; column <= right.length; column += 1) {
      const leftChar = left[row - 1];
      const rightChar = right[column - 1];
      if (leftChar === undefined || rightChar === undefined || leftChar !== rightChar) continue;
      const length = (previous[column - 1] ?? 0) + 1;
      current[column] = length;
      if (length > best.length) best = left.slice(row - length, row);
    }
    previous = current;
  }
  return best;
}
