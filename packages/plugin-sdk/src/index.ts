export { PLUGIN_API_STABILITY, PLUGIN_API_VERSION, RPC_PROTOCOL } from "./version.ts";
export type { PluginApiVersion } from "./version.ts";

export { DisposableStore, disposable } from "./disposable.ts";
export type { Disposable } from "./disposable.ts";

export { PluginApiError } from "./errors.ts";
export type { PluginErrorCode } from "./errors.ts";

export { isPathWithinFolders, normalizeVaultPath } from "./paths.ts";

export { PERMISSION_IDS, findPermission, hasPermission } from "./permissions.ts";
export type {
  AiInvokePermission,
  ClipboardPermission,
  NetworkPermission,
  Permission,
  PermissionId,
  UiPanelPermission,
  VaultReadPermission,
  VaultWritePermission,
} from "./permissions.ts";

export type { JsonSchema, JsonSchemaArray, JsonSchemaObject, JsonSchemaScalar } from "./json-schema.ts";

export type {
  AiToolContribution,
  CodeBlockRendererContribution,
  CommandContribution,
  EditorContribution,
  EditorContributionKind,
  ExporterContribution,
  ImporterContribution,
  PluginAuthor,
  PluginContributes,
  PluginManifest,
  ViewContribution,
  ViewContributionType,
} from "./manifest.ts";

export type { AppApi } from "./api/app.ts";

export type { NoteMetadata, VaultEntry, VaultEntryKind, VaultListOptions, VaultWriteOptions, VaultApi } from "./api/vault.ts";

export { formatHotkey, isHotkeyModifier, parseHotkey, HOTKEY_MODIFIERS } from "./api/commands.ts";
export type { Command, CommandsApi, Hotkey, HotkeyModifier } from "./api/commands.ts";

export type { SettingsField, SettingsTab, SidebarPanel, StatusBarItem, TabView, ViewsApi } from "./api/views.ts";

export type {
  CodeBlockContext,
  CodeBlockRenderResult,
  CodeBlockRenderer,
  CodeMirrorExtension,
  EditorApi,
  EditorExtensionRegistration,
  EditorHandle,
} from "./api/editor.ts";

export type {
  AiApi,
  AiTool,
  AiToolContext,
  ChatMessage,
  ChatRequest,
  ChatResult,
  ChatRole,
  Citation,
  CompleteRequest,
  CompleteResult,
} from "./api/ai.ts";

export { NOTE_EVENT_TYPES } from "./api/events.ts";
export type {
  EventsApi,
  NoteCreatedEvent,
  NoteDeletedEvent,
  NoteEvent,
  NoteEventType,
  NoteModifiedEvent,
  NoteOpenedEvent,
  NoteRenamedEvent,
} from "./api/events.ts";

export type { ClipboardApi } from "./api/clipboard.ts";
export type { NetworkApi, NetworkMethod, NetworkRequest, NetworkResponse } from "./api/network.ts";

export { definePlugin, isPluginConstructor, Plugin } from "./plugin.ts";
export type { PluginConstructor, PluginContext, PluginDefinition, PluginModuleExport } from "./plugin.ts";

export {
  METHOD_PERMISSION,
  createRpcError,
  createRpcEvent,
  createRpcId,
  createRpcRequest,
  createRpcResponse,
  isPluginRpcRequest,
  isRpcEnvelope,
} from "./rpc.ts";
export type {
  HostRpcRequest,
  HostToPluginMethod,
  HostToPluginMethods,
  PluginRpcRequest,
  PluginToHostMethod,
  PluginToHostMethods,
  RpcEnvelope,
  RpcEnvelopeLoose,
  RpcErrorBody,
  RpcEventMessage,
  RpcEventName,
  RpcEventParams,
  RpcFailure,
  RpcResponse,
} from "./rpc.ts";
