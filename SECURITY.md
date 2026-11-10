# Security policy

中文：请用 [GitHub 私人安全通告](https://github.com/zy1252732214/ai-notes/security/advisories/new) 报告漏洞，不要开公开 Issue，也不要在 Issue 里贴 API Key、笔记内容或插件利用步骤。插件沙箱逃逸、权限绕过、密钥写进笔记库或日志，都属于这里。

## Reporting

Report a vulnerability privately:

[github.com/zy1252732214/ai-notes/security/advisories/new](https://github.com/zy1252732214/ai-notes/security/advisories/new)

Please include the app version (`0.1.0` or a commit), the OS, whether you used the desktop shell or the browser preview, the plugin id if one is involved, and a minimal way to reproduce it. Maintainers will acknowledge the report and coordinate a fix. There is no bounty program.

Do not open a public issue for a security report, and do not paste API keys, vault contents, or a working sandbox escape.

## Supported versions

| Version        | Status                                           |
| -------------- | ------------------------------------------------ |
| 0.1.x          | The current tree. Reports are accepted           |
| Anything older | There has been no published release before 0.1.0 |

The plugin API is **preview v1**. A breaking change there, called out in the changelog, is not a vulnerability.

## Plugin sandbox

Community plugins run in an iframe with `sandbox="allow-scripts"` and without `allow-same-origin`. They do not get the host DOM, the filesystem, or other plugins. Calls cross `postMessage` as `ai-notes.plugin-rpc` envelopes. The host checks the manifest permission before it runs the call.

Please report:

- A plugin reading or writing outside the vault, or outside the folders granted on `vault:read`.
- A plugin using `vault:write`, `network`, `clipboard`, `ai:invoke`, or `ui:panel` without that permission having been granted.
- A `network` call to a host that is not in the manifest `domains` list (including a bypass with redirects, DNS rebinding, or a crafted URL).
- A `postMessage` that the host accepts from a window that is not that plugin's frame.
- One plugin reaching another plugin's iframe, storage, or RPC.
- CodeMirror extensions or other host objects leaking into a sandboxed plugin. `editor.registerExtension` is for same-process plugins only.

`vault:write` covering the whole vault in preview v1 is intentional. The install UI is supposed to say so. A plugin that writes anywhere in the vault **with** `vault:write` is working as designed.

`styles.css` on the manifest is not loaded by the host yet. That is unfinished, not a sandbox boundary.

## API keys and local data

On the desktop, API keys are stored in the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) under the service `app.ai-notes.desktop`. They must not be written into the vault, into `.ainotes/index.db`, into logs, or into a future sync payload.

The browser preview and the sample vault have no keychain. The key then stays in `localStorage`. That fallback is documented. A bug that copies the key into a note, a plugin, or a model request the user did not start is in scope.

The model request itself is sent from the page with `fetch` to the endpoint the user configured. Notes are not sent anywhere until the user asks a question or generates cards.

## Out of scope

- Unsigned release artifacts. Signing secrets are optional; the workflow says so.
- The browser preview storing the API key in `localStorage` when no keychain exists.
- A plugin doing something destructive **after** the user granted `vault:write`.
- Missing product features (sync, graph, marketplace).
- Self-XSS that requires the user to paste an attack into their own note with no privilege gain.
