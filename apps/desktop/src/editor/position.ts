export function cursorFromOffset(
  content: string,
  offset: number,
): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, content.length));
  const lines = content.slice(0, clamped).split('\n');
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}
