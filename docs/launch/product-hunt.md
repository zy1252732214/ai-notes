# Product Hunt

Skip this if you cannot watch the comments. A listing with no maker replies looks abandoned. Schedule it for 00:01 America/Los_Angeles so it gets that calendar day. That is 16:01 in Beijing and 03:01 in America/New_York. See [checklist.md](checklist.md).

The form's topic list changes. Pick only topics the form actually offers. Likely fits, if present: Open Source, Productivity, Note Taking. Do not type a topic that is not in the list.

There is no product site. The link is the GitHub repo. Gallery images, if the form requires them, are the files already in `docs/assets/` (`sample-vault.png`, `links.png`, `review.png`, `commands.png`). Do not generate a new illustration.

## Name

```text
ai-notes
```

## Tagline

49 characters.

```text
Local Markdown notes, with answers that cite them
```

## Short description

260 characters is the limit this draft targets. The text below is 253 characters, including spaces. If the form allows more, use the maker comment instead of padding this.

```text
A folder of Markdown you own. Replies are prompted to cite your notes. FTS5 search always works; desktop sqlite-vec stays off until you set an embedding model. Ollama locally, or your key in the OS keychain. MIT. No sync, graph, or mobile app in v0.1.0.
```

## Maker comment

```text
I built this. Notes stay .md files on disk. The SQLite index under .ainotes/ can be deleted and rebuilt. There is no account.

The ask panel sends the open note and retrieved chunks. The reply streams. Paths in the answer are clickable. If the model cites nothing, the retrieved notes are still listed when it finishes.

Ollama at http://127.0.0.1:11434 is detected on a first launch with no saved settings. The app lists local models and does not download one. An OpenAI-compatible endpoint works too. Desktop API keys go to the OS keychain. The browser preview has no keychain, so the key stays in localStorage. The vault never stores it.

v0.1.0 is missing a graph, sync, mobile, a plugin marketplace, and inline edits. The UI is Chinese. No desktop installer is published yet. The sample vault runs in the browser preview with no key. When a release exists, the README asks people to use Open Anyway on the official download, and not to turn Gatekeeper or SmartScreen off.

https://github.com/zy1252732214/ai-notes
```

## First reply, if someone asks about the unsigned download

Use the FAQ in [checklist.md](checklist.md#unsigned-installers). Do not tell people to turn Gatekeeper or SmartScreen off.
