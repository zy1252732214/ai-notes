export interface SnippetPiece {
  text: string;
  marked: boolean;
}

/** Split an indexer snippet on `<b>` markers without interpreting other markup. */
export function parseSnippet(snippet: string): SnippetPiece[] {
  const pieces: SnippetPiece[] = [];
  const pattern = /<b>([\s\S]*?)<\/b>/g;
  let cursor = 0;
  for (const match of snippet.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) pieces.push({ text: snippet.slice(cursor, index), marked: false });
    const text = match[1] ?? '';
    if (text) pieces.push({ text, marked: true });
    cursor = index + match[0].length;
  }
  if (cursor < snippet.length) pieces.push({ text: snippet.slice(cursor), marked: false });
  return pieces;
}

export function stripSnippet(snippet: string): string {
  return parseSnippet(snippet)
    .map((piece) => piece.text)
    .join('');
}
