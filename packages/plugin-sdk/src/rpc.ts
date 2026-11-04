import type { ChatRequest, ChatResult, CompleteRequest, CompleteResult } from "./api/ai.ts";
import type { NetworkRequest, NetworkResponse } from "./api/network.ts";
import type { NoteEventType } from "./api/events.ts";
import type { NoteMetadata, VaultEntry } from "./api/vault.ts";
import type { SettingsField } from "./api/views.ts";
import type { JsonSchemaObject } from "./json-schema.ts";
import type { PluginErrorCode } from "./errors.ts";
import type { PermissionId } from "./permissions.ts";
import { PLUGIN_API_VERSION, RPC_PROTOCOL } from "./version.ts";

/**
 * 沙箱（iframe / Web Worker）和宿主之间的 postMessage 信封。
 * 函数、DOM 节点和 CodeMirror Extension 不能放进 payload。
 * 那些回调留在沙箱里，宿主用 HostToPlugin 请求把它们叫起来。
 */
export interface RpcErrorBody {
  code: PluginErrorCode;
  message: string;
  details?: unknown;
}

interface RpcEnvelopeBase {
  protocol: typeof RPC_PROTOCOL;
  version: typeof PLUGIN_API_VERSION;
  pluginId: string;
  /** 请求与响应用同一个 id。事件使用新的 id。 */
  id: string;
}

interface ViewSlotParams {
  id: string;
  title: string;
  icon?: string;
  entry?: string;
}

interface Registration {
  registrationId: string;
}

/**
 * 插件发往宿主的方法。permission 为 null 表示不需要额外权限。
 * `editor.registerExtension` 不在这张表里：Extension 不能跨越 postMessage。
 */
export interface PluginToHostMethods {
  "vault.read": { params: { path: string }; result: string };
  "vault.list": { params: { folder?: string; recursive?: boolean }; result: readonly VaultEntry[] };
  "vault.create": {
    params: { path: string; content: string; overwrite?: boolean };
    result: NoteMetadata;
  };
  "vault.modify": { params: { path: string; content: string }; result: NoteMetadata };
  "vault.delete": { params: { path: string }; result: null };
  "vault.rename": { params: { from: string; to: string }; result: null };
  "vault.metadata": { params: { path: string }; result: NoteMetadata };
  "commands.register": {
    params: { id: string; name: string; hotkey?: string; editorOnly?: boolean };
    result: Registration;
  };
  "commands.unregister": { params: { registrationId: string }; result: null };
  "views.registerSidebar": { params: ViewSlotParams; result: Registration };
  "views.registerTab": { params: ViewSlotParams; result: Registration };
  "views.registerStatusBar": {
    params: { id: string; text: string; tooltip?: string };
    result: Registration;
  };
  "views.registerSettings": {
    params: { id: string; title: string; entry?: string; fields?: readonly SettingsField[] };
    result: Registration;
  };
  "views.unregister": { params: { registrationId: string }; result: null };
  "views.setStatusBarText": { params: { id: string; text: string }; result: null };
  "editor.registerCodeBlockRenderer": {
    params: { id: string; language: string };
    result: Registration;
  };
  "editor.unregister": { params: { registrationId: string }; result: null };
  "editor.getActive": { params: Record<string, never>; result: { notePath: string } | null };
  "editor.getSelection": { params: Record<string, never>; result: string };
  "editor.getContent": { params: Record<string, never>; result: string };
  "editor.replaceSelection": { params: { text: string }; result: null };
  "editor.insertAtCursor": { params: { text: string }; result: null };
  "ai.chat": { params: ChatRequest; result: ChatResult };
  "ai.complete": { params: CompleteRequest; result: CompleteResult };
  "ai.registerTool": {
    params: { name: string; description: string; parameters: JsonSchemaObject };
    result: Registration;
  };
  "ai.unregisterTool": { params: { registrationId: string }; result: null };
  "events.subscribe": { params: { type: NoteEventType }; result: { subscriptionId: string } };
  "events.unsubscribe": { params: { subscriptionId: string }; result: null };
  "clipboard.read": { params: Record<string, never>; result: string };
  "clipboard.write": { params: { text: string }; result: null };
  "network.fetch": { params: NetworkRequest; result: NetworkResponse };
}

export type PluginToHostMethod = keyof PluginToHostMethods;

/** 宿主发往沙箱的调用。对应插件留在沙箱里的回调。 */
export interface HostToPluginMethods {
  "command.invoke": { params: { commandId: string }; result: null };
  "statusBar.click": { params: { itemId: string }; result: null };
  "editor.renderCodeBlock": {
    params: { language: string; source: string; notePath: string };
    result: { html: string };
  };
  "ai.tool.call": {
    params: { name: string; args: unknown; callId: string };
    result: unknown;
  };
}

export type HostToPluginMethod = keyof HostToPluginMethods;

export interface RpcEventParams {
  "note:created": { path: string };
  "note:modified": { path: string };
  "note:opened": { path: string };
  "note:renamed": { from: string; to: string };
  "note:deleted": { path: string };
  "lifecycle:unload": Record<string, never>;
}

export type RpcEventName = keyof RpcEventParams;

export const METHOD_PERMISSION = {
  "vault.read": "vault:read",
  "vault.list": "vault:read",
  "vault.metadata": "vault:read",
  "vault.create": "vault:write",
  "vault.modify": "vault:write",
  "vault.delete": "vault:write",
  "vault.rename": "vault:write",
  "commands.register": null,
  "commands.unregister": null,
  "views.registerSidebar": "ui:panel",
  "views.registerTab": "ui:panel",
  "views.registerStatusBar": "ui:panel",
  "views.registerSettings": "ui:panel",
  "views.unregister": "ui:panel",
  "views.setStatusBarText": "ui:panel",
  "editor.registerCodeBlockRenderer": null,
  "editor.unregister": null,
  "editor.getActive": "vault:read",
  "editor.getSelection": "vault:read",
  "editor.getContent": "vault:read",
  "editor.replaceSelection": "vault:write",
  "editor.insertAtCursor": "vault:write",
  "ai.chat": "ai:invoke",
  "ai.complete": "ai:invoke",
  "ai.registerTool": null,
  "ai.unregisterTool": null,
  "events.subscribe": null,
  "events.unsubscribe": null,
  "clipboard.read": "clipboard",
  "clipboard.write": "clipboard",
  "network.fetch": "network",
} as const satisfies Record<PluginToHostMethod, PermissionId | null>;

export type PluginRpcRequest = {
  [M in PluginToHostMethod]: RpcEnvelopeBase & {
    kind: "request";
    method: M;
    params: PluginToHostMethods[M]["params"];
  };
}[PluginToHostMethod];

export type HostRpcRequest = {
  [M in HostToPluginMethod]: RpcEnvelopeBase & {
    kind: "request";
    method: M;
    params: HostToPluginMethods[M]["params"];
  };
}[HostToPluginMethod];

export interface RpcResponse<TResult = unknown> extends RpcEnvelopeBase {
  kind: "response";
  result: TResult;
}

export type RpcEventMessage = {
  [E in RpcEventName]: RpcEnvelopeBase & {
    kind: "event";
    method: E;
    params: RpcEventParams[E];
  };
}[RpcEventName];

export interface RpcFailure extends RpcEnvelopeBase {
  kind: "error";
  error: RpcErrorBody;
}

export type RpcEnvelope = PluginRpcRequest | HostRpcRequest | RpcResponse | RpcEventMessage | RpcFailure;

/** 只检查信封形状，不校验 params 是否符合该方法。宿主仍要按方法做参数校验。 */
export interface RpcEnvelopeLoose {
  protocol: typeof RPC_PROTOCOL;
  version: typeof PLUGIN_API_VERSION;
  pluginId: string;
  id: string;
  kind: "request" | "response" | "event" | "error";
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: RpcErrorBody;
}

const ERROR_CODES: readonly PluginErrorCode[] = [
  "permission_denied",
  "not_found",
  "already_exists",
  "invalid_request",
  "invalid_params",
  "internal",
  "cancelled",
  "not_supported",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRpcErrorBody(value: unknown): value is RpcErrorBody {
  if (!isRecord(value) || !Object.hasOwn(value, "code") || !Object.hasOwn(value, "message")) return false;
  const code = value["code"];
  return typeof code === "string" && ERROR_CODES.includes(code as PluginErrorCode) && typeof value["message"] === "string";
}

export function isRpcEnvelope(value: unknown): value is RpcEnvelopeLoose {
  if (!isRecord(value)) return false;
  if (value["protocol"] !== RPC_PROTOCOL || value["version"] !== PLUGIN_API_VERSION) return false;
  if (typeof value["pluginId"] !== "string" || value["pluginId"].length === 0) return false;
  if (typeof value["id"] !== "string" || value["id"].length === 0) return false;
  const kind = value["kind"];
  if (kind === "response") return Object.hasOwn(value, "result");
  if (kind === "error") return isRpcErrorBody(value["error"]);
  if (kind === "request" || kind === "event") {
    return typeof value["method"] === "string" && Object.hasOwn(value, "params");
  }
  return false;
}

export function isPluginRpcRequest(value: unknown): value is PluginRpcRequest {
  return (
    isRpcEnvelope(value) &&
    value.kind === "request" &&
    typeof value.method === "string" &&
    Object.hasOwn(METHOD_PERMISSION, value.method)
  );
}

export function createRpcId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  return `rpc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createRpcRequest<M extends PluginToHostMethod>(
  pluginId: string,
  id: string,
  method: M,
  params: PluginToHostMethods[M]["params"],
): Extract<PluginRpcRequest, { method: M }> {
  return {
    protocol: RPC_PROTOCOL,
    version: PLUGIN_API_VERSION,
    pluginId,
    id,
    kind: "request",
    method,
    params,
  } as Extract<PluginRpcRequest, { method: M }>;
}

export function createRpcResponse<TResult>(pluginId: string, id: string, result: TResult): RpcResponse<TResult> {
  return {
    protocol: RPC_PROTOCOL,
    version: PLUGIN_API_VERSION,
    pluginId,
    id,
    kind: "response",
    result,
  };
}

export function createRpcError(pluginId: string, id: string, error: RpcErrorBody): RpcFailure {
  return {
    protocol: RPC_PROTOCOL,
    version: PLUGIN_API_VERSION,
    pluginId,
    id,
    kind: "error",
    error,
  };
}

export function createRpcEvent<E extends RpcEventName>(
  pluginId: string,
  id: string,
  method: E,
  params: RpcEventParams[E],
): Extract<RpcEventMessage, { method: E }> {
  return {
    protocol: RPC_PROTOCOL,
    version: PLUGIN_API_VERSION,
    pluginId,
    id,
    kind: "event",
    method,
    params,
  } as Extract<RpcEventMessage, { method: E }>;
}
