const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;

/**
 * Isolate CJK characters so the unicode61 tokenizer indexes them one by one.
 * A query for a two-character word then becomes an FTS phrase, which trigram
 * mode would drop because those tokens are shorter than three characters.
 * Latin text is left as words.
 */
export function segmentForSearch(text: string): string {
  return text
    .replace(CJK, (char) => ` ${char} `)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quote a user query as a single FTS5 phrase, after {@link segmentForSearch}. */
export function toFtsQuery(userQuery: string): string | undefined {
  const segmented = segmentForSearch(userQuery);
  if (!segmented) return undefined;
  return `"${segmented.replaceAll('"', '""')}"`;
}

const ASCII_WORD = /[A-Za-z0-9_]{2,}/g;

function cjkRuns(text: string): string[] {
  return (
    text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu) ?? []
  );
}

/** Overlapping CJK pairs plus ASCII words. Each term is a quoted FTS phrase. */
export const OVERLAP_TERM_LIMIT = 48;

/**
 * FTS query for a natural-language question that is not a contiguous phrase.
 * Bigrams stay inside one CJK run, so punctuation breaks them.
 * Returns undefined when the query has no CJK bigram; English stays on the phrase path.
 */
export function toFtsOverlapQuery(userQuery: string): string | undefined {
  const terms: string[] = [];
  const seen = new Set<string>();
  let bigrams = 0;
  const push = (token: string, kind: 'word' | 'bigram') => {
    if (terms.length >= OVERLAP_TERM_LIMIT || seen.has(token)) return;
    seen.add(token);
    terms.push(`"${token.replaceAll('"', '""')}"`);
    if (kind === 'bigram') bigrams += 1;
  };
  for (const match of userQuery.matchAll(ASCII_WORD)) {
    const word = match[0];
    if (!word || terms.length >= 16) break;
    push(word, 'word');
  }
  for (const run of cjkRuns(userQuery)) {
    const chars = [...run];
    for (let index = 0; index + 1 < chars.length; index += 1) {
      const left = chars[index];
      const right = chars[index + 1];
      if (!left || !right) continue;
      push(`${left} ${right}`, 'bigram');
    }
  }
  if (bigrams === 0) return undefined;
  return terms.join(' OR ');
}

export interface OverlapScore {
  span: number;
  bigrams: number;
  words: number;
  /** Slice of `text` to highlight. Empty when nothing overlaps. */
  needle: string;
}

/** Longest CJK piece of `query` that actually occurs in `text`, plus word hits. */
export function scoreOverlap(query: string, text: string): OverlapScore {
  const haystack = text.toLowerCase();
  let needle = '';
  const seenBigrams = new Set<string>();
  let bigrams = 0;
  for (const run of cjkRuns(query)) {
    const chars = [...run];
    for (let length = chars.length; length >= 2 && length > [...needle].length; length -= 1) {
      let found = false;
      for (let index = 0; index + length <= chars.length; index += 1) {
        const piece = chars.slice(index, index + length).join('');
        const at = haystack.indexOf(piece.toLowerCase());
        if (at < 0) continue;
        needle = text.slice(at, at + piece.length);
        found = true;
        break;
      }
      if (found) break;
    }
    for (let index = 0; index + 1 < chars.length; index += 1) {
      const pair = `${chars[index] ?? ''}${chars[index + 1] ?? ''}`;
      if (seenBigrams.has(pair)) continue;
      seenBigrams.add(pair);
      if (haystack.includes(pair.toLowerCase())) bigrams += 1;
    }
  }
  const seenWords = new Set<string>();
  let words = 0;
  for (const match of query.matchAll(ASCII_WORD)) {
    const word = (match[0] ?? '').toLowerCase();
    if (!word || seenWords.has(word)) continue;
    seenWords.add(word);
    if (haystack.includes(word)) words += 1;
  }
  return { span: [...needle].length, bigrams, words, needle };
}

/**
 * A two-character hit counts only when it is the start of a query run.
 * Otherwise「全文检索」would match a note that only has「检索」.
 * Three or more shared characters are enough on their own.
 */
export function overlapKeeps(query: string, score: OverlapScore): boolean {
  if (score.words > 0 || score.span >= 3) return true;
  if (score.span < 2 || !score.needle) return false;
  const needle = [...score.needle];
  for (const run of cjkRuns(query)) {
    const chars = [...run];
    if (chars.length < needle.length) continue;
    if (chars.slice(0, needle.length).join('') === score.needle) return true;
  }
  return false;
}
