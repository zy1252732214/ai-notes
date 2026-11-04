export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function folderName(root: string): string {
  const parts = root.split(/[/\\]/).filter(Boolean);
  return parts.at(-1) ?? 'Vault';
}
