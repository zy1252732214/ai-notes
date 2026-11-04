/**
 * 编辑器占位。
 * 职责：CodeMirror 6 扩展（双链、标签、块引用，扩展点开放给插件）。
 * 实现归前端工程师。
 */
import { packageId as corePackageId } from '@ai-notes/core';

export const packageId = '@ai-notes/editor' as const;

/** 脚手架用的依赖清单，不是产品 API。实现本包时可以删掉，并同步改测试。 */
export const workspaceDependencies = [corePackageId] as const;
