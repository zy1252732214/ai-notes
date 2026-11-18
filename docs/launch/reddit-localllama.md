# Reddit: r/LocalLLaMA

The sub's self-promotion rule is the 1/10 guideline: self-promotion should not be more than about 10% of your posts and comments, and affiliation has to be disclosed. Do not title it "I found this". If this account is new or already mostly promotional, reply in a thread where someone asked for a local notes setup, using the short reply at the bottom, and skip the launch post.

Lead with the local model. The cloud path is a secondary sentence, not the pitch.

Check the flair list. Use whatever the sub currently offers for a project; do not invent one.

## Title

```text
Local Markdown notes that call Ollama on localhost (MIT, v0.1.0)
```

## Body

```text
Author post. I wrote ai-notes.

It is a desktop notebook. Notes are Markdown files on disk. Questions go to a model you already run, and the reply is supposed to cite those files.

Ollama detection is narrow on purpose. On a first launch, and only if you have not saved model settings, the welcome screen requests GET /api/tags at http://127.0.0.1:11434. The probe only accepts a loopback host (127.0.0.1, localhost, or ::1). It does not follow a redirect to another machine, and it does not run ollama pull. From the models already installed it picks a chat model, preferring smaller common ones such as llama3.2, llama3.1, or Qwen. When two of those share the same preference, it picks the smaller parameter size. An embedding model is never chosen as the chat model. If nomic-embed-text is installed, the UI suggests it for embeddings and leaves the field empty, so search stays FTS5-only until you opt in.

The browser preview is http://localhost:1420, which is the Vite port and the Tauri devUrl. If Ollama refuses the browser, set OLLAMA_ORIGINS to the origin it logged. The README documents http://tauri.localhost as the packaged page origin; no desktop build is published, so that origin is not something you need today. A star value for OLLAMA_ORIGINS works on your own machine and should not be left on a shared one.

Search without an embedding model is SQLite FTS5. sqlite-vec is used on the desktop only after you set an embedding model. The vector table is created at 768 dimensions, which is nomic-embed-text. Changing embedding model means dropping that table and rebuilding it. That is the schema, not a benchmark.

An OpenAI-compatible endpoint also works, including a local one such as LM Studio or Ollama's /v1. On the desktop the key is stored in the OS keychain, not in the notes. There is no account, and v0.1.0 has no telemetry client.

The UI is Chinese. v0.1.0 has no graph, sync, or mobile app, and no installer is published yet. Handwritten cards, search, and the editor do not need a model. Only ask, and optional card generation, do.

https://github.com/zy1252732214/ai-notes

If you try it with a small local model, I want to know whether the citations survive contact with that model. I have not published any speed or quality numbers.
```

## Short reply, if a launch post would break the 10% rule

```text
I wrote this, so bias declared. ai-notes is a local Markdown notebook that talks to Ollama at 127.0.0.1:11434. First launch only probes GET /api/tags and picks an installed chat model. It does not pull anything. Citations are prompted, and if the model cites nothing the retrieved notes are still listed. sqlite-vec stays off until you set an embedding model. MIT, UI is Chinese, no sync. https://github.com/zy1252732214/ai-notes
```
