import {
  PLUGIN_API_VERSION,
  RPC_PROTOCOL,
  createRpcEvent,
  createRpcId,
  isRpcEnvelope,
  type NoteEvent,
  type PluginManifest,
} from '@ai-notes/plugin-sdk';
import {
  discoverPlugins,
  readDisabledIds,
  writeDisabledIds,
  type DiscoveredPlugin,
} from './discover.js';
import { buildSandboxSrcdoc } from './sandbox.js';
import { PluginSession, type RegisteredCommand, type RegisteredPanel } from './session.js';
import type { PluginServices } from './services.js';
import type { PluginStorage } from './storage.js';

export interface PluginCommandSnapshot {
  id: string;
  name: string;
  hotkey?: string;
  pluginId: string;
}

export interface PluginPanelSnapshot {
  id: string;
  title: string;
  pluginId: string;
}

export interface PluginItemSnapshot {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  permissions: readonly string[];
  error: string | null;
  srcdoc: string | null;
  commands: readonly PluginCommandSnapshot[];
  panels: readonly PluginPanelSnapshot[];
  status: 'disabled' | 'loading' | 'ready' | 'error';
}

export interface PluginSnapshot {
  items: readonly PluginItemSnapshot[];
}

const EMPTY: PluginSnapshot = { items: [] };

interface LivePlugin {
  manifest: PluginManifest;
  session: PluginSession;
  post: (message: unknown) => void;
}

function commandSnapshot(pluginId: string, command: RegisteredCommand): PluginCommandSnapshot {
  const snapshot: PluginCommandSnapshot = {
    id: command.id,
    name: command.name,
    pluginId,
  };
  if (command.hotkey) snapshot.hotkey = command.hotkey;
  return snapshot;
}

function panelSnapshot(pluginId: string, panel: RegisteredPanel): PluginPanelSnapshot {
  return { id: panel.id, title: panel.title, pluginId };
}

/**
 * 已发现插件的启用状态、沙箱文档和 RPC 会话。
 * 界面用 subscribe 订阅快照；iframe 用 setPoster 把回复送回沙箱。
 */
export class PluginController {
  private snapshot: PluginSnapshot = EMPTY;
  private readonly listeners = new Set<() => void>();
  private readonly live = new Map<string, LivePlugin>();
  private storage: PluginStorage | null = null;
  private services: PluginServices | null = null;
  private discovered: DiscoveredPlugin[] = [];
  private disabled = new Set<string>();
  private onLog: (message: string) => void = () => undefined;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): PluginSnapshot => this.snapshot;

  async attach(
    storage: PluginStorage,
    services: PluginServices,
    hooks?: { onLog?: (message: string) => void },
  ): Promise<void> {
    this.detach();
    this.storage = storage;
    this.services = services;
    this.onLog = hooks?.onLog ?? (() => undefined);
    this.discovered = await discoverPlugins(storage);
    this.disabled = await readDisabledIds(storage);
    this.rebuild();
  }

  detach(): void {
    for (const plugin of this.live.values()) {
      plugin.post(createRpcEvent(plugin.manifest.id, createRpcId(), 'lifecycle:unload', {}));
    }
    this.live.clear();
    this.discovered = [];
    this.storage = null;
    this.services = null;
    this.snapshot = EMPTY;
    this.notify();
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    if (!this.storage) return;
    if (enabled) this.disabled.delete(id);
    else this.disabled.add(id);
    await writeDisabledIds(this.storage, [...this.disabled]);
    this.rebuild();
  }

  setPoster(pluginId: string, post: ((message: unknown) => void) | null): void {
    const plugin = this.live.get(pluginId);
    if (!plugin) return;
    plugin.post = post ?? (() => undefined);
  }

  async receive(pluginId: string, message: unknown): Promise<void> {
    const plugin = this.live.get(pluginId);
    if (!plugin) return;
    if (isRpcEnvelope(message) && message.pluginId === pluginId) {
      if (message.kind === 'event' && message.method === 'lifecycle:log') {
        const params = message.params as { message?: unknown };
        if (typeof params.message === 'string' && params.message.length > 0)
          this.onLog(params.message);
        return;
      }
      if (message.kind === 'event' && message.method === 'lifecycle:ready') {
        this.patch(pluginId, { status: 'ready', error: null });
        return;
      }
      if (message.kind === 'error' && message.id === 'boot' && message.error) {
        this.patch(pluginId, { status: 'error', error: message.error.message });
        return;
      }
    }
    const reply = await plugin.session.handle(message);
    if (reply) plugin.post(reply);
  }

  invoke(commandId: string): void {
    for (const plugin of this.live.values()) {
      const command = plugin.session.listCommands().find((item) => item.id === commandId);
      if (!command) continue;
      plugin.post({
        protocol: RPC_PROTOCOL,
        version: PLUGIN_API_VERSION,
        pluginId: plugin.manifest.id,
        id: createRpcId(),
        kind: 'request',
        method: 'command.invoke',
        params: { commandId },
      });
      return;
    }
  }

  emit(event: NoteEvent): void {
    for (const plugin of this.live.values()) {
      if (!plugin.session.wants(event.type)) continue;
      if (event.type === 'note:renamed') {
        plugin.post(
          createRpcEvent(plugin.manifest.id, createRpcId(), event.type, {
            from: event.from,
            to: event.to,
          }),
        );
      } else {
        plugin.post(
          createRpcEvent(plugin.manifest.id, createRpcId(), event.type, { path: event.path }),
        );
      }
    }
  }

  commands(): readonly PluginCommandSnapshot[] {
    return this.snapshot.items.flatMap((item) => item.commands);
  }

  private rebuild(): void {
    this.live.clear();
    const items: PluginItemSnapshot[] = [];
    for (const plugin of this.discovered) {
      const manifest = plugin.manifest;
      const id = manifest?.id ?? plugin.directory;
      const runnable = manifest !== null && plugin.mainSource !== null && plugin.error === null;
      const enabled = runnable && !this.disabled.has(id);
      let srcdoc: string | null = null;
      if (enabled && manifest && plugin.mainSource && this.services) {
        const session = new PluginSession(manifest, this.services, () => this.publish());
        this.live.set(id, { manifest, session, post: () => undefined });
        srcdoc = buildSandboxSrcdoc(manifest, plugin.mainSource);
      }
      items.push({
        id,
        name: manifest?.name ?? plugin.directory,
        description: manifest?.description ?? '',
        enabled,
        permissions: (manifest?.permissions ?? []).map((permission) => permission.id),
        error: plugin.error,
        srcdoc,
        commands: [],
        panels: [],
        status: plugin.error ? 'error' : enabled ? 'loading' : 'disabled',
      });
    }
    this.snapshot = { items };
    this.notify();
  }

  private publish(): void {
    this.snapshot = {
      items: this.snapshot.items.map((item) => {
        const plugin = this.live.get(item.id);
        if (!plugin) return item;
        return {
          ...item,
          commands: plugin.session
            .listCommands()
            .map((command) => commandSnapshot(item.id, command)),
          panels: plugin.session.panels.map((panel) => panelSnapshot(item.id, panel)),
        };
      }),
    };
    this.notify();
  }

  private patch(id: string, patch: Partial<PluginItemSnapshot>): void {
    this.snapshot = {
      items: this.snapshot.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
