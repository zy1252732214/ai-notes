/**
 * 设计令牌、主题，以及只用 `--an-*` 变量的基础组件。
 * 组件样式在 `@ai-notes/ui/components.css`（里面会带上 tokens.css）。
 */
export {
  colors,
  cssVar,
  cssVarNames,
  fontFamily,
  layout,
  motion,
  radius,
  shadow,
  space,
  tokens,
  typeScale,
} from './tokens.js';
export type {
  ColorToken,
  CssVarName,
  LayoutToken,
  MotionToken,
  RadiusToken,
  ShadowToken,
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

export {
  Button,
  ChatMessage,
  CommandPalette,
  Dialog,
  IconButton,
  Input,
  Panel,
  SearchResultItem,
  Select,
  SettingsRow,
  Switch,
  Tabs,
  Textarea,
  ToastProvider,
  Tooltip,
  useToast,
} from './components/index.js';
export type {
  ButtonProps,
  ButtonSize,
  ButtonVariant,
  ChatCitation,
  ChatMessageProps,
  CommandItem,
  CommandPaletteProps,
  DialogProps,
  IconButtonProps,
  IconButtonSize,
  IconButtonVariant,
  InputProps,
  PanelProps,
  SearchResultItemProps,
  SelectOption,
  SelectProps,
  SettingsRowProps,
  SwitchProps,
  TabItem,
  TabsProps,
  TextareaProps,
  ToastInput,
  ToastTone,
  TooltipProps,
} from './components/index.js';

/** 工作区依赖图仍引用这个 id。 */
export const packageId = '@ai-notes/ui' as const;
