# Plugin guides

The plugin API is **preview v1** (`apiVersion: "preview-v1"`). Types can still change before 1.0. The host and plugins upgrade together.

| Page                                     |                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| [Getting started](getting-started.md)    | A plugin folder, the starter template, and how to load it               |
| [Manifest and permissions](manifest.md)  | `manifest.json` and the six permissions                                 |
| [API reference](api.md)                  | Everything `@ai-notes/plugin-sdk` exports, including `vault.search`     |
| [Debugging and publishing](debugging.md) | What the desktop shell actually runs, and how a plugin is shipped today |

Examples:

| Plugin                                                                                       | What it does                                                      |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`packages/plugin-sdk/examples/hello-notes`](../../packages/plugin-sdk/examples/hello-notes) | Smallest command. Copied into a vault the first time you open one |
| [`plugins/word-count`](../../plugins/word-count)                                             | Sidebar counts and a copyable summary                             |
| [`plugins/daily-notes`](../../plugins/daily-notes)                                           | Creates `日记/YYYY-MM-DD.md` and lists recent days                |
| [`templates/plugin-starter`](../../templates/plugin-starter)                                 | The folder `create-plugin` copies                                 |

The package README in [`packages/plugin-sdk`](../../packages/plugin-sdk/README.md) is the same contract, shorter.
