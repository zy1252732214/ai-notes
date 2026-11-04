export { packageId, PLUGIN_API_STABILITY, PLUGIN_API_VERSION, RPC_PROTOCOL } from './version.js';
export type { PluginApiVersion } from './version.js';

export { DisposableStore, disposable } from './disposable.js';
export type { Disposable } from './disposable.js';

export { PluginApiError } from './errors.js';
export type { PluginErrorCode } from './errors.js';

export { isPathWithinFolders, normalizeVaultPath } from './paths.js';

export { PERMISSION_IDS, findPermission, hasPermission } from './permissions.js';
export type {
  AiInvokePermission,
  ClipboardPermission,
  NetworkPermission,
  Permission,
  PermissionId,
  UiPanelPermission,
  VaultReadPermission,
  VaultWritePermission,
} from './permissions.js';

export type {
  JsonSchema,
  JsonSchemaArray,
  JsonSchemaObject,
  JsonSchemaScalar,
} from './json-schema.js';

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
} from './manifest.js';

export type { AppApi } from './api/app.js';

export type {
  NoteMetadata,
  VaultEntry,
  VaultEntryKind,
  VaultListOptions,
  VaultWriteOptions,
  VaultApi,
} from './api/vault.js';

export { formatHotkey, isHotkeyModifier, parseHotkey, HOTKEY_MODIFIERS } from './api/commands.js';
export type { Command, CommandsApi, Hotkey, HotkeyModifier } from './api/commands.js';

export type {
  SettingsField,
  SettingsTab,
  SidebarPanel,
  StatusBarItem,
  TabView,
  ViewsApi,
} from './api/views.js';

export type {
  CodeBlockContext,
  CodeBlockRenderResult,
  CodeBlockRenderer,
  CodeMirrorExtension,
  EditorApi,
  EditorExtensionRegistration,
  EditorHandle,
} from './api/editor.js';

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
} from './api/ai.js';

export { NOTE_EVENT_TYPES } from './api/events.js';
export type {
  EventsApi,
  NoteCreatedEvent,
  NoteDeletedEvent,
  NoteEvent,
  NoteEventType,
  NoteModifiedEvent,
  NoteOpenedEvent,
  NoteRenamedEvent,
} from './api/events.js';

export type { ClipboardApi } from './api/clipboard.js';
export type { NetworkApi, NetworkMethod, NetworkRequest, NetworkResponse } from './api/network.js';

export { definePlugin, isPluginConstructor, Plugin } from './plugin.js';
export type {
  PluginConstructor,
  PluginContext,
  PluginDefinition,
  PluginModuleExport,
} from './plugin.js';

export {
  METHOD_PERMISSION,
  createRpcError,
  createRpcEvent,
  createRpcId,
  createRpcRequest,
  createRpcResponse,
  isPluginRpcRequest,
  isRpcEnvelope,
} from './rpc.js';
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
} from './rpc.js';
