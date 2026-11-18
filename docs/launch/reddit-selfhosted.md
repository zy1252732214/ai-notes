# Reddit: r/selfhosted

Check the sidebar the day you post. The draft below assumes the usual expectations: say you made it, do not paste the README, and stay in the thread. It does not use Lemmy tags. If you cross-post to a Lemmy selfhost community, read that community's current AI-project rules first and do not reuse this text unchanged.

This is a desktop app you run on your own machine. It is not a Docker service. `server/` in the repo is a placeholder, and the desktop app does not call it. Say that in the first lines so the title is not a bait-and-switch. Lead with where the files and keys live.

Do not post this in the same hour as the other Reddit drafts.

## Title

```text
ai-notes: Markdown notes on your own machine, Ollama or your own key (MIT)
```

## Body

```text
I built this. It is a desktop app, not a server and not a compose stack. server/ in the repo is a placeholder and the app does not call it. You run it locally. There is no account with me.

Notes are Markdown files in a folder you choose. The index is a SQLite file under that folder (.ainotes/) and can be deleted and rebuilt. I did not add a telemetry client in v0.1.0. Note text leaves the machine only if you point the app at a model URL, or if you grant a plugin the network permission for domains it declared.

Search is SQLite FTS5 with no model required. On the desktop, setting an embedding model also turns on sqlite-vec. Leave it empty and search stays keyword-only.

The ask panel sends the open note plus retrieved chunks. The reply streams and is prompted to cite the notes. Paths in the answer are clickable. If the model cites nothing, the retrieved notes are still listed at the end.

Ollama: on a first launch with no saved settings, if something is already listening at http://127.0.0.1:11434, the app calls GET /api/tags and picks a local chat model. It does not run ollama pull, and it will not pick an embedding model as the chat model. The browser preview is http://localhost:1420 (Vite's port and the Tauri devUrl). Ollama has to allow that origin via OLLAMA_ORIGINS. The README also documents http://tauri.localhost as the packaged page origin, for a desktop build that is not published yet. A cloud OpenAI-compatible API also works. The desktop app stores that key in the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service). The browser preview stores it in localStorage. The vault never gets the key.

Cards are Markdown in 记忆/, SM-2. Plugins are an iframe without allow-same-origin. The plugin API is preview v1.

v0.1.0 has no sync, no mobile app, no graph, and no plugin marketplace. The UI is Chinese. No installer is published yet. A later desktop build, once a v* tag is pushed and the draft release is published, would be an unsigned universal macOS dmg, Windows NSIS and MSI, and a Linux AppImage and deb, unless signing secrets are added. There is no auto-update. The README asks you to use Open Anyway on an official download, and not to turn Gatekeeper or SmartScreen off.

License is MIT. https://github.com/zy1252732214/ai-notes

Happy to answer how the index and the keychain are split. I do not have benchmark numbers.
```
