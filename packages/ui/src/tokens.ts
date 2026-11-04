/**
 * 设计令牌的类型化镜像，数值与 `tokens.css` 中的 `--an-*` 变量一致。
 * 插件不要写死颜色，样式里使用 `var(--an-*)`，脚本里用 `cssVar()`。
 */

type ColorScale = {
  readonly bgBase: string;
  readonly bgSubtle: string;
  readonly bgElevated: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textTertiary: string;
  readonly borderDefault: string;
  readonly accent: string;
  readonly ai: string;
  readonly aiSubtle: string;
  readonly success: string;
  readonly warning: string;
  readonly danger: string;
};

type TypeStyle = {
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly fontWeight: 400 | 600;
};

export const colors = {
  light: {
    bgBase: "#FFFFFF",
    bgSubtle: "#F6F6F7",
    bgElevated: "#FFFFFF",
    textPrimary: "#1F1F23",
    textSecondary: "#5C5C66",
    textTertiary: "#8E8E99",
    borderDefault: "#E4E4E8",
    accent: "#5B5BD6",
    ai: "#8E4EC6",
    aiSubtle: "#F5EEFC",
    success: "#2F9E5B",
    warning: "#C98A1A",
    danger: "#D14343",
  },
  dark: {
    bgBase: "#1E1E20",
    bgSubtle: "#252528",
    bgElevated: "#2D2D31",
    textPrimary: "#E8E8EA",
    textSecondary: "#A6A6B0",
    textTertiary: "#74747E",
    borderDefault: "#38383D",
    accent: "#7C7CF0",
    ai: "#B07FE8",
    aiSubtle: "#2E2338",
    success: "#4CC47E",
    warning: "#E5A93A",
    danger: "#F06A6A",
  },
} as const satisfies Record<"light" | "dark", ColorScale>;

export const fontFamily = {
  sans: '-apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", Menlo, monospace',
} as const;

export const typeScale = {
  h1: { fontSize: "28px", lineHeight: "36px", fontWeight: 600 },
  h2: { fontSize: "22px", lineHeight: "30px", fontWeight: 600 },
  h3: { fontSize: "18px", lineHeight: "26px", fontWeight: 600 },
  body: { fontSize: "16px", lineHeight: "26px", fontWeight: 400 },
  ui: { fontSize: "14px", lineHeight: "20px", fontWeight: 400 },
  small: { fontSize: "12px", lineHeight: "16px", fontWeight: 400 },
  code: { fontSize: "14px", lineHeight: "22px", fontWeight: 400 },
} as const satisfies Record<string, TypeStyle>;

/** 4px 栅格。步骤为 1 / 2 / 3 / 4 / 6 / 8，对应 4–32px。 */
export const space = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  6: "24px",
  8: "32px",
} as const;

export const radius = {
  sm: "4px",
  md: "8px",
  lg: "12px",
} as const;

export const layout = {
  topbarHeight: "44px",
  sidebarWidth: "240px",
  sidebarMinWidth: "180px",
  sidebarMaxWidth: "400px",
  aiPanelWidth: "360px",
  aiPanelMinWidth: "300px",
  aiPanelMaxWidth: "560px",
  editorMaxWidth: "720px",
  commandPaletteWidth: "640px",
  /** 命令面板距视口顶部的位置。 */
  commandPaletteTop: "20%",
  /** 低于该宽度时，左右栏改为抽屉。 */
  compactBreakpoint: "900px",
} as const;

export const cssVarNames = {
  color: {
    bgBase: "--an-bg-base",
    bgSubtle: "--an-bg-subtle",
    bgElevated: "--an-bg-elevated",
    textPrimary: "--an-text-primary",
    textSecondary: "--an-text-secondary",
    textTertiary: "--an-text-tertiary",
    borderDefault: "--an-border-default",
    accent: "--an-accent",
    ai: "--an-ai",
    aiSubtle: "--an-ai-subtle",
    success: "--an-success",
    warning: "--an-warning",
    danger: "--an-danger",
  },
  fontFamily: {
    sans: "--an-font-sans",
    mono: "--an-font-mono",
  },
  fontSize: {
    h1: "--an-font-size-h1",
    h2: "--an-font-size-h2",
    h3: "--an-font-size-h3",
    body: "--an-font-size-body",
    ui: "--an-font-size-ui",
    small: "--an-font-size-small",
    code: "--an-font-size-code",
  },
  lineHeight: {
    h1: "--an-line-height-h1",
    h2: "--an-line-height-h2",
    h3: "--an-line-height-h3",
    body: "--an-line-height-body",
    ui: "--an-line-height-ui",
    small: "--an-line-height-small",
    code: "--an-line-height-code",
  },
  fontWeight: {
    h1: "--an-font-weight-h1",
    h2: "--an-font-weight-h2",
    h3: "--an-font-weight-h3",
    body: "--an-font-weight-body",
    ui: "--an-font-weight-ui",
    small: "--an-font-weight-small",
    code: "--an-font-weight-code",
  },
  space: {
    1: "--an-space-1",
    2: "--an-space-2",
    3: "--an-space-3",
    4: "--an-space-4",
    6: "--an-space-6",
    8: "--an-space-8",
  },
  radius: {
    sm: "--an-radius-sm",
    md: "--an-radius-md",
    lg: "--an-radius-lg",
  },
  layout: {
    topbarHeight: "--an-topbar-height",
    sidebarWidth: "--an-sidebar-width",
    sidebarMinWidth: "--an-sidebar-min-width",
    sidebarMaxWidth: "--an-sidebar-max-width",
    aiPanelWidth: "--an-ai-panel-width",
    aiPanelMinWidth: "--an-ai-panel-min-width",
    aiPanelMaxWidth: "--an-ai-panel-max-width",
    editorMaxWidth: "--an-editor-max-width",
    commandPaletteWidth: "--an-command-palette-width",
    commandPaletteTop: "--an-command-palette-top",
    compactBreakpoint: "--an-breakpoint-compact",
  },
} as const;

type ValueOf<T> = T[keyof T];

export type ThemeName = keyof typeof colors;
export type ColorToken = keyof typeof colors.light;
export type TypeLevel = keyof typeof typeScale;
export type SpaceToken = keyof typeof space;
export type RadiusToken = keyof typeof radius;
export type LayoutToken = keyof typeof layout;
export type CssVarName =
  | ValueOf<typeof cssVarNames.color>
  | ValueOf<typeof cssVarNames.fontFamily>
  | ValueOf<typeof cssVarNames.fontSize>
  | ValueOf<typeof cssVarNames.lineHeight>
  | ValueOf<typeof cssVarNames.fontWeight>
  | ValueOf<typeof cssVarNames.space>
  | ValueOf<typeof cssVarNames.radius>
  | ValueOf<typeof cssVarNames.layout>;

export const tokens = {
  colors,
  fontFamily,
  typeScale,
  space,
  radius,
  layout,
  cssVarNames,
} as const;

/** 把令牌名转成 `var(--an-*)`，避免在脚本里拼写变量名。 */
export function cssVar<T extends CssVarName>(name: T): `var(${T})` {
  return `var(${name})`;
}
