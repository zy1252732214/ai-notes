import { packageId as corePackageId } from '@ai-notes/core';

export const packageId = '@ai-notes/editor' as const;

/** 脚手架用的依赖清单，不是产品 API。 */
export const workspaceDependencies = [corePackageId] as const;

export { MarkdownEditor } from './MarkdownEditor.js';
export type { EditorCursor, EditorReveal, MarkdownEditorProps } from './MarkdownEditor.js';
export { wikilinkAt } from './wikilink.js';
