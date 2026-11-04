/**
 * 把主题偏好写到 `data-theme`。
 * `system` 跟随操作系统，并把解析后的 `light` 或 `dark` 写到属性上。
 */

export const THEME_ATTRIBUTE = "data-theme";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_QUERY = "(prefers-color-scheme: dark)";

function defaultRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.documentElement;
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia(THEME_QUERY).matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") return getSystemTheme();
  return preference;
}

/**
 * 把偏好应用到根节点。属性值始终是解析后的 `light` 或 `dark`，
 * 深色变量定义在 `[data-theme="dark"]`，浅色变量定义在 `:root`。
 */
export function applyTheme(
  preference: ThemePreference,
  root: HTMLElement | null = defaultRoot(),
): ResolvedTheme {
  const resolved = resolveTheme(preference);
  root?.setAttribute(THEME_ATTRIBUTE, resolved);
  return resolved;
}

export function readAppliedTheme(root: HTMLElement | null = defaultRoot()): ResolvedTheme | null {
  if (!root) return null;
  const value = root.getAttribute(THEME_ATTRIBUTE);
  if (value === "light" || value === "dark") return value;
  return null;
}

/** 操作系统浅色 / 深色变化时回调。返回取消订阅函数。 */
export function subscribeSystemTheme(onChange: (theme: ResolvedTheme) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const media = window.matchMedia(THEME_QUERY);
  const listener = (event: MediaQueryListEvent) => {
    onChange(event.matches ? "dark" : "light");
  };
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/**
 * 立即应用偏好。偏好为 `system` 时持续跟随系统，直到调用返回的函数。
 * 切换到手动主题前先调用上一次的取消函数。
 */
export function bindTheme(
  preference: ThemePreference,
  root: HTMLElement | null = defaultRoot(),
): () => void {
  applyTheme(preference, root);
  if (preference !== "system") return () => {};
  return subscribeSystemTheme(() => {
    applyTheme("system", root);
  });
}
