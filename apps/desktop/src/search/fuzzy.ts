export interface NoteName {
  path: string;
  name: string;
}

/** Rank vault files by a subsequence match on the file name, then the path. */
export function fuzzyMatchFiles(files: readonly NoteName[], query: string, limit = 30): NoteName[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...files]
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name, 'zh-Hans') ||
          left.path.localeCompare(right.path, 'zh-Hans'),
      )
      .slice(0, limit);
  }

  const scored = files
    .map((file) => ({ file, score: scoreFile(file, needle) }))
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.file.name.localeCompare(right.file.name, 'zh-Hans') ||
        left.file.path.localeCompare(right.file.path, 'zh-Hans'),
    );

  return scored.slice(0, limit).map((item) => item.file);
}

function scoreFile(file: NoteName, needle: string): number {
  const name = scoreText(file.name.toLowerCase(), needle);
  const path = scoreText(file.path.toLowerCase(), needle);
  if (name === 0 && path === 0) return 0;
  if (name > 0) return name + 25;
  return path;
}

function scoreText(haystack: string, needle: string): number {
  const exact = haystack.indexOf(needle);
  if (exact >= 0) {
    let score = 80 + needle.length * 4;
    if (exact === 0) score += 30;
    else if (isBoundary(haystack, exact)) score += 16;
    return score;
  }

  let score = 0;
  let cursor = 0;
  let streak = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, cursor);
    if (found < 0) return 0;
    streak = found === cursor ? streak + 1 : 1;
    score += 8 + streak * 6;
    if (isBoundary(haystack, found)) score += 10;
    cursor = found + 1;
  }
  return Math.max(1, score - (haystack.length - needle.length));
}

function isBoundary(text: string, index: number): boolean {
  if (index <= 0) return true;
  const previous = text[index - 1] ?? '';
  return (
    previous === '/' || previous === '-' || previous === '_' || previous === ' ' || previous === '.'
  );
}
