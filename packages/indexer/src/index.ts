/**
 * 本地索引占位。
 * 职责：分块、FTS5 全文索引、sqlite-vec 向量索引。索引可从 Markdown 重建。
 * 实现归后端工程师。
 */
import { packageId as corePackageId } from '@ai-notes/core';

export const packageId = '@ai-notes/indexer' as const;

/** 脚手架用的依赖清单，不是产品 API。实现本包时可以删掉，并同步改测试。 */
export const workspaceDependencies = [corePackageId] as const;
