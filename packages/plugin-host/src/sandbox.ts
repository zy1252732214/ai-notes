import type { PluginManifest } from '@ai-notes/plugin-sdk';
import { SANDBOX_SDK_SOURCE } from './sandboxSource.js';

/** 不授予 allow-same-origin，沙箱脚本只能通过 postMessage 联系宿主。 */
export const IFRAME_SANDBOX = 'allow-scripts';

function classicSdk(source: string): string {
  return `${source
    .replace('export function definePlugin', 'function definePlugin')
    .replace('export async function boot', 'async function boot')}
globalThis.__aiNotes = { definePlugin, boot };
`;
}

function classicPlugin(source: string): string {
  return source
    .replace(/import\s+\{\s*definePlugin\s*\}\s+from\s+['"]@ai-notes\/plugin-sdk['"];?\s*/, '')
    .replace(/export\s+default\s+/, 'globalThis.__aiNotesPlugin = ');
}

/** 插件 iframe 的 srcdoc。用普通脚本，不依赖 import map。 */
export function buildSandboxSrcdoc(manifest: PluginManifest, mainSource: string): string {
  const manifestJson = JSON.stringify(manifest).replaceAll('<', '\\u003c');
  const script = `${classicSdk(SANDBOX_SDK_SOURCE)}\n${classicPlugin(mainSource)}\nvoid boot(globalThis.__aiNotesPlugin, ${manifestJson});\n`;
  return `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>${script.replaceAll('</', '<\\/')}</script>
</body>
</html>`;
}
