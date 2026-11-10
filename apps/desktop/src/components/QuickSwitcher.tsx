import { useEffect, useMemo, useState } from 'react';
import { fuzzyMatchFiles } from '../search/fuzzy';
import { listNoteFiles } from '../search/files';
import { useAppStore } from '../store';
import { LookupDialog } from './LookupDialog';

export function QuickSwitcher() {
  const open = useAppStore((state) => state.switcherOpen);
  const setSwitcherOpen = useAppStore((state) => state.setSwitcherOpen);
  const tree = useAppStore((state) => state.tree);
  const vault = useAppStore((state) => state.vault);
  const openNote = useAppStore((state) => state.openNote);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const files = useMemo(() => listNoteFiles(tree), [tree]);
  const matches = useMemo(() => fuzzyMatchFiles(files, query, 30), [files, query]);
  const emptyLabel = !vault
    ? '先打开一个笔记库'
    : files.length === 0
      ? '笔记库里还没有文件'
      : '没有匹配的文件名';

  return (
    <LookupDialog
      open={open}
      label="快速切换"
      placeholder="按文件名跳转"
      emptyLabel={emptyLabel}
      query={query}
      onQueryChange={setQuery}
      entries={matches.map((file) => ({
        id: file.path,
        title: file.name.replace(/\.md$/i, ''),
        path: file.path,
      }))}
      onClose={() => setSwitcherOpen(false)}
      onSelect={(entry) => {
        void openNote(entry.id);
        setSwitcherOpen(false);
      }}
    />
  );
}
