import type { Permission } from './permissions.js';
import type { NoteEventType } from './api/events.js';
import type { PluginApiVersion } from './version.js';

export interface PluginAuthor {
  name: string;
  url?: string;
  email?: string;
}

/** 命令面板里的静态声明。真正的回调在 onload 里 register。 */
export interface CommandContribution {
  id: string;
  name: string;
  /** 例如 `Mod+Shift+H`。Mod 在 macOS 上是 Command，在其他系统上是 Ctrl。 */
  hotkey?: string;
}

export type ViewContributionType = 'sidebar' | 'tab' | 'status-bar' | 'settings';

export interface ViewContribution {
  id: string;
  name: string;
  type: ViewContributionType;
  icon?: string;
}

export type EditorContributionKind = 'highlight' | 'completion' | 'keymap' | 'decoration' | 'other';

/** 声明编辑器扩展的意图。CodeMirror Extension 对象本身不能放进 manifest。 */
export interface EditorContribution {
  id: string;
  kind: EditorContributionKind;
}

export interface CodeBlockRendererContribution {
  /** 围栏语言标记，例如 `mermaid`。 */
  language: string;
}

export interface AiToolContribution {
  name: string;
  description: string;
}

export interface ImporterContribution {
  id: string;
  name: string;
  /** 能接收的文件扩展名，不含点，例如 `["html", "md"]`。 */
  extensions?: readonly string[];
}

export interface ExporterContribution {
  id: string;
  name: string;
  extensions?: readonly string[];
}

/**
 * manifest.contributes：宿主在执行插件之前就能看到的扩展点。
 * 运行时仍要调用对应的 register，静态声明不会自动生效。
 */
export interface PluginContributes {
  commands?: readonly CommandContribution[];
  views?: readonly ViewContribution[];
  editor?: readonly EditorContribution[];
  codeBlockRenderers?: readonly CodeBlockRendererContribution[];
  aiTools?: readonly AiToolContribution[];
  importers?: readonly ImporterContribution[];
  exporters?: readonly ExporterContribution[];
  events?: readonly NoteEventType[];
}

export interface PluginManifest {
  manifestVersion: 1;
  apiVersion: PluginApiVersion;
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  author?: string | PluginAuthor;
  description?: string;
  /** 相对插件目录的入口，例如 `main.js`。 */
  main: string;
  /** 相对插件目录的样式，例如 `styles.css`。 */
  styles?: string;
  permissions?: readonly Permission[];
  contributes?: PluginContributes;
}
