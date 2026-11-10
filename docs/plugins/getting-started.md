# Getting started

A plugin is a directory:

```text
my-notes/
  manifest.json
  dist/main.js     # or main.js, whatever `manifest.main` says
  styles.css       # optional; the desktop host does not load this yet
```

The host reads `<vault>/.ainotes/plugins/<id>/`. The directory name must equal `manifest.id`.

`main.js` runs in an iframe as a classic script. The host rewrites two things and nothing else:

- `import { definePlugin } from '@ai-notes/plugin-sdk'`
- `export default`

Any other import, or a second export, fails to load. Put helpers in the same file. `export function` is fine in TypeScript: `pnpm build` strips those exports when it writes `dist/main.js`.

## New plugin

From the repository root:

```bash
node scripts/create-plugin.mjs my-notes "My Notes"
pnpm install
pnpm --filter @ai-notes/plugin-my-notes test
pnpm --filter @ai-notes/plugin-my-notes build
```

The id is lowercase letters, digits, dots, and hyphens, 1–64 characters. The script copies [`templates/plugin-starter`](../../templates/plugin-starter) into `plugins/<id>/` and rewrites the package name, the manifest id, and the command id.

You can also copy the template by hand.

## Load it

```bash
pnpm --filter @ai-notes/plugin-my-notes build
mkdir -p "/path/to/vault/.ainotes/plugins/my-notes"
cp -R plugins/my-notes/. "/path/to/vault/.ainotes/plugins/my-notes/"
```

Reopen the vault. The plugins button in the top bar lists it. Turn it on. A sidebar contribution shows up as a tab on the right; the iframe is the panel. `console.log` in the plugin becomes a banner at the top of the window.

`hello-notes` is the one plugin the app installs for you, and only when `.ainotes/plugins/hello-notes` is missing. `word-count` and `daily-notes` stay in the repo until you copy them.

The sample vault is in memory. Plugins you add there disappear when the page closes. Use **打开文件夹** when you want the plugin to stay.

## Shape of the code

```ts
import { definePlugin } from '@ai-notes/plugin-sdk';

export default definePlugin({
  async onload(ctx) {
    ctx.subscriptions.add(
      ctx.app.commands.register({
        id: 'my-notes.hello',
        name: '打招呼',
        callback: async () => {
          const entries = await ctx.app.vault.list();
          const count = entries.filter((entry) => entry.kind === 'note').length;
          console.log(`笔记库里有 ${count} 篇笔记`);
        },
      }),
    );
  },
});
```

A class works too. If the default export is a function, the host runs `new Plugin(ctx)`:

```ts
import { Plugin, type PluginContext } from '@ai-notes/plugin-sdk';

export default class MyNotes extends Plugin {
  constructor(ctx: PluginContext) {
    super(ctx);
  }

  override async onload(): Promise<void> {
    this.ctx.subscriptions.add(
      this.ctx.app.events.subscribe('note:opened', (event) => {
        console.log(event.path);
      }),
    );
  }
}
```

The class form needs `import { Plugin }`, which the sandbox rewriter does not strip. Ship the class only if you bundle it so the runtime file still has a single `definePlugin` import, or keep the class for in-process tests and ship `definePlugin`. The examples use `definePlugin`.

Register commands, views, and event handlers inside `onload`, and `add` the returned disposable to `ctx.subscriptions`. After `onunload`, the host disposes that store. `onunload` itself can be empty.

Next: [manifest and permissions](manifest.md).
