# Reddit: Obsidian-adjacent

ai-notes is not an Obsidian plugin. It opens a folder of Markdown. Some of those files can also live in an Obsidian vault, because they are just files. Do not imply that it loads Obsidian plugins, Sync, or the graph.

## Do not post a launch thread in r/ObsidianMD

r/ObsidianMD's posted rule is "Don't shill": if you are there to advertise a product, don't. A first post that is "I made an Obsidian alternative" is the kind of post people get removed or banned for. Check the sidebar the day you post, in case the wording moved.

If someone asks for a local tool that keeps Markdown on disk and can answer from those files, the short reply below is the thing to paste. Say that you wrote it in the first sentence. One mention, then stop.

Do not post the long version in r/ObsidianMD, r/pkms, and r/NoteTaking on the same day. Pick one of r/pkms or r/NoteTaking for the long post. The other can wait several days, and it should not be the same text.

## Short reply, only when someone asked

```text
I wrote ai-notes, so take this as a biased pointer, not a recommendation over Obsidian. It is a separate MIT app, not a plugin. Notes are a folder of Markdown. You can ask against the open vault and the reply is supposed to cite those notes. Search is SQLite FTS5, and the desktop build can add sqlite-vec if you set an embedding model. Ollama on localhost works, and the app does not pull a model for you. There is no graph, no sync, and no mobile app in v0.1.0. The UI is Chinese. https://github.com/zy1252732214/ai-notes
```

## Long post for r/pkms or r/NoteTaking

Title:

```text
I wrote a MIT notebook that keeps Markdown on disk and cites it when you ask
```

Body:

```text
Author post. I wrote this, and I am not claiming it replaces Obsidian or Logseq.

ai-notes 0.1.0 is a desktop notebook (Tauri 2, CodeMirror 6). A note is a .md file in a folder you choose. The SQLite index sits under that folder in .ainotes/ and can be deleted and rebuilt. There is no account, and there is no sync. Copy the folder, or use your own git or disk sync.

The part I actually wanted is the side panel. You ask against the open note and the chunks retrieved from the vault. The reply streams. Paths in the answer are clickable. If the model cites nothing, the notes that were retrieved are still listed when the reply finishes. Full-text search works with no model. sqlite-vec is desktop-only, and only after you set an embedding model. Leave it empty and search stays keyword-only.

Ollama: if it is already running at 127.0.0.1:11434 and you have not saved model settings yet, the first launch calls GET /api/tags and fills in a local chat model. It does not download one. A cloud OpenAI-compatible endpoint also works. On the desktop the API key goes in the OS keychain, not in the vault. The browser preview has no keychain, so that key stays in localStorage.

Cards are ordinary Markdown in a 记忆/ folder, reviewed with SM-2. You can write them by hand. Plugins run in an iframe sandbox and declare permissions. That API is still preview v1.

Not in this version: a graph, mobile apps, a plugin marketplace, inline edits in the editor. The UI is Chinese. No desktop installer is published yet. When one is, the README asks you to use Open Anyway for the official download, and not to turn Gatekeeper or SmartScreen off.

Sample vault needs no key. It lives in memory.

https://github.com/zy1252732214/ai-notes

If you try the sample vault, I would like to hear where a citation does not match the note you expected.
```
