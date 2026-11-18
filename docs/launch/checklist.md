# Launch-day checklist

Do this only after you decide to publish. None of it has happened: there is no tag and no GitHub Release. This checklist does not publish anything. The social drafts must not say an installer already exists.

## Before anyone can download

1. On `main`, these three versions are all `0.1.0`: `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/package.json`, and `apps/desktop/src-tauri/Cargo.toml`. Tag `v0.1.0` and push it only when you mean to build. The workflow uploads a **draft** GitHub Release. It does not publish it.
2. Open the draft. Confirm the universal macOS dmg, the Windows NSIS `.exe`, the MSI, the Linux AppImage, and the deb are attached. Publish the draft yourself.
3. Click the published release once from a machine that did not build it. macOS and Windows should show the warnings in [Unsigned installers](#unsigned-installers). If the file is missing, do not send people to the page yet.
4. Confirm `main` shows `docs/assets/demo.gif` at the top of both READMEs, with the mp4 link still under it.
5. Upload the social image yourself. GitHub does not take it from the repo. Settings → General → Social preview → upload `docs/assets/social-preview.png` (1280×640).
6. After the release is actually public, replace the README badge `release-not published yet` with the dynamic Shields badge `https://img.shields.io/github/v/release/zy1252732214/ai-notes`, still linking to the Releases page. Until then the static badge is the accurate one. A dynamic badge today says "no releases or repo not found", which is not a published version, but it also looks like the repository is missing.

## Clocks

US daylight saving time ends on the first Sunday of November. After that, America/New_York is EST (UTC−5) and America/Los_Angeles is PST (UTC−8). Beijing is CST (UTC+8) all year, 13 hours ahead of EST and 16 hours ahead of PST.

Show HN is busiest on Tuesday, Wednesday, or Thursday, about 8:00–9:30 America/New_York, when the US East Coast is starting the workday. Avoid Monday, Friday, the weekend, and US federal holidays. 11 November 2026 was a Wednesday and Veterans Day. If you are picking a day after that, use an ordinary Tuesday–Thursday. This is a calendar fact, not a traffic measurement.

| Moment                                    | Beijing         | New York (EST) | Los Angeles (PST) |
| ----------------------------------------- | --------------- | -------------- | ----------------- |
| Product Hunt day starts                   | 16:01 same date | 03:01          | 00:01             |
| Show HN window opens                      | 21:00           | 08:00          | 05:00             |
| A reasonable HN post time                 | 21:30           | 08:30          | 05:30             |
| End of the usual HN window                | 22:30           | 09:30          | 06:30             |
| Still worth replying (about two hours in) | 23:30           | 10:30          | 07:30             |

If you are the person answering HN, be awake from 21:00 Beijing until about 23:30. Do not schedule the post and leave.

## Same-day order

One person cannot usefully talk on every site in the same hour. Suggested order:

1. **Product Hunt**, only if you will reply. 00:01 America/Los_Angeles (16:01 Beijing). You can skip it. HN is the post with the narrow clock.
2. **V2EX, 即刻, 微博** in the Beijing evening, before HN, not in the same minute. Around 19:30–20:30 Beijing is before the HN window and after the PH afternoon. Use the drafts as written. They are already different texts.
3. **Show HN** at 21:00–22:30 Beijing (08:00–09:30 America/New_York). Paste [the first comment](show-hn.md) within a minute of the title. Stay for the first two hours.
4. **X thread** when the HN post is up, or a few minutes later. Six posts, no hashtags.
5. **Reddit, not as a burst.** Identical text on several subs in one hour reads as spam.
   - r/LocalLLaMA after HN is up, or the next US morning. Disclose that you wrote it. If the account would break the sub's 10% self-promo guideline, use the short reply in an existing thread instead.
   - r/selfhosted the next day. First lines say it is a desktop app, not a server.
   - r/pkms **or** r/NoteTaking the day after that. Not both, and not the same wording.
   - Do not open with a launch post on r/ObsidianMD. Their rule is don't shill. The short reply in [reddit-obsidian-adjacent.md](reddit-obsidian-adjacent.md) is only for a thread where someone asked.
6. **少数派** is an editorial pitch, [sspai-matrix.md](sspai-matrix.md). Send it before launch day. You do not control when it runs.

## How to reply

- Answer the first hour yourself. A late correction is fine. A missing author is not.
- If you were wrong, say what is wrong and point at the README. Do not edit the limitation out of the story.
- Gatekeeper or SmartScreen: paste the FAQ below. Do not tell anyone to turn either feature off.
- "Why not Obsidian?": they are different tools. Point at the table in the README. MIT, files on disk, cited answers in the app. No need to argue past that.
- Benchmarks, user counts, "how fast", "how accurate": there are no published numbers. Say that.
- A bug: ask for the OS, whether it was the sample vault or a real folder, and whether a model was configured. Issues: https://github.com/zy1252732214/ai-notes/issues
- Do not ask for stars, upvotes, or follows in the replies.
- Do not promise a graph, sync, mobile, a marketplace, or inline edits. Those are not in 0.1.0.
- `docs/architecture.md` describes later work. Do not quote it as the current app.

## Unsigned installers

Paste the English block on HN, Reddit, X, and Product Hunt. Paste the Chinese block on V2EX, 即刻, and 微博.

Do not paste this until a release is public. It applies only to a file attached to https://github.com/zy1252732214/ai-notes/releases after the reader has checked that source.

The workflow facts, for that future build: with no Apple certificate, macOS is ad-hoc signed (`signingIdentity` `-`) and not notarized. CONTRIBUTING notes that an unsigned macOS download can be reported as damaged. With no Windows certificate, the NSIS and MSI builds have no Authenticode signature. The app name in the bundle is `ai-notes`.

Prefer Open Anyway. The `xattr` command is a fallback for that one app. It removes the quarantine flag from that app. It is not a way to turn security off.

### English

```text
This is only for the app you downloaded from the ai-notes GitHub Release, after you have checked the file is attached there. There is no other official download.

Prefer Open Anyway. Open that app once, then System Settings → Privacy & Security → Open Anyway. Leave Gatekeeper on.

Only if macOS still says that this app is damaged, the command below removes the quarantine flag (com.apple.quarantine) from that app and nothing else:

xattr -dr com.apple.quarantine /Applications/ai-notes.app

Use the path of the copy you installed from the release. Do not run it on other apps, and do not turn Gatekeeper off.

Windows, for that same official installer: SmartScreen may say "Windows protected your PC" because there is no Authenticode signature. More info → Run anyway. Do not turn SmartScreen off.

There is no auto-update in this version.
```

### 中文

```text
这段只适用于你从 ai-notes 的 GitHub Release 下载、并且核对过附件确实来自那里的那一份。没有别的官方下载地址。

请优先点「仍要打开」。先打开这一份，再到「系统设置 → 隐私与安全性」点「仍要打开」。Gatekeeper 保持开着。

只有系统仍然说这一份已损坏时，才用下面的命令。它会移除这个 app 的隔离标记（com.apple.quarantine），不影响其他应用：

xattr -dr com.apple.quarantine /Applications/ai-notes.app

路径改成你从 Release 安装的那一份。不要对别的 app 运行，也不要关掉 Gatekeeper。

Windows 上，对同一份官方安装包：没有 Authenticode 签名时，SmartScreen 可能会说「Windows 已保护你的电脑」。点「更多信息」，再点「仍要运行」。不要关掉 SmartScreen。

这一版没有自动更新。
```
