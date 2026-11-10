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
  readonly borderSubtle: string;
  readonly borderControl: string;
  readonly accent: string;
  readonly ai: string;
  readonly aiSubtle: string;
  readonly success: string;
  readonly warning: string;
  readonly danger: string;
  readonly onAccent: string;
  readonly selection: string;
};

type TypeStyle = {
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly fontWeight: 400 | 600;
};

export const colors = {
  light: {
    bgBase: '#fbfaf8',
    bgSubtle: '#f3f1ec',
    bgElevated: '#fffcf9',
    textPrimary: '#1c1917',
    textSecondary: '#57534e',
    textTertiary: '#736d61',
    borderSubtle: '#e6e1d8',
    borderControl: '#948a7f',
    accent: '#3c6e62',
    ai: '#3c6e62',
    aiSubtle: '#eef3f1',
    success: '#2c7c4a',
    warning: '#9c6005',
    danger: '#b42318',
    onAccent: '#fbfaf8',
    selection: '#6f9389',
  },
  dark: {
    bgBase: '#1c1b19',
    bgSubtle: '#242320',
    bgElevated: '#2c2b28',
    textPrimary: '#f4f1ea',
    textSecondary: '#c4bfb4',
    textTertiary: '#9b917f',
    borderSubtle: '#3a3834',
    borderControl: '#7d7368',
    accent: '#9dc7b8',
    ai: '#9dc7b8',
    aiSubtle: '#24302c',
    success: '#7dcea0',
    warning: '#e0b15a',
    danger: '#f0a097',
    onAccent: '#14201c',
    selection: '#5c7168',
  },
} as const satisfies Record<'light' | 'dark', ColorScale>;

export const fontFamily = {
  ui: "-apple-system, BlinkMacSystemFont, 'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei', 'Segoe UI', sans-serif",
  code: "'JetBrains Mono', 'SF Mono', ui-monospace, 'Sarasa Mono SC', Menlo, Consolas, monospace",
} as const;

export const typeScale = {
  h1: { fontSize: '32px', lineHeight: '40px', fontWeight: 600 },
  h2: { fontSize: '24px', lineHeight: '32px', fontWeight: 600 },
  h3: { fontSize: '18px', lineHeight: '28px', fontWeight: 600 },
  body: { fontSize: '16px', lineHeight: '28px', fontWeight: 400 },
  ui: { fontSize: '14px', lineHeight: '22px', fontWeight: 400 },
  small: { fontSize: '12px', lineHeight: '16px', fontWeight: 400 },
  code: { fontSize: '13px', lineHeight: '22px', fontWeight: 400 },
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
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
} as const;

/** 阴影用 color-mix 跟随文字色，浅色和深色不用两套数值。 */
export const shadow = {
  sm: '0 1px 2px color-mix(in srgb, var(--an-text-primary) 6%, transparent)',
  md: '0 8px 24px color-mix(in srgb, var(--an-text-primary) 8%, transparent)',
  lg: '0 24px 48px color-mix(in srgb, var(--an-text-primary) 14%, transparent)',
} as const;

/** 只用于颜色、背景和边框。位移和弹性动画不使用。 */
export const motion = {
  fast: '120ms ease',
  base: '180ms ease',
} as const;

export const layout = {
  topbarHeight: '48px',
  statusbarHeight: '32px',
  sidebarWidth: '260px',
  sidebarMinWidth: '200px',
  sidebarMaxWidth: '400px',
  aiPanelWidth: '380px',
  aiPanelMinWidth: '300px',
  aiPanelMaxWidth: '560px',
  editorMaxWidth: '680px',
  commandPaletteWidth: '640px',
  /** 命令面板距视口顶部的位置。 */
  commandPaletteTop: '12%',
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
    borderSubtle: '--an-border-subtle',
    borderControl: '--an-border-control',
    accent: '--an-accent',
    ai: '--an-ai',
    aiSubtle: '--an-ai-subtle',
    success: '--an-success',
    warning: '--an-warning',
    danger: '--an-danger',
    onAccent: '--an-on-accent',
    selection: '--an-selection',
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
    xl: '--an-radius-xl',
  },
  shadow: {
    sm: '--an-shadow-sm',
    md: '--an-shadow-md',
    lg: '--an-shadow-lg',
  },
  motion: {
    fast: '--an-motion-fast',
    base: '--an-motion-base',
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
export type ShadowToken = keyof typeof shadow;
export type MotionToken = keyof typeof motion;
export type LayoutToken = keyof typeof layout;
export type CssVarName =
  | ValueOf<typeof cssVarNames.color>
  | ValueOf<typeof cssVarNames.fontFamily>
  | ValueOf<typeof cssVarNames.fontSize>
  | ValueOf<typeof cssVarNames.lineHeight>
  | ValueOf<typeof cssVarNames.fontWeight>
  | ValueOf<typeof cssVarNames.space>
  | ValueOf<typeof cssVarNames.radius>
  | ValueOf<typeof cssVarNames.shadow>
  | ValueOf<typeof cssVarNames.motion>
  | ValueOf<typeof cssVarNames.layout>;

export const tokens = {
  colors,
  fontFamily,
  typeScale,
  space,
  radius,
  shadow,
  motion,
  layout,
  cssVarNames,
} as const;

/** 把令牌名转成 `var(--an-*)`，避免在脚本里拼写变量名。 */
export function cssVar<T extends CssVarName>(name: T): `var(${T})` {
  return `var(${name})`;
}
