/**
 * 插件宿主：从 `.ainotes/plugins` 发现插件，在沙箱里跑，并按清单权限拦截 RPC。
 */
import { packageId as corePackageId } from '@ai-notes/core';
import { packageId as pluginSdkPackageId } from '@ai-notes/plugin-sdk';

export const packageId = '@ai-notes/plugin-host' as const;

/** 供依赖方向测试使用，不是插件 API。 */
export const workspaceDependencies = [corePackageId, pluginSdkPackageId] as const;

export { authorize, hostAllowed } from './authorize.js';
export type { AuthorizeContext, AuthorizeDecision } from './authorize.js';
export { PluginController } from './controller.js';
export type {
  PluginCommandSnapshot,
  PluginItemSnapshot,
  PluginPanelSnapshot,
  PluginSnapshot,
} from './controller.js';
export {
  discoverPlugins,
  installPluginFiles,
  readDisabledIds,
  writeDisabledIds,
} from './discover.js';
export type { DiscoveredPlugin } from './discover.js';
export { formatManifestIssues, parseManifest } from './manifest.js';
export type { ManifestIssue, ManifestResult } from './manifest.js';
export { IFRAME_SANDBOX, buildSandboxSrcdoc } from './sandbox.js';
export { SANDBOX_SDK_SOURCE } from './sandboxSource.js';
export { PluginSession } from './session.js';
export type { RegisteredCommand, RegisteredPanel } from './session.js';
export { unavailable } from './services.js';
export type { ActiveNote, PluginServices } from './services.js';
export { MemoryPluginStorage, normalizeMetaPath } from './storage.js';
export type { PluginStorage } from './storage.js';
