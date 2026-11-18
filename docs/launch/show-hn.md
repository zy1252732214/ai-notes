# Show HN

Do not post this while the GitHub Release is still a draft. Post on a Tuesday, Wednesday, or Thursday, 8:00–9:30 America/New_York, and not on a US federal holiday. Paste the first comment immediately. Clocks and reply notes are in [checklist.md](checklist.md).

The title is one line. The comment is the post.

## Title

```text
Show HN: ai-notes - local Markdown notes with cited answers
```

## First comment

```text
I built ai-notes, a local-first notebook. Notes are Markdown files in a folder you choose. The desktop shell is Tauri 2, the editor is CodeMirror 6, and the index is SQLite.

You ask in a side panel. The reply streams. It is given the open note and the chunks retrieved from the vault, and the prompt tells it to cite them. [[paths]] in the answer are clickable. If the model writes no citation, the notes that were retrieved are still listed when the reply finishes. I would rather show the retrieval than pretend the model always behaves.

Search is FTS5, so it works with no model at all. If you set an embedding model, the desktop app also searches with sqlite-vec. Leave that field empty and search stays keyword-only. The browser preview does not turn on vector search by itself.

For the model, Ollama on localhost is enough. On a first launch with no saved settings, if Ollama is already up at http://127.0.0.1:11434, the app calls GET /api/tags and fills in a chat model it finds. It prefers a smaller common one such as llama3.2, llama3.1, or Qwen, and it will not use an embedding model as the chat model. If nomic-embed-text is installed, the screen suggests it and leaves the field empty. The app never runs ollama pull. An OpenAI-compatible endpoint also works (OpenAI, DeepSeek, OpenRouter, LM Studio, or Ollama's /v1). On the desktop, the API key goes into the system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service). The browser preview has no keychain, so the key stays in localStorage. Neither is written into the vault. There is no account.

Memory cards are Markdown files in 记忆/, reviewed with SM-2. You can write question::answer, {{cloze}}, or a card fence. Generating cards from a note is optional and uses the model you already configured. Handwritten cards, search, and the editor do not need a model.

Plugins run in an iframe with no allow-same-origin. They declare permissions (vault:read, vault:write, ai:invoke, network, ui:panel, clipboard) and talk to the host over RPC. The API is preview v1 and can still change. The repo has hello-notes, word-count, and daily-notes.

v0.1.0 does not have a graph, sync, mobile apps, a plugin marketplace, or inline edits in the editor. apps/web and server are placeholders. The UI is Chinese. There is no auto-update, and I did not add a telemetry client. Note text is sent only to the model URL you configure, or through a plugin whose network permission you granted for specific domains.

The installers are unsigned unless you add your own signing secrets. The macOS dmg is ad-hoc signed and not notarized, so Gatekeeper may say the app is damaged. Windows SmartScreen will warn. Leave both enabled. The clicks, and the xattr command, are in the README. The release workflow uploads a draft GitHub Release; it is not public until that draft is published.

The sample vault is in memory: a welcome note, a weekly note with handwritten cards, and a plan note. No key required. From source you need Node.js 26.13.0 and pnpm 12.16.1:

git clone https://github.com/zy1252732214/ai-notes.git
cd ai-notes
pnpm install
pnpm --filter @ai-notes/desktop exec vite

Then open http://localhost:1420. For the browser to reach Ollama, start it with OLLAMA_ORIGINS including http://localhost:1420. The packaged webview origin is http://tauri.localhost.

https://github.com/zy1252732214/ai-notes
MIT.

The README has a table next to Obsidian and Logseq. They are different tools, not a ranking. I do not have benchmark numbers. I want feedback on whether the citations are actually useful, and on whether those plugin permissions are the right set.
```
