/** 只访问 `<vault>/.ainotes/` 下的相对路径，例如 `plugins/hello-notes/manifest.json`。 */
export interface PluginStorage {
  read(path: string): Promise<string | null>;
  write(path: string, contents: string): Promise<void>;
  /** 列出目录的直接子项名称。目录不存在时返回空数组。 */
  list(dir: string): Promise<readonly string[]>;
}

export function normalizeMetaPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (
    normalized.length === 0 ||
    normalized
      .split('/')
      .some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw new Error('插件路径无效');
  }
  return normalized;
}

/** 测试和示例库用的内存存储。路径相对 `.ainotes`。 */
export class MemoryPluginStorage implements PluginStorage {
  private readonly files = new Map<string, string>();

  async read(path: string): Promise<string | null> {
    return this.files.get(normalizeMetaPath(path)) ?? null;
  }

  async write(path: string, contents: string): Promise<void> {
    this.files.set(normalizeMetaPath(path), contents);
  }

  async list(dir: string): Promise<readonly string[]> {
    const prefix = `${normalizeMetaPath(dir)}/`;
    const names = new Set<string>();
    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const name = key.slice(prefix.length).split('/')[0];
      if (name) names.add(name);
    }
    return [...names].sort();
  }
}
