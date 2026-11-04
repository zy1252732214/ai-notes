import type { Disposable } from '../disposable.js';
import type { JsonSchemaObject } from '../json-schema.js';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * 回答引用的笔记位置。字段与 `messages.citations` JSON、索引里的 chunks 对齐。
 */
export interface Citation {
  notePath: string;
  chunkId?: string;
  headingPath?: readonly string[];
  startOffset?: number;
  endOffset?: number;
  quote?: string;
}

export interface ChatRequest {
  messages: readonly ChatMessage[];
  /** 当前笔记。宿主把它当作默认上下文。 */
  notePath?: string;
  /** 默认 true：检索 Vault 分块，并要求模型给出引用。 */
  retrieve?: boolean;
}

export interface ChatResult {
  message: ChatMessage;
  citations: readonly Citation[];
  model: string;
  provider: string;
}

export interface CompleteRequest {
  prompt: string;
  notePath?: string;
  retrieve?: boolean;
}

export interface CompleteResult {
  text: string;
  citations: readonly Citation[];
  model: string;
  provider: string;
}

export interface AiToolContext {
  callId: string;
}

export interface AiTool {
  name: string;
  description: string;
  /** 参数的 JSON Schema。宿主把它交给模型。 */
  parameters: JsonSchemaObject;
  /** 同进程直接调用。沙箱插件不传函数，改由宿主发 `ai.tool.call`。 */
  handler?: (args: unknown, ctx: AiToolContext) => unknown | Promise<unknown>;
}

/** 需要 `ai:invoke`。工具注册本身不消耗额度，模型真正调用工具时才计费。 */
export interface AiApi {
  chat(request: ChatRequest): Promise<ChatResult>;
  complete(request: CompleteRequest): Promise<CompleteResult>;
  /** 注册成助手可以调用的工具，例如查天气、建任务。 */
  registerTool(tool: AiTool): Disposable;
}
