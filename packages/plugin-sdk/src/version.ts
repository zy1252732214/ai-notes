/**
 * 插件 API 的稳定性标记。
 * `preview` 表示 1.0 之前允许调整类型形状；宿主与插件必须同时升级。
 */
export const PLUGIN_API_STABILITY = "preview" as const;

/**
 * 当前插件 API 版本。出现在 manifest.apiVersion 和 RPC 信封的 version 字段。
 */
export const PLUGIN_API_VERSION = "preview-v1" as const;

/** postMessage RPC 的协议名，用来忽略页面里其他来源的消息。 */
export const RPC_PROTOCOL = "ai-notes.plugin-rpc" as const;

export type PluginApiVersion = typeof PLUGIN_API_VERSION;
