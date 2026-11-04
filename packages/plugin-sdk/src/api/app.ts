import type { AiApi } from "./ai.ts";
import type { ClipboardApi } from "./clipboard.ts";
import type { CommandsApi } from "./commands.ts";
import type { EditorApi } from "./editor.ts";
import type { EventsApi } from "./events.ts";
import type { NetworkApi } from "./network.ts";
import type { VaultApi } from "./vault.ts";
import type { ViewsApi } from "./views.ts";

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
