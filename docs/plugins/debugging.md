# Debugging and publishing

## What the desktop shell runs

The types in [the API reference](api.md) are the contract. The desktop shell and the sandbox client are behind that contract in a few places. Write plugins against the behavior below if you want them to work in 0.1.0.

| Call                                                                        | In the app today                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vault.read`, `list`, `create`, `modify`, `delete`, `rename`, `getMetadata` | Implemented. `create` makes parent folders. A second create throws `笔记已存在`                                                                                                                                                                                                                              |
| `vault.search`                                                              | Implemented. Default limit 8, maximum 20. Snippets are plain text. `vault:read` `folders` filter the hits. Hybrid only when the user set an embedding model                                                                                                                                                  |
| `commands.register`                                                         | Implemented. The command shows up in the palette. `console.log` is a banner                                                                                                                                                                                                                                  |
| `views.registerSidebarPanel`                                                | Implemented. The right-hand tab shows this plugin's iframe. Draw the UI by setting `document.body` inside the iframe. The host does not pass CSS variables in                                                                                                                                                |
| `views.registerTabView`                                                     | Same slot as a sidebar panel in the sandbox client                                                                                                                                                                                                                                                           |
| `views.registerStatusBar`, `setStatusBarText`, `registerSettings`           | The host accepts the RPC and does not draw them. The status bar at the bottom of the window is the app's own                                                                                                                                                                                                 |
| `editor.getActiveEditor()`                                                  | Returns `{ notePath }` only. `getContent`, `getSelection`, `replaceSelection`, and `insertAtCursor` exist on the type and on the RPC table, but the sandbox client does not attach them. Read with `vault.read`. Prefer `getContent()` when it is a function so a newer host can hand you the unsaved buffer |
| `editor.registerExtension`                                                  | Same-process plugins only. A sandbox call cannot send a CodeMirror extension                                                                                                                                                                                                                                 |
| `editor.registerCodeBlockRenderer`                                          | Registration is stored. The shell does not ask the sandbox to render a block yet                                                                                                                                                                                                                             |
| `ai.chat`, `ai.complete`                                                    | The desktop service throws `还没有配置模型`. Permission checks run, but the model router is not connected to plugins                                                                                                                                                                                         |
| `ai.registerTool`                                                           | Registration is stored. The shell does not call `ai.tool.call` back into the sandbox yet                                                                                                                                                                                                                     |
| `events.subscribe`                                                          | `note:created`, `note:modified`, `note:opened`, `note:renamed`, `note:deleted` are emitted. `note:modified` fires when a save lands, not on each keystroke                                                                                                                                                   |
| `clipboard`                                                                 | `navigator.clipboard` in the host page. A browser can reject it without a user gesture                                                                                                                                                                                                                       |
| `network.fetch`                                                             | The host `fetch`es, and only to declared domains                                                                                                                                                                                                                                                             |
| Opening a note                                                              | No API. Create the file, then the user opens it from the file tree or the quick switcher                                                                                                                                                                                                                     |
| `styles` in the manifest                                                    | Not loaded. Put a `<style>` block in the iframe document                                                                                                                                                                                                                                                     |

The iframe sandbox attribute is `allow-scripts`. There is no `allow-same-origin`, so the plugin cannot read the host page.

## See a failure

- The plugin list shows manifest errors (invalid JSON, id not equal to the directory, missing `main`).
- A thrown `onload` sets the row to an error.
- `console.log` from the plugin is posted as `lifecycle:log` and shown as a banner.
- A refused call rejects with `PluginApiError`. `code` is `permission_denied`, `not_found`, `already_exists`, `invalid_request`, `invalid_params`, `internal`, `cancelled`, or `not_supported`.
- Disabled ids are stored in `<vault>/.ainotes/plugin-state.json`.

Run the same checks as CI from the repo root:

```bash
pnpm --filter @ai-notes/plugin-word-count test
pnpm turbo run lint typecheck test build
pnpm format:check
```

`build` on a plugin rewrites `src/main.ts` to `dist/main.js` and fails if the output is not a single `definePlugin` import plus `export default`.

## Publishing

There is no plugin directory and no install-from-URL flow. Shipping a plugin today means giving someone a folder they copy to `<vault>/.ainotes/plugins/<id>/`:

```text
<id>/
  manifest.json
  dist/main.js
```

The architecture note describes a later GitHub index of releases. That index is not in the app. Do not document a marketplace install until it exists.

Version with semver. Raising `minAppVersion` is how you drop old hosts. Adding a permission should be called out in the release notes, because the user has to accept it again.

Do not bundle the host, the vault, or an API key into `main.js`. Ask for `network` with an explicit hostname if you need one.
