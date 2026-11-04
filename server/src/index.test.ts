import { describe, expect, it } from 'vitest';
import { packageId, stage } from './index.js';

describe('@ai-notes/server', () => {
  it('exposes its workspace package id', () => {
    expect(packageId).toBe('@ai-notes/server');
  });

  it('stays on the P2 roadmap', () => {
    expect(stage).toBe('p2');
  });
});
