import {
  METHOD_PERMISSION,
  findPermission,
  isPathWithinFolders,
  type Permission,
  type PluginRpcRequest,
  type PluginToHostMethod,
} from '@ai-notes/plugin-sdk';

export interface AuthorizeContext {
  activeNotePath?: string | null;
}

export type AuthorizeDecision =
  | { ok: true }
  | {
      ok: false;
      code: 'permission_denied' | 'invalid_params' | 'invalid_request';
      message: string;
    };

function deny(message: string): AuthorizeDecision {
  return { ok: false, code: 'permission_denied', message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(params: unknown, key: string): string | undefined {
  if (!isRecord(params)) return undefined;
  const value = params[key];
  return typeof value === 'string' ? value : undefined;
}

/** 这次调用会读到的笔记路径。空数组表示没有具体路径（例如列出整个库）。 */
function pathsFor(request: PluginRpcRequest, context: AuthorizeContext): string[] | null {
  switch (request.method) {
    case 'vault.read':
    case 'vault.metadata':
    case 'vault.delete':
    case 'vault.create':
    case 'vault.modify':
      return [readString(request.params, 'path') ?? ''];
    case 'vault.list':
      return [readString(request.params, 'folder') ?? ''];
    case 'vault.rename':
      return [readString(request.params, 'from') ?? '', readString(request.params, 'to') ?? ''];
    case 'editor.getActive':
    case 'editor.getSelection':
    case 'editor.getContent':
    case 'editor.replaceSelection':
    case 'editor.insertAtCursor':
      return context.activeNotePath ? [context.activeNotePath] : [];
    default:
      return null;
  }
}

function networkHost(params: unknown): string | null {
  const urlText = readString(params, 'url');
  if (!urlText) return null;
  const Url = (globalThis as { URL?: new (input: string) => { hostname: string } }).URL;
  if (!Url) return null;
  try {
    return new Url(urlText).hostname;
  } catch {
    return null;
  }
}

export function hostAllowed(hostname: string, domains: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return domains.some((domain) => {
    const rule = domain.toLowerCase();
    if (rule.startsWith('*.')) {
      const suffix = rule.slice(2);
      return suffix.length > 0 && host.endsWith(`.${suffix}`);
    }
    return host === rule;
  });
}

/**
 * 按 manifest 里授予的权限决定是否执行这次 RPC。
 * 没声明的权限直接拒绝，处理函数不会被调用。
 */
export function authorize(
  permissions: readonly Permission[],
  request: PluginRpcRequest,
  context: AuthorizeContext = {},
): AuthorizeDecision {
  const method = request.method;
  if (!Object.hasOwn(METHOD_PERMISSION, method)) {
    return { ok: false, code: 'invalid_request', message: `未知方法 ${method}` };
  }
  const required = METHOD_PERMISSION[method as PluginToHostMethod];
  if (required !== null && !permissions.some((permission) => permission.id === required)) {
    return deny(`缺少权限 ${required}`);
  }

  if (required === 'vault:read') {
    const scoped = findPermission(permissions, 'vault:read');
    const folders = scoped?.folders;
    const paths = pathsFor(request, context);
    if (paths) {
      if (request.method === 'vault.list' && paths[0] === '' && folders && folders.length > 0) {
        return deny('vault:read 被限制在指定文件夹，不能列出整个库');
      }
      for (const path of paths) {
        if (!path) continue;
        try {
          if (!isPathWithinFolders(path, folders)) return deny(`路径超出 vault:read 范围：${path}`);
        } catch {
          return { ok: false, code: 'invalid_params', message: `路径无效：${path}` };
        }
      }
    }
  }

  if (required === 'network') {
    const declared = findPermission(permissions, 'network');
    const hostname = networkHost(request.params);
    if (!hostname) return { ok: false, code: 'invalid_params', message: '网络请求缺少有效 URL' };
    if (!declared || !hostAllowed(hostname, declared.domains)) {
      return deny(`域名不在 network 声明里：${hostname}`);
    }
  }

  return { ok: true };
}
