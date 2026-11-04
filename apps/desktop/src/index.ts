/**
 * 桌面壳占位。前端工程师会用 Tauri 2 + Vite + React 替换本包。
 * 在那之前不要添加 src-tauri，发布流水线会因此缺少 tauri.conf.json 而停止。
 */
import { packageId as aiPackageId } from '@ai-notes/ai';
import { packageId as corePackageId } from '@ai-notes/core';
import { packageId as editorPackageId } from '@ai-notes/editor';
import { packageId as indexerPackageId } from '@ai-notes/indexer';
import { packageId as pluginHostPackageId } from '@ai-notes/plugin-host';
import { packageId as pluginSdkPackageId } from '@ai-notes/plugin-sdk';
import { packageId as uiPackageId } from '@ai-notes/ui';

export const packageId = '@ai-notes/desktop' as const;

export const runtime = 'tauri-2' as const;

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
