/**
 * AI 服务层占位。
 * 职责：检索增强、记忆卡片、模型路由（OpenAI 兼容 / Claude / Ollama）。
 * 实现归后端工程师。回答必须能附引用。
 */
import { packageId as corePackageId } from '@ai-notes/core';
import { packageId as indexerPackageId } from '@ai-notes/indexer';

export const packageId = '@ai-notes/ai' as const;

/** 脚手架用的依赖清单，不是产品 API。实现本包时可以删掉，并同步改测试。 */
export const workspaceDependencies = [corePackageId, indexerPackageId] as const;
