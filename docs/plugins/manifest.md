# Manifest and permissions

`manifest.json` is checked against [`packages/plugin-sdk/schema/manifest.schema.json`](../../packages/plugin-sdk/schema/manifest.schema.json) and against `parseManifest` in `@ai-notes/plugin-host`. Unknown fields are rejected. The example plugins import `parseManifest` in their tests.

```json
{
  "manifestVersion": 1,
  "apiVersion": "preview-v1",
  "id": "word-count",
  "name": "字数统计",
  "version": "0.1.0",
  "minAppVersion": "0.1.0",
  "author": "ai-notes",
  "description": "在侧栏显示当前笔记的字数。",
  "main": "dist/main.js",
  "permissions": [{ "id": "vault:read" }, { "id": "ui:panel" }],
  "contributes": {
    "commands": [{ "id": "word-count.show", "name": "统计当前笔记字数", "hotkey": "Mod+Alt+W" }],
    "views": [{ "id": "word-count.panel", "name": "字数", "type": "sidebar" }],
    "events": ["note:opened", "note:modified"]
  }
}
```

## Fields

| Field             | Required | Rules                                                                                            |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `manifestVersion` | yes      | Always `1`                                                                                       |
| `apiVersion`      | yes      | Always `"preview-v1"`                                                                            |
| `id`              | yes      | `^[a-z0-9]+(?:[.-][a-z0-9]+)*$`, 1–64 chars. Stable after install. Must match the directory name |
| `name`            | yes      | 1–80 chars, shown in the plugin list                                                             |
| `version`         | yes      | Semver                                                                                           |
| `minAppVersion`   | yes      | Semver. The host refuses to load a plugin the app is too old for                                 |
| `author`          | no       | A string, or `{ "name", "url"?, "email"? }`                                                      |
| `description`     | no       | Up to 500 chars                                                                                  |
| `main`            | yes      | Relative path to a `.js` or `.mjs` file. No `.` or `..` segments                                 |
| `styles`          | no       | Relative `.css` path, same segment rules. The desktop host does not inject it yet                |
| `permissions`     | no       | The list below. Omitted means no permissions                                                     |
| `contributes`     | no       | Static hints. They do not run by themselves; `onload` still has to call `register`               |

`contributes` is what the host can show before executing `main`. Each command, view, and event you register at runtime should be listed here too, so a person can see the shortcut and the permissions before enabling the plugin.

| `contributes` key         | Item                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `commands`                | `{ id, name, hotkey? }`. Hotkey is `Mod+Alt+W`: one or more of `Mod`, `Ctrl`, `Alt`, `Shift`, `Meta`, then a key                             |
| `views`                   | `{ id, name, type, icon? }`. `type` is `sidebar`, `tab`, `status-bar`, or `settings`                                                         |
| `editor`                  | `{ id, kind }` with `kind` of `highlight`, `completion`, `keymap`, `decoration`, or `other`. The extension object itself cannot live in JSON |
| `codeBlockRenderers`      | `{ language }` matching `^[A-Za-z0-9_+-]+$`                                                                                                  |
| `aiTools`                 | `{ name, description }`. `name` matches `^[a-zA-Z][a-zA-Z0-9_-]*$`                                                                           |
| `importers` / `exporters` | `{ id, name, extensions? }`. Extensions are lowercase and have no dot                                                                        |
| `events`                  | `note:created`, `note:modified`, `note:opened`, `note:renamed`, `note:deleted`                                                               |

## Permissions

Nothing is granted by default. The user confirms the list at install, and again on upgrade when it grows. `ctx.permissions` is the subset they accepted. The host rejects a call the plugin did not get.

| id            | Allows                                                                       | Notes                                                                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vault:read`  | `read`, `list`, `getMetadata`, `search`, and reading the active editor       | Optional `folders`: vault-relative directories. Empty or omitted means the whole vault. A path must equal a folder or sit inside it (`notes` does not match `notes-private`) |
| `vault:write` | `create`, `modify`, `delete`, `rename`, `replaceSelection`, `insertAtCursor` | Preview v1 is the whole vault. `folders` does not narrow writes                                                                                                              |
| `ai:invoke`   | `ai.chat`, `ai.complete`                                                     | The desktop service does not call the model router yet. See [debugging](debugging.md)                                                                                        |
| `network`     | `network.fetch`                                                              | Requires `domains`: hostnames, or one leading wildcard label (`*.example.com`). No scheme, port, or path. The host sends the request                                         |
| `ui:panel`    | Sidebar, tab, status bar, settings                                           | The desktop shell currently shows sidebar panels only                                                                                                                        |
| `clipboard`   | `readText`, `writeText`                                                      | Text only                                                                                                                                                                    |

```json
{ "id": "vault:read", "folders": ["日记", "项目"] }
```

```json
{ "id": "network", "domains": ["api.example.com", "*.example.com"] }
```

Commands, events, code-block renderer registration, and AI tool registration do not take an extra permission. Doing the work inside the callback still does: reading a note needs `vault:read`, writing needs `vault:write`.

Permission helpers exported by the SDK:

- `PERMISSION_IDS`
- `hasPermission(permissions, id)`
- `findPermission(permissions, id)` returns the object, so you can read `folders` or `domains`
- `isPathWithinFolders(path, folders)` and `normalizeVaultPath(path)`

Paths use `/`, must not start with `/`, and must not contain `..`.
