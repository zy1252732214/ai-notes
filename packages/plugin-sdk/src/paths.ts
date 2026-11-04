import { PluginApiError } from "./errors.ts";

const RELATIVE_PATH = /^(?!.*(?:^|\/)\.\.(?:\/|$))(?!\/)[^\\:*?"<>|]+(?:\/[^\\:*?"<>|]+)*$/;

/**
 * 规范化 Vault 相对路径：反斜杠转成 `/`，去掉 `./` 前缀和末尾斜杠。
 * 拒绝绝对路径、空段和 `..`。
 */
export function normalizeVaultPath(path: string): string {
  const trimmed = path.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (trimmed.length === 0 || !RELATIVE_PATH.test(trimmed)) {
    throw new PluginApiError("invalid_params", `Invalid vault path: ${path}`);
  }
  return trimmed;
}

/**
 * `folders` 省略或为空表示整个 Vault。
 * 否则路径必须等于某个文件夹，或落在其子路径下（`notes` 不会匹配 `notes-private`）。
 */
export function isPathWithinFolders(path: string, folders: readonly string[] | undefined): boolean {
  if (!folders || folders.length === 0) return true;
  const normalized = normalizeVaultPath(path);
  return folders.some((folder) => {
    const root = normalizeVaultPath(folder);
    return normalized === root || normalized.startsWith(`${root}/`);
  });
}
