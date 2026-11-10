import type { VaultNode } from '@ai-notes/core';
import type { NoteName } from './fuzzy.js';

export function listNoteFiles(nodes: readonly VaultNode[]): NoteName[] {
  const files: NoteName[] = [];
  const visit = (node: VaultNode) => {
    if (node.kind === 'file') files.push({ path: node.path, name: node.name });
    else node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return files;
}
