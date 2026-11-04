import { describe, expect, it } from 'vitest';
import { packageId } from './index.js';

describe('@ai-notes/core', () => {
  it('exposes its workspace package id', () => {
    expect(packageId).toBe('@ai-notes/core');
  });
});
