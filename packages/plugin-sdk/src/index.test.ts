import { describe, expect, it } from 'vitest';
import { packageId, PLUGIN_API_VERSION } from './index.js';

describe('@ai-notes/plugin-sdk', () => {
  it('exposes its workspace package id', () => {
    expect(packageId).toBe('@ai-notes/plugin-sdk');
  });

  it('marks the plugin API as preview v1', () => {
    expect(PLUGIN_API_VERSION).toBe('preview-v1');
  });
});
