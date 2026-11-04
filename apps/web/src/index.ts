/**
 * Web 入口占位。与桌面端共用 packages 里的 UI 与内核。
 * 前端工程师后续补上 Vite + React 入口；浏览器存储走 File System Access API，降级 IndexedDB。
 */
import { packageId as aiPackageId } from '@ai-notes/ai';
import { packageId as corePackageId } from '@ai-notes/core';
import { packageId as editorPackageId } from '@ai-notes/editor';
import { packageId as indexerPackageId } from '@ai-notes/indexer';
import { packageId as pluginHostPackageId } from '@ai-notes/plugin-host';
import { packageId as pluginSdkPackageId } from '@ai-notes/plugin-sdk';
import { packageId as uiPackageId } from '@ai-notes/ui';

export const packageId = '@ai-notes/web' as const;

export const runtime = 'browser' as const;

/** 脚手架用的依赖清单，不是产品 API。实现本包时可以删掉，并同步改测试。 */
export const workspaceDependencies = [
  aiPackageId,
  corePackageId,
  editorPackageId,
  indexerPackageId,
  pluginHostPackageId,
  pluginSdkPackageId,
  uiPackageId,
] as const;
