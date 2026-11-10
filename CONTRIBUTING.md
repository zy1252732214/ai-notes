# Contributing

中文：本地检查和 CI 相同，在仓库根目录执行 `pnpm turbo run lint typecheck test build`，然后 `pnpm format:check`。提交说明用 Conventional Commits，中文或英文都可以。不要升级依赖，除非那个 PR 就是在处理 Dependabot。安全问题不要开公开 Issue，看 [SECURITY.md](SECURITY.md)。

Thanks for looking at the code. ai-notes is a pnpm + Turborepo monorepo. The product surface is the desktop app; most behavior lives in `packages/`.

## Prerequisites

- Node.js **26.13.0**, pinned in [`.nvmrc`](.nvmrc). On Linux the official Node 26 binary needs `libatomic1` if `node` will not start.
- pnpm **12.16.1**, pinned in the root `packageManager` field. Node 26 does not ship Corepack, so install pnpm yourself: `npm install -g pnpm@12.16.1`. CI uses `pnpm/action-setup` and does not need that global install.
- TypeScript **6.0.3**. Do not bump it to 6.1+ or 7 until `typescript-eslint` supports that release. Do not upgrade other dependencies in an unrelated PR.
- Rust is only needed for `pnpm --filter @ai-notes/desktop dev` and for the release workflow. Pull-request CI does not compile Rust.

```bash
nvm use
pnpm install
```

## Repository map

| Path                                        | What it is                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/desktop`                              | Tauri 2 + Vite + React shell. `build` is the frontend only              |
| `apps/ui-preview`                           | Gallery for `packages/ui`                                               |
| `apps/web`                                  | Placeholder. Not a Vite app                                             |
| `packages/core`                             | Vault filesystem, paths, sample vault                                   |
| `packages/editor`                           | CodeMirror 6 Markdown editor and wikilinks                              |
| `packages/indexer`                          | Chunking, FTS5, links, sqlite-vec hybrid search                         |
| `packages/ai`                               | OpenAI-compatible and Ollama router, RAG helpers, SM-2 cards            |
| `packages/plugin-sdk`                       | Plugin types, manifest schema, RPC envelope. No I/O                     |
| `packages/plugin-host`                      | Sandbox, permission checks, discovery                                   |
| `packages/ui`                               | Tokens and base components                                              |
| `plugins/word-count`, `plugins/daily-notes` | Example plugins. Not copied into a vault automatically                  |
| `templates/plugin-starter`                  | Copyable plugin. `node scripts/create-plugin.mjs`                       |
| `server`                                    | Placeholder for a future sync service. The desktop app does not call it |
| `docs/`                                     | Architecture, index DDL, cards, plugin guides                           |

Workspace globs are in [`pnpm-workspace.yaml`](pnpm-workspace.yaml). A new `plugins/<id>/package.json` joins install and Turbo on the next `pnpm install`.

Dependency direction, via `workspace:*`:

```text
core, plugin-sdk, ui, server
  -> editor, indexer, plugin-host
    -> ai
      -> apps/desktop, apps/web
```

Packages used to export a `workspaceDependencies` array so a test could lock this graph. That array is not a product API.

## Commands

Run them from the repository root.

| Command                                     | What it does                                                  |
| ------------------------------------------- | ------------------------------------------------------------- |
| `pnpm dev`                                  | Watch library builds. The desktop `dev` script is `tauri dev` |
| `pnpm --filter @ai-notes/desktop exec vite` | Browser preview at <http://localhost:1420>                    |
| `pnpm --filter @ai-notes/desktop dev`       | Desktop window                                                |
| `pnpm build`                                | `turbo run build`. Does **not** run `tauri build`             |
| `pnpm test`                                 | `turbo run test`. Builds dependencies first                   |
| `pnpm lint` / `pnpm typecheck`              | ESLint and `tsc --noEmit`                                     |
| `pnpm format` / `pnpm format:check`         | Prettier                                                      |

Shared config sits at the root: `tsconfig.base.json`, `eslint.config.js`, `prettier.config.js`, `vitest.config.ts`.

One package:

```bash
pnpm --filter @ai-notes/plugin-word-count test
```

## The same checks as CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pull requests and on pushes to `main`:

```bash
pnpm install --frozen-lockfile
pnpm turbo run lint typecheck test build
pnpm format:check
```

CI does not build desktop installers. Keep `apps/desktop`'s `build` script as a frontend build. `tauri.conf.json` calls that frontend build from `beforeBuildCommand` only when the release workflow invokes `tauri build`.

## Commits and pull requests

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(editor): open wikilinks with a modifier click
fix(ai): keep the API key out of the vault
docs: describe the plugin sandbox
```

Chinese or English both fit. There is no commitlint job. The subject should say what changed.

- Branch from `main`.
- Do not commit `.env`, signing keys, updater keys, or `dist/`.
- A PR that changes behavior needs a test next to the code. Documentation-only PRs still have to pass `format:check`.
- Fill in the pull request template, including the test commands you actually ran.
- User-facing claims in `README.md` have to match the code. Do not document a graph, sync, or a plugin marketplace until they exist.

Plugin work starts at [docs/plugins](docs/plugins/README.md).

## Release

Installers are built only from a `v*` tag, by [`.github/workflows/release.yml`](.github/workflows/release.yml). The workflow writes a **draft** GitHub Release. It does not run on pull requests.

The version that matters is `apps/desktop/src-tauri/tauri.conf.json`. Keep these three the same:

- `apps/desktop/src-tauri/tauri.conf.json` `version`
- `apps/desktop/package.json` `version`
- `apps/desktop/src-tauri/Cargo.toml` `version`

Then, on `main`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The tag is `v` plus that version. `v0.1.0-rc.1` is accepted. A mismatch fails the workflow before bundling. You can also run the workflow by hand with the same tag string; the commit must already contain the matching config.

Artifacts: universal macOS dmg, Windows NSIS and MSI, Linux AppImage and deb. The workflow caches the pnpm store and `apps/desktop/src-tauri/target`.

Signing secrets are optional. Do not invent placeholders in the repo.

| Secret                                                                      | If unset                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------ |
| `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`        | Updater artifacts are not signed                       |
| `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` | macOS uses an ad-hoc identity and still produces a dmg |
| `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`                               | No notarization                                        |
| `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`                       | No Authenticode signature                              |

An empty `APPLE_CERTIFICATE` is not forwarded. Unsigned macOS downloads can be reported as damaged by the OS. The updater public key, when there is one, belongs in `tauri.conf.json`. The private key stays in `TAURI_SIGNING_PRIVATE_KEY`.

Repository Settings → Actions → General → Workflow permissions must allow `GITHUB_TOKEN` to create the Release.

## Code of conduct

This project uses the [Contributor Covenant](CODE_OF_CONDUCT.md).
