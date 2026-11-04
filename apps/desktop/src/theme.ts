import type { ThemeMode } from './store';

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme(mode: ThemeMode): 'light' | 'dark' {
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  return resolved;
}
