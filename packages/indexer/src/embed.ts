import type { ChunkVectorWrite, PendingChunk } from './types.js';

/** Text sent to the embedding model for one chunk. The heading stays attached. */
export function embeddingDocument(headingPath: string, text: string): string {
  const body = text.trim();
  const heading = headingPath.trim();
  if (heading && body) return `${heading}\n${body}`;
  return body || heading;
}

export interface EmbeddingTarget {
  pendingChunks(model: string): readonly PendingChunk[] | Promise<readonly PendingChunk[]>;
  setChunkVectors(model: string, vectors: readonly ChunkVectorWrite[]): void | Promise<void>;
}

export interface ChunkEmbedder {
  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
}

/**
 * Embed chunks that do not yet have a vector for `model`.
 * Returns how many chunks were written. An empty document is skipped.
 */
export async function fillMissingEmbeddings(
  target: EmbeddingTarget,
  model: string,
  embedder: ChunkEmbedder,
  batchSize = 16,
): Promise<number> {
  if (!model.trim()) throw new Error('model is required');
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('batchSize must be a positive integer');
  }
  let written = 0;
  const seen = new Set<number>();
  for (;;) {
    const pending = await target.pendingChunks(model);
    const batch = pending
      .filter((chunk) => !seen.has(chunk.chunkId))
      .filter((chunk) => embeddingDocument(chunk.headingPath, chunk.text).length > 0)
      .slice(0, batchSize);
    if (batch.length === 0) return written;
    for (const chunk of batch) seen.add(chunk.chunkId);
    const vectors = await embedder.embed(
      batch.map((chunk) => embeddingDocument(chunk.headingPath, chunk.text)),
    );
    if (vectors.length !== batch.length) {
      throw new Error('embedding model returned a different number of vectors');
    }
    await target.setChunkVectors(
      model,
      batch.map((chunk, index) => {
        const embedding = vectors[index];
        if (!embedding) throw new Error('embedding model returned an empty vector');
        return { chunkId: chunk.chunkId, embedding };
      }),
    );
    written += batch.length;
  }
}
