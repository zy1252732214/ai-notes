import type { AiApi } from './ai.js';
import type { ClipboardApi } from './clipboard.js';
import type { CommandsApi } from './commands.js';
import type { EditorApi } from './editor.js';
import type { EventsApi } from './events.js';
import type { NetworkApi } from './network.js';
import type { VaultApi } from './vault.js';
import type { ViewsApi } from './views.js';

/** 插件可见的宿主表面。分组之外没有别的入口。 */
export interface AppApi {
  readonly vault: VaultApi;
  readonly commands: CommandsApi;
  readonly views: ViewsApi;
  readonly editor: EditorApi;
  readonly ai: AiApi;
  readonly events: EventsApi;
  readonly clipboard: ClipboardApi;
  readonly network: NetworkApi;
}
