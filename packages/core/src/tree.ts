import { isHiddenPath, isMarkdownPath } from './paths.js';
import type { FsEntry, VaultNode } from './types.js';

function compareNodes(left: VaultNode, right: VaultNode): number {
  if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1;
  return left.name.localeCompare(right.name, 'zh-Hans', { numeric: true, sensitivity: 'base' });
}

function sortTree(nodes: VaultNode[]): void {
  nodes.sort(compareNodes);
  for (const node of nodes) sortTree(node.children);
}

export function buildFileTree(entries: readonly FsEntry[]): VaultNode[] {
  const directories = new Set<string>();
  const files = new Set<string>();

  const addParents = (path: string) => {
    let parent = path;
    while (parent.includes('/')) {
      parent = parent.slice(0, parent.lastIndexOf('/'));
      if (!parent || isHiddenPath(parent)) return;
      directories.add(parent);
    }
  };

  for (const entry of entries) {
    if (!entry.path || isHiddenPath(entry.path)) continue;
    if (entry.kind === 'directory') {
      directories.add(entry.path);
      addParents(entry.path);
      continue;
    }
    if (!isMarkdownPath(entry.path)) continue;
    files.add(entry.path);
    addParents(entry.path);
  }

  const nodes = new Map<string, VaultNode>();
  nodes.set('', { name: '', path: '', kind: 'directory', children: [] });

  for (const path of directories) {
    nodes.set(path, {
      name: path.slice(path.lastIndexOf('/') + 1),
      path,
      kind: 'directory',
      children: [],
    });
  }

  for (const path of directories) {
    const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    nodes.get(parentPath)?.children.push(nodes.get(path)!);
  }

  for (const path of files) {
    const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    nodes.get(parentPath)?.children.push({
      name: path.slice(path.lastIndexOf('/') + 1),
      path,
      kind: 'file',
      children: [],
    });
  }

  const roots = nodes.get('')?.children ?? [];
  sortTree(roots);
  return roots;
}

export function filterVaultTree(nodes: readonly VaultNode[], query: string): VaultNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...nodes];

  const visit = (node: VaultNode): VaultNode | null => {
    if (node.kind === 'directory' && node.name.toLowerCase().includes(needle)) {
      return node;
    }
    if (node.kind === 'file') {
      return node.name.toLowerCase().includes(needle) ? node : null;
    }
    const children = node.children.map(visit).filter((child): child is VaultNode => child !== null);
    if (children.length === 0) return null;
    return { ...node, children };
  };

  return nodes.map(visit).filter((node): node is VaultNode => node !== null);
}
