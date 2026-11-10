# Changelog

All notable changes to ai-notes are documented here. The app version in the tree is [0.1.0](#010---2026-11-10). A GitHub Release is created as a draft when a matching `v*` tag is pushed; see [CONTRIBUTING.md](CONTRIBUTING.md).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] - 2026-11-10

First cut of the local-first notebook. Notes are Markdown files in a folder you choose. The desktop shell is Tauri 2, the editor is CodeMirror 6, and the index is SQLite.

### Added

- Monorepo (pnpm, Turborepo), ESLint, Prettier, Vitest, and CI that runs lint, typecheck, test, build, and `format:check` (#7).
- Desktop shell that opens a vault, edits Markdown, and saves it, plus an in-memory sample vault and a browser preview (#10).
- Design tokens, base components, and `apps/ui-preview` (#6, #19).
- CodeMirror editor with `[[wikilinks]]`. Following a link takes a Ctrl/Cmd click (#10, #26).
- Full-text search, backlinks, a quick switcher, and a command palette (#17, #23).
- Chunking, FTS5, and sqlite-vec hybrid search. With no embedding model, search stays keyword-only (#9, #24).
- Model router for OpenAI-compatible endpoints and local Ollama, streaming RAG answers, and clickable citations (#9, #23, #24).
- API keys in the OS keychain on the desktop. The browser preview keeps them in `localStorage`. They are not written into the vault (#26).
- Memory cards as Markdown in `记忆/`, with SM-2 review, handwritten syntax, and optional generation from the current note (#27). See [docs/cards.md](docs/cards.md).
- Plugin API preview v1, manifest schema, and architecture notes (#8).
- Plugin host: iframe sandbox, permission checks, and the `hello-notes` example installed into a vault on open (#18).
- Unsigned installers for macOS (universal dmg), Windows (NSIS and MSI), and Linux (AppImage and deb) when a `v*` tag is pushed (#16).
- Open-source docs: English and Chinese READMEs, MIT license, contributing guide, security policy, issue forms, and the plugin guide. Example plugins `word-count` and `daily-notes`, plus `templates/plugin-starter`.

### Known limits

- No graph view, sync, mobile app, plugin marketplace, or editor selection actions.
- `apps/web` and `server` are placeholders.
- Release artifacts are unsigned unless signing secrets are configured. There is no updater yet.
- The plugin API is preview v1 and can still change. Some manifest fields (status bar, settings pages, `styles.css`, sandboxed editor mutations, plugin `ai.chat`) are typed but not fully wired in the desktop shell. Details are in [docs/plugins/debugging.md](docs/plugins/debugging.md).

[Unreleased]: https://github.com/zy1252732214/ai-notes/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/zy1252732214/ai-notes/releases/tag/v0.1.0
