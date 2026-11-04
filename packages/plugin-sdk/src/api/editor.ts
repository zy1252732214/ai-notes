import type { Disposable } from '../disposable.js';

/**
 * CodeMirror 6 的 Extension。
 * SDK 不依赖 `@codemirror/state`，所以这里保持结构化不透明。
 * 同进程插件可以直接传入真实 Extension。
 * 沙箱插件不能把 Extension 放进 postMessage；代码块渲染走 `registerCodeBlockRenderer`。
 */
export type CodeMirrorExtension = object | readonly object[];

export interface EditorExtensionRegistration {
  id: string;
  extension: CodeMirrorExtension;
}

export interface CodeBlockContext {
  notePath: string;
  language: string;
}

export interface CodeBlockRenderResult {
  /** 宿主会消毒后再插入页面。 */
  html: string;
}

export interface CodeBlockRenderer {
  id: string;
  language: string;
  render: (
    source: string,
    ctx: CodeBlockContext,
  ) => CodeBlockRenderResult | Promise<CodeBlockRenderResult>;
}

/** 当前活动编辑器。读取正文需要 `vault:read`，改写需要 `vault:write`。 */
export interface EditorHandle {
  readonly notePath: string;
  getSelection(): Promise<string>;
  getContent(): Promise<string>;
  replaceSelection(text: string): Promise<void>;
  insertAtCursor(text: string): Promise<void>;
}

export interface EditorApi {
  /**
   * 注册 CodeMirror 扩展。preview v1 仅同进程插件可用。
   * 沙箱调用会得到 `not_supported`。
   */
  registerExtension(registration: EditorExtensionRegistration): Disposable;

  /** 按围栏语言注册代码块渲染器。沙箱通过 RPC 接收源码并返回 HTML。 */
  registerCodeBlockRenderer(renderer: CodeBlockRenderer): Disposable;

  /** 没有打开的编辑器时返回 null。 */
  getActiveEditor(): Promise<EditorHandle | null>;
}
