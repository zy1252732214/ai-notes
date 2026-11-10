import helloManifest from '../../plugin-sdk/examples/hello-notes/manifest.json' with { type: 'json' };
import { describe, expect, it } from 'vitest';
import { parseManifest } from './manifest.js';

describe('parseManifest', () => {
  it('接受 hello-notes 示例清单', () => {
    const parsed = parseManifest(helloManifest);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.manifest.id).toBe('hello-notes');
      expect(parsed.manifest.permissions?.[0]?.id).toBe('vault:read');
    }
  });

  it('拒绝未知权限、未声明的网络域名和越界入口', () => {
    expect(parseManifest({ ...helloManifest, permissions: [{ id: 'shell' }] }).ok).toBe(false);
    expect(parseManifest({ ...helloManifest, permissions: [{ id: 'network' }] }).ok).toBe(false);
    expect(
      parseManifest({
        ...helloManifest,
        permissions: [{ id: 'network', domains: ['https://example.com/a'] }],
      }).ok,
    ).toBe(false);
    expect(parseManifest({ ...helloManifest, main: '../main.js' }).ok).toBe(false);
    expect(parseManifest({ ...helloManifest, apiVersion: 'v1' }).ok).toBe(false);
  });
});
