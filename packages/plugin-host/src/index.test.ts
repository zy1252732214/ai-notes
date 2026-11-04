import { describe, expect, it } from 'vitest';
import { packageId, workspaceDependencies } from './index.js';

describe('@ai-notes/plugin-host', () => {
  it('exposes its workspace package id', () => {
    expect(packageId).toBe('@ai-notes/plugin-host');
  });

  it('keeps the intended workspace links', () => {
    expect([...workspaceDependencies]).toEqual(['@ai-notes/core', '@ai-notes/plugin-sdk']);
  });
});
