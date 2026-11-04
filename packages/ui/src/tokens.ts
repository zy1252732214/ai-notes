/**
 * 设计令牌的类型化镜像。变量名和数值必须与 tokens.css 一致。
 * 桌面端已经在用这套 --an-* 名字，不要另起一套。
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
  readonly onAccent: string;
};

type TypeStyle = {
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly fontWeight: 400 | 600;
};

export const colors = {
  light: {
    bgBase: '#ffffff',
    bgSubtle: '#f6f6f7',
    bgElevated: '#ffffff',
    textPrimary: '#1f1f23',
    textSecondary: '#5c5c66',
    textTertiary: '#8e8e99',
    borderDefault: '#e4e4e8',
    accent: '#5b5bd6',
    ai: '#8e4ec6',
    aiSubtle: '#f5eefc',
    success: '#2f9e5b',
    warning: '#c98a1a',
    danger: '#d14343',
    onAccent: '#ffffff',
  },
  dark: {
    bgBase: '#1e1e20',
    bgSubtle: '#252528',
    bgElevated: '#2d2d31',
    textPrimary: '#e8e8ea',
    textSecondary: '#a6a6b0',
    textTertiary: '#74747e',
    borderDefault: '#38383d',
    accent: '#7c7cf0',
    ai: '#b07fe8',
    aiSubtle: '#2e2338',
    success: '#4cc47e',
    warning: '#e5a93a',
    danger: '#f06a6a',
    onAccent: '#ffffff',
  },
} as const satisfies Record<'light' | 'dark', ColorScale>;

export const fontFamily = {
  ui: "-apple-system, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif",
  code: "'JetBrains Mono', Menlo, monospace",
} as const;

export const typeScale = {
  h1: { fontSize: '28px', lineHeight: '36px', fontWeight: 600 },
  h2: { fontSize: '22px', lineHeight: '30px', fontWeight: 600 },
  h3: { fontSize: '18px', lineHeight: '26px', fontWeight: 600 },
  body: { fontSize: '16px', lineHeight: '26px', fontWeight: 400 },
  ui: { fontSize: '14px', lineHeight: '20px', fontWeight: 400 },
  small: { fontSize: '12px', lineHeight: '16px', fontWeight: 400 },
  code: { fontSize: '14px', lineHeight: '22px', fontWeight: 400 },
} as const satisfies Record<string, TypeStyle>;

/** 4px 栅格。步骤为 1 / 2 / 3 / 4 / 6 / 8，对应 4–32px。 */
export const space = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  6: '24px',
  8: '32px',
} as const;

export const radius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
} as const;

export const layout = {
  topbarHeight: '44px',
  statusbarHeight: '28px',
  sidebarWidth: '240px',
  sidebarMinWidth: '180px',
  sidebarMaxWidth: '400px',
  aiPanelWidth: '360px',
  aiPanelMinWidth: '300px',
  aiPanelMaxWidth: '560px',
  editorMaxWidth: '720px',
  commandPaletteWidth: '640px',
  /** 命令面板距视口顶部的位置。 */
  commandPaletteTop: '20%',
  /** 低于该宽度时，左右栏改为抽屉。 */
  compactBreakpoint: '900px',
} as const;

export const cssVarNames = {
  color: {
    bgBase: '--an-bg-base',
    bgSubtle: '--an-bg-subtle',
    bgElevated: '--an-bg-elevated',
    textPrimary: '--an-text-primary',
    textSecondary: '--an-text-secondary',
    textTertiary: '--an-text-tertiary',
    borderDefault: '--an-border-default',
    accent: '--an-accent',
    ai: '--an-ai',
    aiSubtle: '--an-ai-subtle',
    success: '--an-success',
    warning: '--an-warning',
    danger: '--an-danger',
    onAccent: '--an-on-accent',
  },
  fontFamily: {
    ui: '--an-font-ui',
    code: '--an-font-code',
  },
  fontSize: {
    h1: '--an-font-size-h1',
    h2: '--an-font-size-h2',
    h3: '--an-font-size-h3',
    body: '--an-font-size-body',
    ui: '--an-font-size-ui',
    small: '--an-font-size-small',
    code: '--an-font-size-code',
  },
  lineHeight: {
    h1: '--an-line-h1',
    h2: '--an-line-h2',
    h3: '--an-line-h3',
    body: '--an-line-body',
    ui: '--an-line-ui',
    small: '--an-line-small',
    code: '--an-line-code',
  },
  fontWeight: {
    h1: '--an-font-weight-h1',
    h2: '--an-font-weight-h2',
    h3: '--an-font-weight-h3',
    body: '--an-font-weight-body',
    ui: '--an-font-weight-ui',
    small: '--an-font-weight-small',
    code: '--an-font-weight-code',
  },
  space: {
    1: '--an-space-1',
    2: '--an-space-2',
    3: '--an-space-3',
    4: '--an-space-4',
    6: '--an-space-6',
    8: '--an-space-8',
  },
  radius: {
    sm: '--an-radius-sm',
    md: '--an-radius-md',
    lg: '--an-radius-lg',
  },
  layout: {
    topbarHeight: '--an-topbar-height',
    statusbarHeight: '--an-statusbar-height',
    sidebarWidth: '--an-sidebar-width',
    sidebarMinWidth: '--an-sidebar-min-width',
    sidebarMaxWidth: '--an-sidebar-max-width',
    aiPanelWidth: '--an-ai-panel-width',
    aiPanelMinWidth: '--an-ai-panel-min-width',
    aiPanelMaxWidth: '--an-ai-panel-max-width',
    editorMaxWidth: '--an-editor-max-width',
    commandPaletteWidth: '--an-command-palette-width',
    commandPaletteTop: '--an-command-palette-top',
    compactBreakpoint: '--an-breakpoint-compact',
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
