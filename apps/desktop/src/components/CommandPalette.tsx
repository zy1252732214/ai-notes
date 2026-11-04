import { filterVaultTree, type VaultNode } from '@ai-notes/core';
import { VaultError } from '@ai-notes/core';
import { useEffect, useMemo, useState } from 'react';
import { openFolderVault } from '../fs/openVault';
import { useAppStore } from '../store';

interface CommandItem {
  id: string;
  title: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useAppStore((state) => state.commandOpen);
  const setCommandOpen = useAppStore((state) => state.setCommandOpen);
  const tree = useAppStore((state) => state.tree);
  const vault = useAppStore((state) => state.vault);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setIndex(0);
  }, [open]);

  const items = useMemo(() => {
    if (!open) return [];
    return buildCommands(query, tree, Boolean(vault));
  }, [open, query, tree, vault]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) return null;

  const choose = (item: CommandItem | undefined) => {
    if (!item) return;
    setCommandOpen(false);
    item.run();
  };

  return (
    <div className="modal-backdrop palette-backdrop" onMouseDown={() => setCommandOpen(false)}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          placeholder="搜索笔记或命令"
          aria-label="搜索笔记或命令"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setIndex((current) => Math.min(current + 1, Math.max(items.length - 1, 0)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              choose(items[index]);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setCommandOpen(false);
            }
          }}
        />
        <ul role="listbox">
          {items.length === 0 ? <li className="palette-empty">没有匹配的命令</li> : null}
          {items.map((item, itemIndex) => (
            <li key={item.id}>
              <button
                className={itemIndex === index ? 'palette-item active' : 'palette-item'}
                role="option"
                aria-selected={itemIndex === index}
                onMouseEnter={() => setIndex(itemIndex)}
                onClick={() => choose(item)}
              >
                <span>{item.title}</span>
                {item.hint ? <span className="hint">{item.hint}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function buildCommands(
  query: string,
  tree: readonly VaultNode[],
  hasVault: boolean,
): CommandItem[] {
  const store = useAppStore.getState();
  const actions: CommandItem[] = [
    {
      id: 'open-folder',
      title: '打开文件夹',
      run: () => {
        void openFolder().catch((error: unknown) => {
          const message =
            error instanceof VaultError || error instanceof Error
              ? error.message
              : '无法打开文件夹';
          useAppStore.getState().setBanner(message);
        });
      },
    },
    { id: 'sample', title: '打开示例库', hint: '内存', run: () => void store.openSampleVault() },
    {
      id: 'new-note',
      title: '新建笔记',
      run: () => store.openDialog({ kind: 'create-note' }),
    },
    {
      id: 'new-folder',
      title: '新建文件夹',
      run: () => store.openDialog({ kind: 'create-folder' }),
    },
    { id: 'save', title: '保存', hint: 'Ctrl S', run: () => void store.saveActive() },
    { id: 'theme-system', title: '主题：跟随系统', run: () => store.setThemeMode('system') },
    { id: 'theme-light', title: '主题：浅色', run: () => store.setThemeMode('light') },
    { id: 'theme-dark', title: '主题：深色', run: () => store.setThemeMode('dark') },
    { id: 'left', title: '显示或收起文件树', hint: 'Ctrl \\', run: () => store.toggleLeft() },
    { id: 'right', title: '显示或收起 AI 面板', hint: 'Ctrl J', run: () => store.toggleRight() },
  ];
  const needle = query.trim().toLowerCase();
  const matchedActions = actions.filter(
    (item) => !needle || item.title.toLowerCase().includes(needle),
  );
  const files = hasVault
    ? flattenFiles(filterVaultTree(tree, query)).map((node) => ({
        id: `file:${node.path}`,
        title: node.name,
        hint: node.path,
        run: () => {
          void store.openNote(node.path);
        },
      }))
    : [];
  const withoutVault = matchedActions.filter((item) =>
    hasVault
      ? true
      : item.id === 'open-folder' || item.id === 'sample' || item.id.startsWith('theme'),
  );
  return [...withoutVault, ...files];
}

async function openFolder() {
  const vault = await openFolderVault();
  if (vault) await useAppStore.getState().openVault(vault);
}

function flattenFiles(nodes: readonly VaultNode[]): VaultNode[] {
  const files: VaultNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'file') files.push(node);
    else files.push(...flattenFiles(node.children));
  }
  return files;
}
