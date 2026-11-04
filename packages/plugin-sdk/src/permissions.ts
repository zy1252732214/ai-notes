/**
 * 插件权限。安装和升级时由用户确认，宿主按 granted_permissions 执行。
 * preview v1 不把 vault:write 限制到文件夹：写入就是整个 Vault。
 */
export interface VaultReadPermission {
  id: 'vault:read';
  /**
   * Vault 相对文件夹。省略或空数组表示整个库。
   * 只作用于读；不能用它缩小 vault:write。
   */
  folders?: readonly string[];
}

export interface VaultWritePermission {
  id: 'vault:write';
}

export interface AiInvokePermission {
  id: 'ai:invoke';
}

export interface NetworkPermission {
  id: 'network';
  /** 允许访问的主机名，例如 `api.example.com` 或 `*.example.com`。不含协议、端口和路径。 */
  domains: readonly string[];
}

export interface UiPanelPermission {
  id: 'ui:panel';
}

export interface ClipboardPermission {
  id: 'clipboard';
}

export type Permission =
  | VaultReadPermission
  | VaultWritePermission
  | AiInvokePermission
  | NetworkPermission
  | UiPanelPermission
  | ClipboardPermission;

export type PermissionId = Permission['id'];

export const PERMISSION_IDS = [
  'vault:read',
  'vault:write',
  'ai:invoke',
  'network',
  'ui:panel',
  'clipboard',
] as const satisfies readonly PermissionId[];

export function hasPermission(permissions: readonly Permission[], id: PermissionId): boolean {
  return permissions.some((permission) => permission.id === id);
}

export function findPermission<T extends PermissionId>(
  permissions: readonly Permission[],
  id: T,
): Extract<Permission, { id: T }> | undefined {
  return permissions.find(
    (permission): permission is Extract<Permission, { id: T }> => permission.id === id,
  );
}
