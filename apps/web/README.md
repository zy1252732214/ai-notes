# `@ai-notes/web`

Web 入口的占位包。还没有 Vite 配置。前端工程师在这里放浏览器入口，和桌面端共用 `packages/` 里的内核、编辑器、索引、AI、插件和 UI。

浏览器里优先用 File System Access API 打开本地文件夹，不支持时降级到 IndexedDB。

This is a placeholder for the web entry, not a Vite app yet. It should share `packages/` with the desktop shell. Prefer the File System Access API, and fall back to IndexedDB.
