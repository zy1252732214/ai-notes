import {
  createRpcError,
  createRpcResponse,
  findPermission,
  isPathWithinFolders,
  isPluginRpcRequest,
  isRpcEnvelope,
  type NoteEventType,
  type PluginManifest,
  type RpcFailure,
  type RpcResponse,
} from '@ai-notes/plugin-sdk';
import { authorize, type AuthorizeContext } from './authorize.js';
import type { PluginServices } from './services.js';

export interface RegisteredCommand {
  registrationId: string;
  id: string;
  name: string;
  hotkey?: string;
}

export interface RegisteredPanel {
  registrationId: string;
  id: string;
  title: string;
}

let registrationSeq = 0;

function nextRegistrationId(): string {
  registrationSeq += 1;
  return `reg-${registrationSeq}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * 一个插件的 RPC 会话。先做权限校验，通过后才调用 services。
 */
export class PluginSession {
  readonly commands = new Map<string, RegisteredCommand>();
  readonly panels: RegisteredPanel[] = [];
  private readonly subscriptions = new Map<string, NoteEventType>();
  private readonly context: AuthorizeContext;

  constructor(
    readonly manifest: PluginManifest,
    private readonly services: PluginServices,
    private readonly onChange: () => void = () => undefined,
    context: AuthorizeContext = {},
  ) {
    this.context = context;
  }

  listCommands(): readonly RegisteredCommand[] {
    return [...this.commands.values()];
  }

  wants(type: NoteEventType): boolean {
    return [...this.subscriptions.values()].includes(type);
  }

  async handle(message: unknown): Promise<RpcResponse | RpcFailure | null> {
    if (!isRpcEnvelope(message) || message.kind !== 'request') return null;
    const pluginId = this.manifest.id;
    if (message.pluginId !== pluginId) {
      return createRpcError(pluginId, message.id, {
        code: 'invalid_request',
        message: '插件 id 不匹配',
      });
    }
    if (!isPluginRpcRequest(message)) {
      return createRpcError(pluginId, message.id, {
        code: 'invalid_request',
        message: '未知方法',
      });
    }
    const decision = authorize(this.manifest.permissions ?? [], message, this.context);
    if (!decision.ok) {
      return createRpcError(pluginId, message.id, {
        code: decision.code,
        message: decision.message,
      });
    }
    try {
      const result = await this.dispatch(message.method, message.params);
      return createRpcResponse(pluginId, message.id, result);
    } catch (error) {
      return createRpcError(pluginId, message.id, {
        code: 'internal',
        message: error instanceof Error ? error.message : '插件调用失败',
      });
    }
  }

  private async dispatch(method: string, params: unknown): Promise<unknown> {
    const record = asRecord(params);
    switch (method) {
      case 'vault.read':
        return this.services.readNote(text(record.path));
      case 'vault.list':
        return this.services.listNotes(
          typeof record.folder === 'string' ? record.folder : undefined,
          record.recursive === true,
        );
      case 'vault.create':
        return this.services.createNote(
          text(record.path),
          text(record.content),
          record.overwrite === true,
        );
      case 'vault.modify':
        return this.services.modifyNote(text(record.path), text(record.content));
      case 'vault.delete':
        await this.services.deleteNote(text(record.path));
        return null;
      case 'vault.rename':
        await this.services.renameNote(text(record.from), text(record.to));
        return null;
      case 'vault.metadata':
        return this.services.metadata(text(record.path));
      case 'vault.search':
        return this.searchNotes(text(record.query), record.limit);
      case 'commands.register':
        return this.registerCommand(record);
      case 'commands.unregister':
        this.commands.delete(text(record.registrationId));
        this.onChange();
        return null;
      case 'views.registerSidebar':
      case 'views.registerTab':
        return this.registerPanel(record);
      case 'views.unregister':
        this.removePanel(text(record.registrationId));
        return null;
      case 'views.registerStatusBar':
      case 'views.registerSettings':
      case 'views.setStatusBarText':
        return method === 'views.setStatusBarText'
          ? null
          : { registrationId: nextRegistrationId() };
      case 'editor.getActive': {
        const active = this.services.activeNote();
        return active ? { notePath: active.path } : null;
      }
      case 'editor.getSelection':
        return this.services.activeNote()?.selection ?? '';
      case 'editor.getContent':
        return this.services.activeNote()?.content ?? '';
      case 'editor.replaceSelection':
        await this.services.replaceSelection(text(record.text));
        return null;
      case 'editor.insertAtCursor':
        await this.services.insertAtCursor(text(record.text));
        return null;
      case 'editor.registerCodeBlockRenderer':
      case 'editor.unregister':
      case 'ai.registerTool':
      case 'ai.unregisterTool':
        return method.endsWith('unregister') || method.endsWith('unregisterTool')
          ? null
          : { registrationId: nextRegistrationId() };
      case 'ai.chat':
        return this.services.chat({
          messages: Array.isArray(record.messages) ? record.messages : [],
        } as Parameters<PluginServices['chat']>[0]);
      case 'ai.complete':
        return this.services.complete({ prompt: text(record.prompt) });
      case 'events.subscribe':
        return this.subscribe(text(record.type) as NoteEventType);
      case 'events.unsubscribe':
        this.subscriptions.delete(text(record.subscriptionId));
        return null;
      case 'clipboard.read':
        return this.services.readClipboard();
      case 'clipboard.write':
        await this.services.writeClipboard(text(record.text));
        return null;
      case 'network.fetch':
        return this.services.fetch({
          url: text(record.url),
          ...(typeof record.method === 'string'
            ? { method: record.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' }
            : {}),
          ...(typeof record.body === 'string' ? { body: record.body } : {}),
        });
      default:
        throw new Error(`未知方法 ${method}`);
    }
  }

  private async searchNotes(query: string, limit: unknown) {
    const hits = await this.services.searchNotes(
      query,
      typeof limit === 'number' ? limit : undefined,
    );
    const folders = findPermission(this.manifest.permissions ?? [], 'vault:read')?.folders;
    return hits.filter((hit) => {
      try {
        return isPathWithinFolders(hit.path, folders);
      } catch {
        return false;
      }
    });
  }

  private registerCommand(record: Record<string, unknown>): { registrationId: string } {
    const registrationId = nextRegistrationId();
    const command: RegisteredCommand = {
      registrationId,
      id: text(record.id),
      name: text(record.name),
    };
    if (typeof record.hotkey === 'string') command.hotkey = record.hotkey;
    this.commands.set(registrationId, command);
    this.onChange();
    return { registrationId };
  }

  private registerPanel(record: Record<string, unknown>): { registrationId: string } {
    const registrationId = nextRegistrationId();
    this.panels.push({
      registrationId,
      id: text(record.id),
      title: text(record.title),
    });
    this.onChange();
    return { registrationId };
  }

  private removePanel(registrationId: string): null {
    const index = this.panels.findIndex((panel) => panel.registrationId === registrationId);
    if (index >= 0) this.panels.splice(index, 1);
    this.onChange();
    return null;
  }

  private subscribe(type: NoteEventType): { subscriptionId: string } {
    const subscriptionId = nextRegistrationId();
    this.subscriptions.set(subscriptionId, type);
    return { subscriptionId };
  }
}
