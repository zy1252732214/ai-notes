/**
 * String checks on the text the model already wrote.
 * A mark is located when that exact string occurs in a supplied excerpt.
 * This does not choose a note, rewrite the answer, or decide which note is true.
 */

export interface MarkHit {
  mark: string;
  paths: string[];
}

export interface AnswerChecks {
  marks: MarkHit[];
  missing: string[];
  splitAcrossNotes: boolean;
}

export function emptyChecks(): AnswerChecks {
  return { marks: [], missing: [], splitAcrossNotes: false };
}

const CODE = /[A-Za-z0-9][A-Za-z0-9-]{5,}/g;
const CN_DATE = /20\d{2}年\d{1,2}月\d{1,2}日/g;
const ISO_DATE = /\d{4}-\d{2}-\d{2}/g;

function bounded(text: string, index: number, length: number): boolean {
  const before = index === 0 || !/[A-Za-z0-9-]/.test(text[index - 1] ?? '');
  const after = index + length >= text.length || !/[A-Za-z0-9-]/.test(text[index + length] ?? '');
  return before && after;
}

/** Codes and calendar dates written in the answer. Short PINs stay out of this list. */
export function marksInText(text: string): string[] {
  const found: Array<{ index: number; value: string }> = [];
  for (const pattern of [CN_DATE, ISO_DATE]) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const value = match[0];
      const index = match.index ?? 0;
      if (!bounded(text, index, value.length)) continue;
      found.push({ index, value });
    }
  }
  CODE.lastIndex = 0;
  for (const match of text.matchAll(CODE)) {
    const value = match[0];
    const index = match.index ?? 0;
    if (!bounded(text, index, value.length)) continue;
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) continue;
    found.push({ index, value });
  }
  found.sort((left, right) => left.index - right.index || right.value.length - left.value.length);
  const used: Array<[number, number]> = [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of found) {
    const end = item.index + item.value.length;
    const overlap = used.some(([start, stop]) => item.index < stop && end > start);
    if (overlap || seen.has(item.value)) continue;
    used.push([item.index, end]);
    seen.add(item.value);
    result.push(item.value);
  }
  return result;
}

export function locateMarks(
  answer: string,
  sources: readonly { path: string; excerpt: string }[],
): AnswerChecks {
  const marks = marksInText(answer).map((mark) => ({
    mark,
    paths: sources.filter((source) => source.excerpt.includes(mark)).map((source) => source.path),
  }));
  const missing = marks.filter((item) => item.paths.length === 0).map((item) => item.mark);
  const located = marks.filter((item) => item.paths.length > 0);
  let splitAcrossNotes = false;
  if (located.length >= 2) {
    const [first, ...rest] = located;
    if (first) {
      splitAcrossNotes = !first.paths.some((path) =>
        rest.every((item) => item.paths.includes(path)),
      );
    }
  }
  return { marks, missing, splitAcrossNotes };
}

/** Whether the answer contains a contiguous slice of this excerpt. Not a fact check. */
export function excerptAppearsInAnswer(answer: string, excerpt: string): boolean {
  const compact = (value: string) => value.replace(/\s+/g, '');
  const haystack = compact(answer);
  const needle = compact(excerpt);
  if (needle.length < 4) return false;
  if (needle.length < 8) return haystack.includes(needle);
  for (let index = 0; index + 8 <= needle.length; index += 1) {
    if (haystack.includes(needle.slice(index, index + 8))) return true;
  }
  return false;
}
