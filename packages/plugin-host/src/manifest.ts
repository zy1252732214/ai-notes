import type { Permission, PluginManifest } from '@ai-notes/plugin-sdk';

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const MAIN_PATTERN =
  /^(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*(?:^|\/)\.(?:\/|$))(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.m?js$/;
const DOMAIN_PATTERN =
  /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const VAULT_PATH_PATTERN = /^(?!.*(?:^|\/)\.\.(?:\/|$))(?!\/)[^\\:*?"<>|]+(?:\/[^\\:*?"<>|]+)*$/;
const NOTE_EVENTS = new Set([
  'note:created',
  'note:modified',
  'note:opened',
  'note:renamed',
  'note:deleted',
]);

export interface ManifestIssue {
  path: string;
  message: string;
}

export type ManifestResult =
  { ok: true; manifest: PluginManifest } | { ok: false; issues: readonly ManifestIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(path: string, message: string): ManifestIssue {
  return { path, message };
}

function parsePermission(
  value: unknown,
  index: number,
  issues: ManifestIssue[],
): Permission | null {
  const path = `permissions[${index}]`;
  if (!isRecord(value) || typeof value.id !== 'string') {
    issues.push(issue(path, '权限必须包含 id'));
    return null;
  }
  switch (value.id) {
    case 'vault:read': {
      const folders = value.folders;
      if (folders === undefined) return { id: 'vault:read' };
      if (!Array.isArray(folders) || folders.length === 0) {
        issues.push(issue(`${path}.folders`, 'folders 必须是非空数组'));
        return null;
      }
      if (
        folders.some((folder) => typeof folder !== 'string' || !VAULT_PATH_PATTERN.test(folder))
      ) {
        issues.push(issue(`${path}.folders`, '文件夹路径无效'));
        return null;
      }
      return { id: 'vault:read', folders };
    }
    case 'vault:write':
    case 'ai:invoke':
    case 'ui:panel':
    case 'clipboard':
      return { id: value.id };
    case 'network': {
      const domains = value.domains;
      if (
        !Array.isArray(domains) ||
        domains.length === 0 ||
        domains.some((domain) => typeof domain !== 'string' || !DOMAIN_PATTERN.test(domain))
      ) {
        issues.push(issue(`${path}.domains`, 'network 必须声明有效域名'));
        return null;
      }
      return { id: 'network', domains };
    }
    default:
      issues.push(issue(`${path}.id`, `未知权限 ${value.id}`));
      return null;
  }
}

/** 按 preview v1 清单做结构校验。失败时不抛错，调用方可以跳过坏插件。 */
export function parseManifest(value: unknown): ManifestResult {
  const issues: ManifestIssue[] = [];
  if (!isRecord(value)) return { ok: false, issues: [issue('', '清单必须是对象')] };
  if (value.manifestVersion !== 1) issues.push(issue('manifestVersion', '必须为 1'));
  if (value.apiVersion !== 'preview-v1') issues.push(issue('apiVersion', '必须为 preview-v1'));
  if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) {
    issues.push(issue('id', 'id 只允许小写、数字、点和短横线'));
  }
  if (typeof value.name !== 'string' || value.name.length === 0) {
    issues.push(issue('name', '缺少名称'));
  }
  if (typeof value.version !== 'string' || !SEMVER_PATTERN.test(value.version)) {
    issues.push(issue('version', '版本必须是语义化版本'));
  }
  if (typeof value.minAppVersion !== 'string' || !SEMVER_PATTERN.test(value.minAppVersion)) {
    issues.push(issue('minAppVersion', '最低应用版本必须是语义化版本'));
  }
  if (typeof value.main !== 'string' || !MAIN_PATTERN.test(value.main)) {
    issues.push(issue('main', '入口必须是插件目录内的 .js 或 .mjs'));
  }
  let permissions: Permission[] | undefined;
  if (value.permissions !== undefined) {
    if (!Array.isArray(value.permissions)) {
      issues.push(issue('permissions', '权限必须是数组'));
    } else {
      permissions = [];
      for (const [index, entry] of value.permissions.entries()) {
        const permission = parsePermission(entry, index, issues);
        if (permission) permissions.push(permission);
      }
    }
  }
  if (isRecord(value.contributes) && value.contributes.events !== undefined) {
    const events = value.contributes.events;
    if (
      !Array.isArray(events) ||
      events.some((event) => typeof event !== 'string' || !NOTE_EVENTS.has(event))
    ) {
      issues.push(issue('contributes.events', '包含未知事件'));
    }
  }
  if (issues.length > 0 || typeof value.id !== 'string') return { ok: false, issues };
  const manifest: PluginManifest = {
    manifestVersion: 1,
    apiVersion: 'preview-v1',
    id: value.id,
    name: typeof value.name === 'string' ? value.name : value.id,
    version: typeof value.version === 'string' ? value.version : '0.0.0',
    minAppVersion: typeof value.minAppVersion === 'string' ? value.minAppVersion : '0.0.0',
    main: typeof value.main === 'string' ? value.main : 'main.js',
  };
  if (typeof value.description === 'string') manifest.description = value.description;
  if (typeof value.author === 'string' || isRecord(value.author)) {
    manifest.author = value.author as PluginManifest['author'];
  }
  if (permissions) manifest.permissions = permissions;
  if (isRecord(value.contributes))
    manifest.contributes = value.contributes as PluginManifest['contributes'];
  return { ok: true, manifest };
}

export function formatManifestIssues(issues: readonly ManifestIssue[]): string {
  return issues
    .map((item) => (item.path ? `${item.path}: ${item.message}` : item.message))
    .join('；');
}
