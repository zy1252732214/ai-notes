import type { AppApi } from './api/app.js';
import type { DisposableStore } from './disposable.js';
import type { PluginManifest } from './manifest.js';
import type { Permission } from './permissions.js';
import type { PluginApiVersion } from './version.js';

/**
 * 传给 onload / onunload 的上下文。
 * 宿主创建沙箱后构造这份对象：permissions 是用户已经同意的子集。
 */
export interface PluginContext {
  readonly apiVersion: PluginApiVersion;
  readonly manifest: PluginManifest;
  readonly permissions: readonly Permission[];
  readonly app: AppApi;
  /**
   * onload 里登记的命令、视图和订阅放这里。
   * 宿主在 onunload 返回之后调用 dispose，重复 dispose 是安全的。
   */
  readonly subscriptions: DisposableStore;
}

/**
 * 插件基类。默认导出这个类的构造函数，宿主会 `new Plugin(ctx)`。
 *
 * 生命周期：校验 manifest → 创建 iframe 或 Worker → 构造插件 → onload →
 * （禁用或卸载时）onunload → 释放 subscriptions → 销毁沙箱。
 */
export abstract class Plugin {
  protected readonly ctx: PluginContext;

  constructor(ctx: PluginContext) {
    this.ctx = ctx;
  }

  abstract onload(): void | Promise<void>;

  onunload(): void | Promise<void> {
    // 默认什么都不做。宿主在此之后释放 ctx.subscriptions。
  }
}

/** 函数式插件。适合没有内部状态、只在 onload 里注册扩展点的插件。 */
export interface PluginDefinition {
  onload(ctx: PluginContext): void | Promise<void>;
  onunload?(ctx: PluginContext): void | Promise<void>;
}

export function definePlugin(definition: PluginDefinition): PluginDefinition {
  return definition;
}

export type PluginConstructor = new (ctx: PluginContext) => Plugin;

/** 插件入口的默认导出：类，或者 definePlugin 的返回值。 */
export type PluginModuleExport = PluginConstructor | PluginDefinition;

export function isPluginConstructor(value: PluginModuleExport): value is PluginConstructor {
  return typeof value === 'function';
}
