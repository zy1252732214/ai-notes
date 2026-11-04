/**
 * 插件宿主占位。
 * 职责：加载、沙箱（iframe / Worker）、权限、postMessage RPC。
 * 实现归前端工程师。
 */
import { packageId as corePackageId } from '@ai-notes/core';
import { packageId as pluginSdkPackageId } from '@ai-notes/plugin-sdk';

export const packageId = '@ai-notes/plugin-host' as const;

/** 脚手架用的依赖清单，不是产品 API。实现本包时可以删掉，并同步改测试。 */
export const workspaceDependencies = [corePackageId, pluginSdkPackageId] as const;
