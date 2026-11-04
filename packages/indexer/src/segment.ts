const CJK =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;

/**
 * Isolate CJK characters so the unicode61 tokenizer indexes them one by one.
 * A query for a two-character word then becomes an FTS phrase, which trigram
 * mode would drop because those tokens are shorter than three characters.
 * Latin text is left as words.
 */
export function segmentForSearch(text: string): string {
  return text
    .replace(CJK, (char) => ` ${char} `)
    .replace(/\s+/g, " ")
    .trim();
}

/** Quote a user query as a single FTS5 phrase, after {@link segmentForSearch}. */
export function toFtsQuery(userQuery: string): string | undefined {
  const segmented = segmentForSearch(userQuery);
  if (!segmented) return undefined;
  return `"${segmented.replaceAll('"', '""')}"`;
}
