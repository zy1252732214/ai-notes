import {
  createRpcRequest,
  type PluginRpcRequest,
  type PluginToHostMethod,
} from '@ai-notes/plugin-sdk';

/** 宿主侧引用：按方法名收窄 params。新增 RPC 方法时这里会编译失败。 */
export function describeRequest(request: PluginRpcRequest): string {
  switch (request.method) {
    case 'vault.read':
    case 'vault.modify':
    case 'vault.delete':
    case 'vault.metadata':
      return request.params.path;
    case 'vault.list':
      return request.params.folder ?? '';
    case 'vault.create':
      return request.params.path;
    case 'vault.rename':
      return `${request.params.from} -> ${request.params.to}`;
    case 'vault.search':
      return request.params.query;
    case 'commands.register':
      return request.params.id;
    case 'commands.unregister':
    case 'views.unregister':
    case 'editor.unregister':
    case 'ai.unregisterTool':
      return request.params.registrationId;
    case 'views.registerSidebar':
    case 'views.registerTab':
    case 'views.registerSettings':
    case 'views.registerStatusBar':
    case 'views.setStatusBarText':
      return request.params.id;
    case 'editor.registerCodeBlockRenderer':
      return request.params.language;
    case 'editor.getActive':
    case 'editor.getSelection':
    case 'editor.getContent':
    case 'clipboard.read':
      return request.method;
    case 'editor.replaceSelection':
    case 'editor.insertAtCursor':
    case 'clipboard.write':
      return request.params.text;
    case 'ai.chat':
      return String(request.params.messages.length);
    case 'ai.complete':
      return request.params.prompt;
    case 'ai.registerTool':
      return request.params.name;
    case 'events.subscribe':
      return request.params.type;
    case 'events.unsubscribe':
      return request.params.subscriptionId;
    case 'network.fetch':
      return request.params.url;
    default: {
      const unreachable: never = request;
      return unreachable;
    }
  }
}

const method = 'vault.read' satisfies PluginToHostMethod;

export const sampleRead = createRpcRequest('hello-notes', 'req-1', method, {
  path: '日记/今天.md',
});
