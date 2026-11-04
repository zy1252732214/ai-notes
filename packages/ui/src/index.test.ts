import { describe, expect, it } from 'vitest';
import { packageId } from './index.js';

describe('@ai-notes/ui', () => {
  it('exposes its workspace package id', () => {
    expect(packageId).toBe('@ai-notes/ui');
  });
});
