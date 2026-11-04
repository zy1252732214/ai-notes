/**
 * 设计令牌与主题。基础组件后续再加入。
 */
export {
  colors,
  cssVar,
  cssVarNames,
  fontFamily,
  layout,
  radius,
  space,
  tokens,
  typeScale,
} from './tokens.js';
export type {
  ColorToken,
  CssVarName,
  LayoutToken,
  RadiusToken,
  SpaceToken,
  ThemeName,
  TypeLevel,
} from './tokens.js';

export {
  THEME_ATTRIBUTE,
  applyTheme,
  bindTheme,
  getSystemTheme,
  readAppliedTheme,
  resolveTheme,
  subscribeSystemTheme,
} from './theme.js';
export type { ResolvedTheme, ThemePreference } from './theme.js';

/** 工作区依赖图仍引用这个 id。 */
export const packageId = '@ai-notes/ui' as const;
