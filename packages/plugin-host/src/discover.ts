import type { PluginManifest } from '@ai-notes/plugin-sdk';
import { formatManifestIssues, parseManifest } from './manifest.js';
import { normalizeMetaPath, type PluginStorage } from './storage.js';

export interface DiscoveredPlugin {
  directory: string;
  manifest: PluginManifest | null;
  mainSource: string | null;
  error: string | null;
}

function pluginFile(directory: string, relative: string): string {
  const file = normalizeMetaPath(relative);
  if (file.split('/').some((segment) => segment === '..')) {
    throw new Error('插件入口路径无效');
  }
  return normalizeMetaPath(`plugins/${directory}/${file}`);
}

/** 读取 `.ainotes/plugins/<id>/manifest.json`，并带上入口脚本。 */
export async function discoverPlugins(storage: PluginStorage): Promise<DiscoveredPlugin[]> {
  let names: readonly string[];
  try {
    names = await storage.list('plugins');
  } catch {
    return [];
  }
  const found: DiscoveredPlugin[] = [];
  for (const directory of names) {
    const raw = await storage.read(`plugins/${directory}/manifest.json`);
    if (raw === null) continue;
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw) as unknown;
    } catch {
      found.push({
        directory,
        manifest: null,
        mainSource: null,
        error: 'manifest.json 不是合法 JSON',
      });
      continue;
    }
    const parsed = parseManifest(parsedJson);
    if (!parsed.ok) {
      found.push({
        directory,
        manifest: null,
        mainSource: null,
        error: formatManifestIssues(parsed.issues),
      });
      continue;
    }
    if (parsed.manifest.id !== directory) {
      found.push({
        directory,
        manifest: parsed.manifest,
        mainSource: null,
        error: `目录名 ${directory} 与清单 id ${parsed.manifest.id} 不一致`,
      });
      continue;
    }
    let mainSource: string | null = null;
    let error: string | null = null;
    try {
      mainSource = await storage.read(pluginFile(directory, parsed.manifest.main));
      if (mainSource === null) error = `找不到入口 ${parsed.manifest.main}`;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '插件入口路径无效';
    }
    found.push({
      directory,
      manifest: parsed.manifest,
      mainSource,
      error,
    });
  }
  return found;
}

export async function readDisabledIds(storage: PluginStorage): Promise<Set<string>> {
  const raw = await storage.read('plugin-state.json');
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as { disabled?: unknown };
    if (!Array.isArray(parsed.disabled)) return new Set();
    return new Set(parsed.disabled.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

export async function writeDisabledIds(
  storage: PluginStorage,
  ids: readonly string[],
): Promise<void> {
  await storage.write(
    'plugin-state.json',
    `${JSON.stringify({ disabled: [...ids].sort() }, null, 2)}\n`,
  );
}

export async function installPluginFiles(
  storage: PluginStorage,
  id: string,
  files: Readonly<Record<string, string>>,
): Promise<void> {
  for (const [name, contents] of Object.entries(files)) {
    await storage.write(`plugins/${id}/${name}`, contents);
  }
}
