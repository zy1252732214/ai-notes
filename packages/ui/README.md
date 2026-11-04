# @ai-notes/ui

ai-notes 的设计令牌。本包目前提供颜色、字体、间距、圆角、布局尺寸，以及深浅色切换。按钮等基础组件后续再加入。

`tokens.css` 是唯一来源，桌面端通过 `@ai-notes/ui/tokens.css` 引用。`src/tokens.ts` 是同一套数值的类型化镜像，改令牌时两处一起改。

```css
@import '@ai-notes/ui/tokens.css';
```

```ts
import { bindTheme, cssVar, cssVarNames } from '@ai-notes/ui';

const stop = bindTheme('system'); // 'system' | 'light' | 'dark'
document.body.style.color = cssVar(cssVarNames.color.textPrimary);
```

浅色变量写在 `:root`。深色变量写在 `[data-theme='dark']`。`bindTheme` 会把解析结果写到 `<html data-theme="light|dark">`：传 `'system'` 时跟随操作系统并在系统切换后更新；传 `'light'` 或 `'dark'` 时固定为手动主题。改偏好前先调用上一次返回的取消函数。

## 插件约定

插件样式必须使用这些 `--an-*` 变量，禁止写死颜色（十六进制、`rgb` / `hsl`、具名颜色都不行）。字号、字重、间距、圆角、布局宽度同样走令牌。这样深浅色切换和以后的主题调整才会一起生效。

图标沿用 Lucide，线宽 1.5px，尺寸用 16px 和 20px 两档。

## 颜色

| 变量                  | 用途                     | 浅色      | 深色      |
| --------------------- | ------------------------ | --------- | --------- |
| `--an-bg-base`        | 编辑区背景               | `#ffffff` | `#1e1e20` |
| `--an-bg-subtle`      | 侧栏、面板背景           | `#f6f6f7` | `#252528` |
| `--an-bg-elevated`    | 弹窗、浮条、命令面板     | `#ffffff` | `#2d2d31` |
| `--an-text-primary`   | 正文、标题               | `#1f1f23` | `#e8e8ea` |
| `--an-text-secondary` | 次要说明                 | `#5c5c66` | `#a6a6b0` |
| `--an-text-tertiary`  | 占位符、时间戳           | `#8e8e99` | `#74747e` |
| `--an-border-default` | 分割线、输入框边框       | `#e4e4e8` | `#38383d` |
| `--an-accent`         | 品牌色、主按钮、链接     | `#5b5bd6` | `#7c7cf0` |
| `--an-on-accent`      | 主按钮上的文字           | `#ffffff` | `#ffffff` |
| `--an-ai`             | AI 生成内容、AI 面板强调 | `#8e4ec6` | `#b07fe8` |
| `--an-ai-subtle`      | AI 内容底色              | `#f5eefc` | `#2e2338` |
| `--an-success`        | 同步成功、保存成功       | `#2f9e5b` | `#4cc47e` |
| `--an-warning`        | 需要注意                 | `#c98a1a` | `#e5a93a` |
| `--an-danger`         | 删除、错误、危险权限     | `#d14343` | `#f06a6a` |

## 字体

界面字体 `--an-font-ui`：`-apple-system, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif`。

代码字体 `--an-font-code`：`'JetBrains Mono', Menlo, monospace`。

| 级别  | 字号 | 行高 | 字重 | 用途                 |
| ----- | ---- | ---- | ---- | -------------------- |
| H1    | 28px | 36px | 600  | 笔记标题             |
| H2    | 22px | 30px | 600  | 二级标题             |
| H3    | 18px | 26px | 600  | 三级标题             |
| Body  | 16px | 26px | 400  | 笔记正文             |
| UI    | 14px | 20px | 400  | 侧栏、按钮、菜单     |
| Small | 12px | 16px | 400  | 状态栏、时间戳、引用 |
| Code  | 14px | 22px | 400  | 代码块、行内代码     |

字号变量是 `--an-font-size-*`，行高是 `--an-line-*`，字重是 `--an-font-weight-*`。`*` 为 `h1`、`h2`、`h3`、`body`、`ui`、`small`、`code`。

## 间距与圆角

间距按 4px 栅格：`--an-space-1` 4px、`--an-space-2` 8px、`--an-space-3` 12px、`--an-space-4` 16px、`--an-space-6` 24px、`--an-space-8` 32px。

圆角：`--an-radius-sm` 4px、`--an-radius-md` 8px、`--an-radius-lg` 12px。

## 布局

| 变量                         | 值    | 含义                       |
| ---------------------------- | ----- | -------------------------- |
| `--an-topbar-height`         | 44px  | 顶栏高度                   |
| `--an-statusbar-height`      | 28px  | 状态栏高度                 |
| `--an-sidebar-width`         | 240px | 左栏默认宽度               |
| `--an-sidebar-min-width`     | 180px | 左栏可拖下限               |
| `--an-sidebar-max-width`     | 400px | 左栏可拖上限               |
| `--an-ai-panel-width`        | 360px | AI 面板默认宽度            |
| `--an-ai-panel-min-width`    | 300px | AI 面板可拖下限            |
| `--an-ai-panel-max-width`    | 560px | AI 面板可拖上限            |
| `--an-editor-max-width`      | 720px | 编辑区正文最大宽度         |
| `--an-command-palette-width` | 640px | 命令面板宽度               |
| `--an-command-palette-top`   | 20%   | 命令面板距顶部             |
| `--an-breakpoint-compact`    | 900px | 窄于此宽度时左右栏改为抽屉 |
