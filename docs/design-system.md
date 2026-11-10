# 设计系统

ai-notes 的界面按本地笔记工具来做：安静、留白充足、字优先。参考的是 Obsidian、Bear、iA Writer 和 Linear 的工作台，不是营销页。

问答是普通功能，标签就叫「问答」。不使用紫色或靛蓝渐变、发光、火花图标、玻璃拟态、霓虹强调色。强调色只有一种墨绿，问答和引用复用它。

令牌的唯一来源是 [`packages/ui/tokens.css`](../packages/ui/tokens.css)。[`packages/ui/src/tokens.ts`](../packages/ui/src/tokens.ts) 是同一套数值的类型化镜像，两处一起改。组件样式在 [`packages/ui/components.css`](../packages/ui/components.css)，桌面壳在 `apps/desktop/src/styles.css`。业务和插件样式只引用 `--an-*`，不写死颜色、字号、间距或圆角。

## 主题

浅色变量写在 `:root`。深色变量写在 `[data-theme='dark']`。`bindTheme` 把解析结果写到 `<html data-theme="light|dark">`。

- `system`：跟随操作系统，系统切换后更新
- `light` / `dark`：固定

桌面端顶栏有切换按钮。模型设置里的「外观」可以选择跟随系统、浅色或深色，选择后立即生效。

## 颜色

浅色是暖纸，深色是暖炭。文字和背景的对比按正文可读来取，强调色在两种主题下都能当按钮文字的底。

| 变量                  | 用途                         | 浅色      | 深色      |
| --------------------- | ---------------------------- | --------- | --------- |
| `--an-bg-base`        | 编辑区背景                   | `#fbfaf8` | `#1c1b19` |
| `--an-bg-subtle`      | 侧栏、面板、代码块底         | `#f3f1ec` | `#242320` |
| `--an-bg-elevated`    | 弹窗、浮层、命令面板         | `#fffcf9` | `#2c2b28` |
| `--an-text-primary`   | 正文、标题                   | `#1c1917` | `#f4f1ea` |
| `--an-text-secondary` | 次要说明                     | `#57534e` | `#c4bfb4` |
| `--an-text-tertiary`  | 占位符、时间戳、元信息       | `#736d61` | `#9b917f` |
| `--an-border-subtle`  | 纯分隔线和卡片轮廓           | `#e6e1d8` | `#3a3834` |
| `--an-border-control` | 输入框、开关、复选框         | `#948a7f` | `#7d7368` |
| `--an-accent`         | 主按钮、链接、焦点环、当前项 | `#3c6e62` | `#9dc7b8` |
| `--an-on-accent`      | 主按钮上的文字               | `#fbfaf8` | `#14201c` |
| `--an-ai`             | 与强调色相同                 | `#3c6e62` | `#9dc7b8` |
| `--an-ai-subtle`      | 很淡的回答底色               | `#eef3f1` | `#24302c` |
| `--an-success`        | 保存成功                     | `#2c7c4a` | `#7dcea0` |
| `--an-warning`        | 未保存、需要注意             | `#9c6005` | `#e0b15a` |
| `--an-danger`         | 删除、错误                   | `#b42318` | `#f0a097` |
| `--an-selection`      | 编辑器选区底色               | `#75988f` | `#5c7168` |

悬停用 `color-mix` 从已有变量派生。分隔线用 `--an-border-subtle`，控件边界用 `--an-border-control`。1px 边框不是间距。

## 对比度

按 WCAG 2.1 AA。`packages/ui/src/contrast.test.ts` 解析 `tokens.css`，两种主题都要过。

- 正文、次要文字、三级文字，放在 `--an-bg-base`、`--an-bg-subtle`、`--an-bg-elevated` 上，至少 4.5:1。
- 作为文字使用的强调色、成功色、警告色、危险色，相对编辑区背景至少 4.5:1。主按钮上的文字相对强调色也是 4.5:1。
- 输入框、开关轨道、复选框用 `--an-border-control`，相对所在背景至少 3:1。
- 纯分隔线、面板和对话框轮廓用 `--an-border-subtle`。它故意浅于控件边框，不拿来画输入框，避免整页变重。
- 选区是预先混合好的实色：浅色大约 70% 强调色叠在纸上，深色大约 50% 叠在炭色上。正文色落在选区上至少 4.5:1。
- 焦点环是 `outline: 2px solid var(--an-accent)`，`outline-offset: 2px`。不用半透明强调色。
- 提问气泡上的「提问」，以及悬停或聚焦的引用路径，用 `--an-text-secondary`。那两处底色比纸更深，三级文字不够 4.5:1。引导上的「推荐」放在 `--an-bg-subtle` 上，不用更深的强调色混色。

## 字体

界面 `--an-font-ui`：

```text
-apple-system, BlinkMacSystemFont, 'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei', 'Segoe UI', sans-serif
```

代码 `--an-font-code`：

```text
'JetBrains Mono', 'SF Mono', ui-monospace, 'Sarasa Mono SC', Menlo, Consolas, monospace
```

系统里有中文字体时优先用苹方、冬青黑、思源黑体或微软雅黑。没有 Inter 时落到系统界面字体。

| 级别  | 变量后缀 | 字号 | 行高 | 字重 | 用途                     |
| ----- | -------- | ---- | ---- | ---- | ------------------------ |
| H1    | `h1`     | 32px | 40px | 600  | 笔记标题                 |
| H2    | `h2`     | 24px | 32px | 600  | 二级标题                 |
| H3    | `h3`     | 18px | 28px | 600  | 三级标题、对话框标题     |
| Body  | `body`   | 16px | 28px | 400  | 笔记正文                 |
| UI    | `ui`     | 14px | 22px | 400  | 侧栏、按钮、菜单         |
| Small | `small`  | 12px | 16px | 400  | 状态栏、时间戳、引用路径 |
| Code  | `code`   | 13px | 22px | 400  | 代码块、行内代码         |

变量名是 `--an-font-size-*`、`--an-line-*`、`--an-font-weight-*`。编辑区正文限制在 `--an-editor-max-width`（680px），并自动换行。

## 间距、圆角、阴影、动效

间距是 4px 栅格：

| 变量           | 值   |
| -------------- | ---- |
| `--an-space-1` | 4px  |
| `--an-space-2` | 8px  |
| `--an-space-3` | 12px |
| `--an-space-4` | 16px |
| `--an-space-6` | 24px |
| `--an-space-8` | 32px |

圆角：`--an-radius-sm` 6px，`--an-radius-md` 8px，`--an-radius-lg` 12px，`--an-radius-xl` 16px。对话框和命令面板用 `xl`。

阴影：

| 变量             | 用途                           |
| ---------------- | ------------------------------ |
| `--an-shadow-sm` | 顶栏标签、侧栏选中以外的轻浮起 |
| `--an-shadow-md` | 通知                           |
| `--an-shadow-lg` | 对话框、命令面板、搜索         |

阴影颜色用 `color-mix` 跟文字色走，所以只定义在 `:root`。

动效只有两档：`--an-motion-fast`（120ms）和 `--an-motion-base`（180ms），用在背景、文字色和边框上。不做法位移动画。`prefers-reduced-motion: reduce` 时过渡关掉。

焦点用 2px 强调色轮廓，`outline-offset: 2px`。不要去掉 `:focus-visible`。

## 布局

| 变量                         | 值    | 含义                       |
| ---------------------------- | ----- | -------------------------- |
| `--an-topbar-height`         | 48px  | 顶栏                       |
| `--an-statusbar-height`      | 32px  | 状态栏                     |
| `--an-sidebar-width`         | 260px | 左栏默认宽度               |
| `--an-sidebar-min-width`     | 200px | 左栏下限                   |
| `--an-sidebar-max-width`     | 400px | 左栏上限                   |
| `--an-ai-panel-width`        | 380px | 右侧面板默认宽度           |
| `--an-ai-panel-min-width`    | 300px | 右侧面板下限               |
| `--an-ai-panel-max-width`    | 560px | 右侧面板上限               |
| `--an-editor-max-width`      | 680px | 正文栏                     |
| `--an-command-palette-width` | 640px | 命令面板和搜索             |
| `--an-command-palette-top`   | 12%   | 面板距视口顶部             |
| `--an-breakpoint-compact`    | 900px | 窄于此宽度时左右栏改为抽屉 |

## 组件

基础控件在 `@ai-notes/ui`：`Button`、`IconButton`、`Input`、`Textarea`、`Select`、`Switch`、`Tabs`、`Tooltip`、`Dialog`、`Toast`、`CommandPalette`、`SearchResultItem`、`Panel`、`ChatMessage`、`SettingsRow`。

图标用 Lucide，线宽 1.5，尺寸 16 或 20。问答用对话框图标，不用火花。文件树用文件夹和文档图标。当前文件用淡强调色底和左侧 2px 标记，文字保持正文色。

提问是靠右的浅色气泡。回答是普通正文，不另做卡片。引用是带路径的小卡片，摘录最多三行。搜索和命令面板都是顶部浮层，宽 640px。

预览页：

```bash
pnpm --filter @ai-notes/ui-preview dev
```
