import { VaultError, type VaultNode } from '@ai-notes/core';
import type { PluginItemSnapshot } from '@ai-notes/plugin-host';
import { CommandPalette as Palette, type CommandItem } from '@ai-notes/ui';
import { useMemo, useSyncExternalStore } from 'react';
import {
  collectHandwrittenCards,
  openGenerateFromNote,
  openGenerateFromSelection,
  openManualCard,
  openReview,
} from '../cards/actions';
import { openFolderVault } from '../fs/openVault';
import { pluginController } from '../plugins/controller';
import { listNoteFiles } from '../search/files';
import { useAppStore } from '../store';

export function CommandPalette() {
  const open = useAppStore((state) => state.commandOpen);
  const setCommandOpen = useAppStore((state) => state.setCommandOpen);
  const tree = useAppStore((state) => state.tree);
  const vault = useAppStore((state) => state.vault);
  const dueCount = useAppStore((state) => state.dueCount);
  const pluginSnapshot = useSyncExternalStore(
    pluginController.subscribe,
    pluginController.getSnapshot,
  );
  const items = useMemo(
    () => buildItems(tree, Boolean(vault), pluginSnapshot.items, dueCount),
    [tree, vault, pluginSnapshot, dueCount],
  );

  return (
    <Palette
      open={open}
      label="命令面板"
      placeholder="搜索笔记或命令"
      emptyLabel="没有匹配的命令"
      items={items}
      onClose={() => setCommandOpen(false)}
      onSelect={(item) => runCommand(item.id)}
    />
  );
}

function buildItems(
  tree: readonly VaultNode[],
  hasVault: boolean,
  plugins: readonly PluginItemSnapshot[],
  dueCount: number,
): CommandItem[] {
  const commands: CommandItem[] = [
    { id: 'open-folder', title: '打开文件夹' },
    { id: 'sample', title: '打开示例库', hint: '内存' },
    { id: 'search', title: '全文搜索', hint: 'Ctrl Shift F', keywords: 'search' },
    { id: 'switcher', title: '快速切换', hint: 'Ctrl O', keywords: 'open file' },
    { id: 'settings', title: '模型设置', hint: 'API Key' },
    { id: 'plugins', title: '插件设置' },
    { id: 'theme-system', title: '主题：跟随系统' },
    { id: 'theme-light', title: '主题：浅色' },
    { id: 'theme-dark', title: '主题：深色' },
  ];
  const pluginCommands = plugins.flatMap((plugin) =>
    plugin.commands.map((command) => ({
      id: `plugin:${command.pluginId}:${command.id}`,
      title: command.name,
      hint: command.hotkey ? `插件 · ${command.hotkey}` : '插件',
    })),
  );
  if (!hasVault) return [...commands, ...pluginCommands];
  return [
    ...commands,
    { id: 'new-note', title: '新建笔记' },
    { id: 'new-folder', title: '新建文件夹' },
    { id: 'save', title: '保存', hint: 'Ctrl S' },
    {
      id: 'review',
      title: '开始复习',
      hint: `今日 ${dueCount}`,
      keywords: 'flashcard memory 记忆 卡片 复习',
    },
    {
      id: 'cards-note',
      title: '从当前笔记生成卡片',
      keywords: 'generate flashcard 记忆 卡片',
    },
    {
      id: 'cards-selection',
      title: '从选中文本生成卡片',
      keywords: 'selection flashcard 记忆 卡片',
    },
    { id: 'cards-manual', title: '新建记忆卡片', keywords: '记忆 卡片' },
    { id: 'cards-collect', title: '收集手写卡片', keywords: '记忆 卡片' },
    { id: 'left', title: '显示或收起文件树', hint: 'Ctrl \\' },
    { id: 'right', title: '显示或收起 AI 面板', hint: 'Ctrl J' },
    ...pluginCommands,
    ...listNoteFiles(tree).map((file) => ({
      id: `file:${file.path}`,
      title: file.name.replace(/\.md$/i, ''),
      hint: file.path,
    })),
  ];
}

function runCommand(id: string) {
  const store = useAppStore.getState();
  if (id === 'open-folder') {
    void openFolder().catch((error: unknown) => {
      const message =
        error instanceof VaultError || error instanceof Error ? error.message : '无法打开文件夹';
      useAppStore.getState().setBanner(message);
    });
    return;
  }
  if (id === 'sample') {
    void store.openSampleVault();
    return;
  }
  if (id === 'search') {
    store.setSearchOpen(true);
    return;
  }
  if (id === 'switcher') {
    store.setSwitcherOpen(true);
    return;
  }
  if (id === 'settings') {
    store.setSettingsOpen(true);
    return;
  }
  if (id === 'plugins') {
    store.setPluginsOpen(true);
    return;
  }
  if (id === 'new-note') {
    store.openDialog({ kind: 'create-note' });
    return;
  }
  if (id === 'new-folder') {
    store.openDialog({ kind: 'create-folder' });
    return;
  }
  if (id === 'save') {
    void store.saveActive();
    return;
  }
  if (id === 'review') {
    openReview();
    return;
  }
  if (id === 'cards-note') {
    void openGenerateFromNote();
    return;
  }
  if (id === 'cards-selection') {
    void openGenerateFromSelection();
    return;
  }
  if (id === 'cards-manual') {
    openManualCard();
    return;
  }
  if (id === 'cards-collect') {
    void collectHandwrittenCards().catch((error: unknown) => {
      useAppStore.getState().setBanner(error instanceof Error ? error.message : '收集失败');
    });
    return;
  }
  if (id === 'theme-system') {
    store.setThemeMode('system');
    return;
  }
  if (id === 'theme-light') {
    store.setThemeMode('light');
    return;
  }
  if (id === 'theme-dark') {
    store.setThemeMode('dark');
    return;
  }
  if (id === 'left') {
    store.toggleLeft();
    return;
  }
  if (id === 'right') {
    store.toggleRight();
    return;
  }
  if (id.startsWith('plugin:')) {
    const rest = id.slice('plugin:'.length);
    const separator = rest.indexOf(':');
    pluginController.invoke(separator >= 0 ? rest.slice(separator + 1) : rest);
    return;
  }
  if (id.startsWith('file:')) void store.openNote(id.slice('file:'.length));
}

async function openFolder() {
  const vault = await openFolderVault();
  if (vault) await useAppStore.getState().openVault(vault.vault, vault.plugins);
}
