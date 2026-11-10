import { filterVaultTree, type VaultNode } from '@ai-notes/core';
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../store';

export function FileTree() {
  const leftOpen = useAppStore((state) => state.leftOpen);
  const vault = useAppStore((state) => state.vault);
  const tree = useAppStore((state) => state.tree);
  const filter = useAppStore((state) => state.filter);
  const setFilter = useAppStore((state) => state.setFilter);
  const refreshTree = useAppStore((state) => state.refreshTree);
  const openDialog = useAppStore((state) => state.openDialog);
  const selectDirectory = useAppStore((state) => state.selectDirectory);
  const visible = filterVaultTree(tree, filter);

  return (
    <aside className="sidebar" aria-label="文件树" inert={!leftOpen}>
      <div className="sidebar-head">
        <span>文件</span>
        <div className="row-actions">
          <button
            className="icon-button"
            aria-label="新建笔记"
            disabled={!vault}
            onClick={() => {
              selectDirectory('');
              openDialog({ kind: 'create-note' });
            }}
          >
            <Plus size={16} strokeWidth={1.5} />
          </button>
          <button
            className="icon-button"
            aria-label="新建文件夹"
            disabled={!vault}
            onClick={() => {
              selectDirectory('');
              openDialog({ kind: 'create-folder' });
            }}
          >
            <FolderPlus size={16} strokeWidth={1.5} />
          </button>
          <button
            className="icon-button"
            aria-label="刷新文件树"
            disabled={!vault}
            onClick={() => void refreshTree()}
          >
            <RefreshCw size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <label className="search-field">
        <span className="sr-only">筛选笔记</span>
        <input
          value={filter}
          placeholder="筛选笔记"
          onChange={(event) => setFilter(event.target.value)}
          disabled={!vault}
        />
      </label>
      {vault ? (
        visible.length > 0 ? (
          <div className="tree" role="tree">
            {visible.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                forceOpen={filter.trim().length > 0}
              />
            ))}
          </div>
        ) : (
          <p className="sidebar-empty">{filter.trim() ? '没有匹配的笔记' : '这个库里还没有笔记'}</p>
        )
      ) : (
        <p className="sidebar-empty">打开示例库或本地文件夹后，这里会列出 Markdown 笔记。</p>
      )}
    </aside>
  );
}

function TreeNode({
  node,
  depth,
  forceOpen,
}: {
  node: VaultNode;
  depth: number;
  forceOpen: boolean;
}) {
  const activePath = useAppStore((state) => state.activePath);
  const selectedDirectory = useAppStore((state) => state.selectedDirectory);
  const expanded = useAppStore((state) => state.expanded[node.path] ?? false);
  const toggleExpanded = useAppStore((state) => state.toggleExpanded);
  const openNote = useAppStore((state) => state.openNote);
  const selectDirectory = useAppStore((state) => state.selectDirectory);
  const openDialog = useAppStore((state) => state.openDialog);
  const open = forceOpen || expanded;
  const directory = node.kind === 'directory';
  const selected = directory ? selectedDirectory === node.path : activePath === node.path;

  return (
    <div className="tree-node" role="treeitem" aria-expanded={directory ? open : undefined}>
      <div
        className={selected ? 'tree-row selected' : 'tree-row'}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {directory ? (
          <button
            className={open ? 'chevron open' : 'chevron'}
            aria-label={open ? `折叠${node.name}` : `展开${node.name}`}
            onClick={() => toggleExpanded(node.path)}
          >
            <ChevronRight size={14} strokeWidth={1.5} />
          </button>
        ) : (
          <span className="chevron spacer" />
        )}
        <button
          className="tree-label"
          onClick={() => {
            if (directory) {
              selectDirectory(node.path);
              if (!open) toggleExpanded(node.path);
              return;
            }
            void openNote(node.path);
          }}
        >
          {directory ? (
            open ? (
              <FolderOpen size={16} strokeWidth={1.5} />
            ) : (
              <Folder size={16} strokeWidth={1.5} />
            )
          ) : (
            <FileText size={16} strokeWidth={1.5} />
          )}
          <span>{node.name}</span>
        </button>
        <div className="row-actions tree-actions">
          {directory ? (
            <button
              className="icon-button"
              aria-label={`在${node.name}中新建笔记`}
              onClick={() => {
                selectDirectory(node.path);
                openDialog({ kind: 'create-note' });
              }}
            >
              <Plus size={14} strokeWidth={1.5} />
            </button>
          ) : null}
          <button
            className="icon-button"
            aria-label={`重命名${node.name}`}
            onClick={() => openDialog({ kind: 'rename', path: node.path, entryKind: node.kind })}
          >
            <Pencil size={14} strokeWidth={1.5} />
          </button>
          <button
            className="icon-button danger"
            aria-label={`删除${node.name}`}
            onClick={() => openDialog({ kind: 'delete', path: node.path, entryKind: node.kind })}
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      {directory && open ? (
        <div role="group">
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} forceOpen={forceOpen} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
