# @ai-notes/ui

ai-notes 的设计令牌和基础组件。令牌覆盖颜色、字体、间距、圆角、布局尺寸，以及深浅色切换。组件是一组 React 控件，颜色和尺寸只引用这些 `--an-*` 变量。

`tokens.css` 是令牌的唯一来源，桌面端通过 `@ai-notes/ui/tokens.css` 引用。`src/tokens.ts` 是同一套数值的类型化镜像，改令牌时两处一起改。完整说明在 [docs/design-system.md](../../docs/design-system.md)。组件样式在 `components.css`，文件开头会引入令牌。

```css
@import '@ai-notes/ui/tokens.css';
```

```ts
import { bindTheme, cssVar, cssVarNames } from '@ai-notes/ui';

const stop = bindTheme('system'); // 'system' | 'light' | 'dark'
document.body.style.color = cssVar(cssVarNames.color.textPrimary);
```

浅色变量写在 `:root`。深色变量写在 `[data-theme='dark']`。`bindTheme` 会把解析结果写到 `<html data-theme="light|dark">`：传 `'system'` 时跟随操作系统并在系统切换后更新；传 `'light'` 或 `'dark'` 时固定为手动主题。改偏好前先调用上一次返回的取消函数。

## 组件

```css
@import '@ai-notes/ui/components.css';
```

```tsx
import { Button, Dialog, ToastProvider, useToast } from '@ai-notes/ui';
```

只引用令牌的页面可以继续单独引入 `tokens.css`。用到组件时引入 `components.css` 即可，不必再引一次令牌。悬停和遮罩用 `color-mix` 从已有变量派生，不新增颜色。1px 边框是分隔线，不是间距令牌。

图标由调用方传入。沿用 Lucide，线宽 1.5，尺寸 16 或 20。`IconButton` 的 `label` 会写成 `aria-label`。

| 组件               | 做什么                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| `Button`           | `primary` / `secondary` / `ghost` / `danger`，尺寸 `md` / `sm`         |
| `IconButton`       | 图标按钮。`pressed` 为布尔值时带 `aria-pressed`                        |
| `Input`            | 单行输入。`label` 必填，`hint` 和 `error` 接到描述                     |
| `Textarea`         | 多行输入，关联方式和 `Input` 相同                                      |
| `Select`           | 按钮打开列表。方向键移动，Enter / Space 选中，Esc 关闭                 |
| `Switch`           | `role="switch"`。点按钮或文字都会切换                                  |
| `Tabs`             | 方向键、Home、End 移动，并跳过禁用项。`keepMounted` 保留未选中面板     |
| `Tooltip`          | 悬停或聚焦显示，Esc 关闭。子节点要能聚焦                               |
| `Dialog`           | 模态对话框。Esc、关闭按钮和点击遮罩都会关闭，Tab 在内部循环            |
| `Toast`            | `ToastProvider` + `useToast().push()`。错误是 `alert`，其余是 `status` |
| `CommandPalette`   | 顶部命令面板。输入过滤，上下选择，回车执行                             |
| `SearchResultItem` | 一条搜索结果。`active` 时设置 `aria-current`                           |
| `Panel`            | 可收起分区。标题按钮带 `aria-expanded`                                 |
| `ChatMessage`      | `user` / `assistant` 气泡，或 `citation` 引用卡片                      |
| `SettingsRow`      | 设置表单一行。`htmlFor` 把标签连到右侧控件                             |

`Input`、`Textarea`、`Select`、`Switch` 都可以把 `labelHidden` 设上，让标签只留给读屏。设置行自己有可见标签时用这个。

键盘和读屏：原生按钮保留 Enter / Space。对话框和命令面板打开时锁住背景滚动，关闭后把焦点还回去。危险通知使用 `role="alert"`，其他通知使用 `role="status"`。

预览页在 `apps/ui-preview`，同一页列出每个组件的默认、禁用、错误等状态，顶栏切换浅色、深色或跟随系统：

```bash
pnpm --filter @ai-notes/ui-preview dev
```

## 插件约定

插件样式必须使用这些 `--an-*` 变量，禁止写死颜色（十六进制、`rgb` / `hsl`、具名颜色都不行）。字号、字重、间距、圆角、布局宽度同样走令牌。这样深浅色切换和以后的主题调整才会一起生效。

图标沿用 Lucide，线宽 1.5px，尺寸用 16px 和 20px 两档。

## 颜色

| 变量                  | 用途                           | 浅色      | 深色      |
| --------------------- | ------------------------------ | --------- | --------- |
| `--an-bg-base`        | 编辑区背景                     | `#fbfaf8` | `#1c1b19` |
| `--an-bg-subtle`      | 侧栏、面板背景                 | `#f3f1ec` | `#242320` |
| `--an-bg-elevated`    | 弹窗、浮条、命令面板           | `#fffcf9` | `#2c2b28` |
| `--an-text-primary`   | 正文、标题                     | `#1c1917` | `#f4f1ea` |
| `--an-text-secondary` | 次要说明                       | `#57534e` | `#c4bfb4` |
| `--an-text-tertiary`  | 占位符、时间戳                 | `#8a847c` | `#8d877c` |
| `--an-border-default` | 分割线、输入框边框             | `#e6e1d8` | `#3a3834` |
| `--an-accent`         | 主按钮、链接、焦点             | `#3c6e62` | `#9dc7b8` |
| `--an-on-accent`      | 主按钮上的文字                 | `#fbfaf8` | `#14201c` |
| `--an-ai`             | 与强调色相同，问答不另做品牌色 | `#3c6e62` | `#9dc7b8` |
| `--an-ai-subtle`      | 引用和回答的浅底               | `#eef3f1` | `#24302c` |
| `--an-success`        | 同步成功、保存成功             | `#2f7d4a` | `#7dcea0` |
| `--an-warning`        | 需要注意                       | `#a16207` | `#e0b15a` |
| `--an-danger`         | 删除、错误、危险权限           | `#b42318` | `#f0a097` |

## 字体

界面字体 `--an-font-ui`：`-apple-system, BlinkMacSystemFont, 'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei', 'Segoe UI', sans-serif`。

代码字体 `--an-font-code`：`'JetBrains Mono', 'SF Mono', ui-monospace, 'Sarasa Mono SC', Menlo, Consolas, monospace`。

| 级别  | 字号 | 行高 | 字重 | 用途                 |
| ----- | ---- | ---- | ---- | -------------------- |
| H1    | 32px | 40px | 600  | 笔记标题             |
| H2    | 24px | 32px | 600  | 二级标题             |
| H3    | 18px | 28px | 600  | 三级标题             |
| Body  | 16px | 28px | 400  | 笔记正文             |
| UI    | 14px | 22px | 400  | 侧栏、按钮、菜单     |
| Small | 12px | 16px | 400  | 状态栏、时间戳、引用 |
| Code  | 13px | 22px | 400  | 代码块、行内代码     |

字号变量是 `--an-font-size-*`，行高是 `--an-line-*`，字重是 `--an-font-weight-*`。`*` 为 `h1`、`h2`、`h3`、`body`、`ui`、`small`、`code`。

## 间距与圆角

间距按 4px 栅格：`--an-space-1` 4px、`--an-space-2` 8px、`--an-space-3` 12px、`--an-space-4` 16px、`--an-space-6` 24px、`--an-space-8` 32px。

圆角：`--an-radius-sm` 6px、`--an-radius-md` 8px、`--an-radius-lg` 12px、`--an-radius-xl` 16px。

阴影：`--an-shadow-sm`、`--an-shadow-md`、`--an-shadow-lg`。颜色用 `color-mix` 从文字色派生，浅色和深色共用。

动效：`--an-motion-fast` 120ms、`--an-motion-base` 180ms。只用于颜色、背景和边框。`prefers-reduced-motion: reduce` 时关掉。

## 布局

| 变量                         | 值    | 含义                       |
| ---------------------------- | ----- | -------------------------- |
| `--an-topbar-height`         | 48px  | 顶栏高度                   |
| `--an-statusbar-height`      | 32px  | 状态栏高度                 |
| `--an-sidebar-width`         | 260px | 左栏默认宽度               |
| `--an-sidebar-min-width`     | 200px | 左栏可拖下限               |
| `--an-sidebar-max-width`     | 400px | 左栏可拖上限               |
| `--an-ai-panel-width`        | 380px | 右侧面板默认宽度           |
| `--an-ai-panel-min-width`    | 300px | 右侧面板可拖下限           |
| `--an-ai-panel-max-width`    | 560px | 右侧面板可拖上限           |
| `--an-editor-max-width`      | 680px | 编辑区正文最大宽度         |
| `--an-command-palette-width` | 640px | 命令面板宽度               |
| `--an-command-palette-top`   | 12%   | 命令面板距顶部             |
| `--an-breakpoint-compact`    | 900px | 窄于此宽度时左右栏改为抽屉 |
