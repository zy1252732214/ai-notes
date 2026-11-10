# API reference

`@ai-notes/plugin-sdk` is types, the manifest schema, and the RPC envelope. It does not read files or open a database. `@ai-notes/plugin-host` is the implementation the desktop app uses.

Import from `@ai-notes/plugin-sdk`. This page matches `packages/plugin-sdk/src/index.ts`. Runtime gaps in the desktop shell are listed in [debugging](debugging.md), not repeated on every method.

## Versions

| Export                 | Value                    |
| ---------------------- | ------------------------ |
| `packageId`            | `"@ai-notes/plugin-sdk"` |
| `PLUGIN_API_VERSION`   | `"preview-v1"`           |
| `PLUGIN_API_STABILITY` | `"preview"`              |
| `RPC_PROTOCOL`         | `"ai-notes.plugin-rpc"`  |

`PluginApiVersion` is the type of `PLUGIN_API_VERSION`.

## Plugin entry

```ts
function definePlugin(definition: PluginDefinition): PluginDefinition;

interface PluginDefinition {
  onload(ctx: PluginContext): void | Promise<void>;
  onunload?(ctx: PluginContext): void | Promise<void>;
}

abstract class Plugin {
  protected readonly ctx: PluginContext;
  constructor(ctx: PluginContext);
  abstract onload(): void | Promise<void>;
  onunload(): void | Promise<void>;
}

function isPluginConstructor(value: PluginModuleExport): value is PluginConstructor;
```

`PluginContext`:

| Field           |                                                    |
| --------------- | -------------------------------------------------- |
| `apiVersion`    | `"preview-v1"`                                     |
| `manifest`      | The parsed manifest                                |
| `permissions`   | The subset the user granted                        |
| `app`           | The only way to reach the vault, editor, and model |
| `subscriptions` | A `DisposableStore`. Add every registration here   |

`Disposable` is `{ dispose(): void }`. `disposable(fn)` ignores a second call. `DisposableStore.add` returns the same object; `dispose` runs each item once and is itself safe to repeat. If the store is already disposed, `add` disposes the new item immediately.

## Permissions

```ts
const PERMISSION_IDS: readonly PermissionId[];
function hasPermission(permissions: readonly Permission[], id: PermissionId): boolean;
function findPermission<T extends PermissionId>(
  permissions: readonly Permission[],
  id: T,
): Extract<Permission, { id: T }> | undefined;
```

`Permission` is one of `VaultReadPermission` (`folders?`), `VaultWritePermission`, `AiInvokePermission`, `NetworkPermission` (`domains`), `UiPanelPermission`, `ClipboardPermission`. The id strings are `vault:read`, `vault:write`, `ai:invoke`, `network`, `ui:panel`, `clipboard`.

```ts
function normalizeVaultPath(path: string): string;
function isPathWithinFolders(path: string, folders: readonly string[] | undefined): boolean;
```

`normalizeVaultPath` turns `\` into `/`, strips a leading `./` and trailing slashes, and throws `PluginApiError('invalid_params')` for an empty path, an absolute path, or `..`. `isPathWithinFolders` is true for the whole vault when `folders` is missing or empty.

## `app.vault`

Paths are vault-relative, `/`-separated, not absolute, and without `..`. Reads need `vault:read`. Writes need `vault:write`.

| Method                            | Returns                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| `read(path)`                      | Markdown source, `Promise<string>`                                                                 |
| `list(options?)`                  | `VaultEntry[]`. `options.folder` defaults to the root. `options.recursive` defaults to false       |
| `create(path, content, options?)` | `NoteMetadata`. Parents are created. `options.overwrite` defaults to false; an existing file fails |
| `modify(path, content)`           | Replaces the whole file. `NoteMetadata`                                                            |
| `delete(path)`                    | `Promise<void>`                                                                                    |
| `rename(from, to)`                | `Promise<void>`. The host updates wikilinks                                                        |
| `getMetadata(path)`               | `NoteMetadata` without the body                                                                    |
| `search(query, options?)`         | `VaultSearchHit[]`                                                                                 |

`VaultEntry` is `{ path, name, kind }` with `kind` of `note`, `folder`, or `attachment`.

`NoteMetadata` is `{ path, title, createdAt, updatedAt, size, frontmatter, tags, links }`. Timestamps are ISO-8601 UTC. `tags` have no leading `#`. `links` are the targets as written in the note. `size` is bytes.

### `vault.search`

```ts
search(query: string, options?: { limit?: number }): Promise<readonly VaultSearchHit[]>;
```

`VaultSearchHit`:

| Field                      |                                                                              |
| -------------------------- | ---------------------------------------------------------------------------- |
| `path`                     | Vault-relative note                                                          |
| `title`                    | Note title                                                                   |
| `headingPath`              | Heading trail joined with `/`                                                |
| `startOffset`, `endOffset` | Offsets into the Markdown source                                             |
| `snippet`                  | Plain text. The index's `<b>` marks are stripped before the plugin sees them |

The desktop shell uses limit **8** when `limit` is missing, not an integer, or below 1, and clamps it to **20**. Keyword search always runs. Vector distance is included only when the user has set an embedding model; otherwise the hits match full-text search. A `vault:read` permission with `folders` drops hits outside those folders. The plugin does not pass an embedding itself.

## `app.commands`

```ts
commands.register(command: Command): Disposable;

interface Command {
  id: string; // prefix with the plugin id: "word-count.show"
  name: string;
  hotkey?: Hotkey | string;
  callback?: () => void | Promise<void>;
  editorCallback?: (editor: EditorHandle) => void | Promise<void>;
}
```

`Hotkey` is `{ modifiers, key }`. Modifiers are `Mod`, `Ctrl`, `Alt`, `Shift`, `Meta`. `Mod` is Command on macOS and Ctrl elsewhere. `parseHotkey("Mod+Alt+W")`, `formatHotkey`, `isHotkeyModifier`, and `HOTKEY_MODIFIERS` are exported. `editorCallback` is preferred over `callback` when both are set; the sandbox client today invokes `callback`.

## `app.views`

All four registrations need `ui:panel`. The plugin does not receive the host DOM. `entry` is an optional HTML path inside the plugin folder; omit it and the host shows the plugin iframe.

| Method                                                    |                                                                             |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| `registerSidebarPanel({ id, title, icon?, entry? })`      | Right-hand tab                                                              |
| `registerTabView({ id, title, icon?, entry? })`           | Same shape as a sidebar panel                                               |
| `registerStatusBarItem({ id, text, tooltip?, onClick? })` | Typed. Not drawn in 0.1.0                                                   |
| `registerSettingsTab({ id, title, entry?, fields? })`     | `fields` are `string`, `boolean`, `number`, or `select`. Not drawn in 0.1.0 |
| `setStatusBarText(id, text)`                              | Typed. Not drawn in 0.1.0                                                   |

## `app.editor`

```ts
getActiveEditor(): Promise<EditorHandle | null>;

interface EditorHandle {
  readonly notePath: string;
  getSelection(): Promise<string>;
  getContent(): Promise<string>;
  replaceSelection(text: string): Promise<void>; // vault:write
  insertAtCursor(text: string): Promise<void>; // vault:write
}
```

Reading the handle needs `vault:read`. In the current sandbox the resolved value only has `notePath`. Check `typeof editor.getContent === "function"` before calling it.

`registerExtension({ id, extension })` takes a CodeMirror extension. The SDK types it as an opaque object so the package does not depend on `@codemirror/state`. Sandbox plugins cannot send it. Use `registerCodeBlockRenderer({ id, language, render })`. `render` receives the fence source and `{ notePath, language }` and returns `{ html }`. The host is expected to sanitize the HTML before inserting it. The desktop shell does not call renderers yet.

## `app.ai`

Needs `ai:invoke` for `chat` and `complete`. Registering a tool does not.

```ts
chat(request: ChatRequest): Promise<ChatResult>;
complete(request: CompleteRequest): Promise<CompleteResult>;
registerTool(tool: AiTool): Disposable;
```

`ChatRequest` is `{ messages, notePath?, retrieve? }`. `retrieve` defaults to true in the type's comment: the host should search and ask the model to cite. `ChatResult` is `{ message, citations, model, provider }`. `Citation` is `{ notePath, chunkId?, headingPath?, startOffset?, endOffset?, quote? }`.

`CompleteRequest` is `{ prompt, notePath?, retrieve? }`. `CompleteResult` is `{ text, citations, model, provider }`.

`AiTool` is `{ name, description, parameters, handler? }`. `parameters` is a small JSON Schema: `JsonSchemaObject`, `JsonSchemaScalar`, or `JsonSchemaArray` (`type` plus optional `properties`, `required`, `items`, `enum`, `description`). The handler stays in the plugin. The host would call it with `ai.tool.call`. That callback is not wired in the desktop shell yet, and `chat` / `complete` currently throw before a model is contacted.

## `app.events`

```ts
subscribe(type, handler): Disposable;
unsubscribe(type, handler): void; // same-process only; sandboxed code should dispose the subscription
```

`NOTE_EVENT_TYPES` is the list. Payloads:

| Type            | Fields       |
| --------------- | ------------ |
| `note:created`  | `path`       |
| `note:modified` | `path`       |
| `note:opened`   | `path`       |
| `note:renamed`  | `from`, `to` |
| `note:deleted`  | `path`       |

Each event also has `type`.

## `app.clipboard` and `app.network`

```ts
clipboard.readText(): Promise<string>;
clipboard.writeText(text: string): Promise<void>;

network.fetch(request: NetworkRequest): Promise<NetworkResponse>;
```

`NetworkRequest` is `{ url, method?, headers?, body? }`. Methods are `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. `body` is text. `NetworkResponse` is `{ status, headers, body }`. The hostname must match a declared domain. The plugin has no raw socket.

## Errors

```ts
class PluginApiError extends Error {
  readonly code: PluginErrorCode;
  readonly details: unknown;
}
```

`PluginErrorCode`: `permission_denied`, `not_found`, `already_exists`, `invalid_request`, `invalid_params`, `internal`, `cancelled`, `not_supported`.

## RPC

Sandboxed plugins do not call these helpers. They are for a host. The envelope is:

```ts
interface RpcEnvelopeLoose {
  protocol: 'ai-notes.plugin-rpc';
  version: 'preview-v1';
  pluginId: string;
  id: string;
  kind: 'request' | 'response' | 'event' | 'error';
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: PluginErrorCode; message: string; details?: unknown };
}
```

`kind: "request"` from the plugin uses a method such as `vault.search`. The response uses the same `id`. Note events use `kind: "event"`. Functions are not put in `postMessage`. The host calls back with `command.invoke`, `statusBar.click`, `editor.renderCodeBlock`, and `ai.tool.call`.

`METHOD_PERMISSION` maps every plugin-to-host method to a permission id or `null`.

| Method                                                                                                                                                                                | Permission    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `vault.read`, `vault.list`, `vault.metadata`, `vault.search`                                                                                                                          | `vault:read`  |
| `vault.create`, `vault.modify`, `vault.delete`, `vault.rename`                                                                                                                        | `vault:write` |
| `editor.getActive`, `editor.getSelection`, `editor.getContent`                                                                                                                        | `vault:read`  |
| `editor.replaceSelection`, `editor.insertAtCursor`                                                                                                                                    | `vault:write` |
| `views.registerSidebar`, `views.registerTab`, `views.registerStatusBar`, `views.registerSettings`, `views.unregister`, `views.setStatusBarText`                                       | `ui:panel`    |
| `ai.chat`, `ai.complete`                                                                                                                                                              | `ai:invoke`   |
| `clipboard.read`, `clipboard.write`                                                                                                                                                   | `clipboard`   |
| `network.fetch`                                                                                                                                                                       | `network`     |
| `commands.register`, `commands.unregister`, `events.subscribe`, `events.unsubscribe`, `editor.registerCodeBlockRenderer`, `editor.unregister`, `ai.registerTool`, `ai.unregisterTool` | none          |

Helpers: `createRpcId`, `createRpcRequest`, `createRpcResponse`, `createRpcError`, `createRpcEvent`, `isRpcEnvelope`, `isPluginRpcRequest`.

Manifest TypeScript types (`PluginManifest`, `PluginContributes`, and the contribution interfaces) are exported too. Field rules are in [manifest.md](manifest.md).
