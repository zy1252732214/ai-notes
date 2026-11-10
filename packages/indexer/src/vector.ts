import type { SearchHit } from './types.js';

/** Neighbors at or below this cosine similarity are left out of hybrid ranking. */
export const MIN_VECTOR_SIMILARITY = 0.25;

/** Cosine similarity in [-1, 1]. A zero or mismatched vector scores 0. */
export function cosineSimilarity(left: ArrayLike<number>, right: ArrayLike<number>): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

/**
 * Reciprocal rank fusion over best-first id lists.
 * The score is higher when an id ranks well in more than one list. `k` is 60.
 */
export function fuseRanks(lists: readonly (readonly number[])[], k = 60): Map<number, number> {
  const scores = new Map<number, number>();
  for (const list of lists) {
    list.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return scores;
}

/** Keep the first list's snippet when a chunk appears in more than one list. */
export function mergeHits(lists: readonly (readonly SearchHit[])[], limit: number): SearchHit[] {
  const scores = fuseRanks(lists.map((list) => list.map((hit) => hit.chunkId)));
  const first = new Map<number, SearchHit>();
  for (const list of lists) {
    for (const hit of list) {
      if (!first.has(hit.chunkId)) first.set(hit.chunkId, hit);
    }
  }
  return [...first.values()]
    .map((hit) => ({ ...hit, score: scores.get(hit.chunkId) ?? 0 }))
    .sort((left, right) => right.score - left.score || left.chunkId - right.chunkId)
    .slice(0, limit);
}

export function encodeFloat32(values: ArrayLike<number>): Uint8Array {
  const floats = new Float32Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`embedding[${index}] must be a finite number`);
    }
    floats[index] = value;
  }
  return new Uint8Array(floats.buffer.slice(0));
}

export function decodeFloat32(blob: Uint8Array): number[] {
  const copy = Uint8Array.from(blob);
  const length = Math.floor(copy.byteLength / 4);
  const floats = new Float32Array(copy.buffer, copy.byteOffset, length);
  return Array.from(floats);
}
