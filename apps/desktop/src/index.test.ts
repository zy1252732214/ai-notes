import { describe, expect, it } from 'vitest';
import { packageId, workspaceDependencies, runtime } from './index.js';

describe('@ai-notes/desktop', () => {
  it('exposes its workspace package id', () => {
    expect(packageId).toBe('@ai-notes/desktop');
  });

  it('reserves the Tauri 2 runtime id', () => {
    expect(runtime).toBe('tauri-2');
  });

  it('keeps the intended workspace links', () => {
    expect([...workspaceDependencies]).toEqual([
      '@ai-notes/ai',
      '@ai-notes/core',
      '@ai-notes/editor',
      '@ai-notes/indexer',
      '@ai-notes/plugin-host',
      '@ai-notes/plugin-sdk',
      '@ai-notes/ui',
    ]);
  });
});
