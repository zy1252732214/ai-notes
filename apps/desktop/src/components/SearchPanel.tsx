import type { SearchHit } from '@ai-notes/indexer';
import { useEffect, useMemo, useState } from 'react';
import { getNoteIndex } from '../search/client';
import { parseSnippet } from '../search/snippet';
import { useAppStore } from '../store';
import { LookupDialog, type LookupEntry } from './LookupDialog';

export function SearchPanel() {
  const open = useAppStore((state) => state.searchOpen);
  const setSearchOpen = useAppStore((state) => state.setSearchOpen);
  const indexRevision = useAppStore((state) => state.indexRevision);
  const openNote = useAppStore((state) => state.openNote);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [emptyLabel, setEmptyLabel] = useState('输入关键词，搜索笔记正文');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHits([]);
    setEmptyLabel('输入关键词，搜索笔记正文');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const needle = query.trim();
    if (!needle) {
      setHits([]);
      setEmptyLabel('输入关键词，搜索笔记正文');
      return;
    }
    const index = getNoteIndex();
    if (!index) {
      setHits([]);
      setEmptyLabel('先打开一个笔记库');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void index
        .search(needle, 20)
        .then((rows) => {
          if (cancelled) return;
          setHits(rows);
          setEmptyLabel(rows.length === 0 ? '没有匹配的笔记' : '');
        })
        .catch(() => {
          if (cancelled) return;
          setHits([]);
          setEmptyLabel('搜索失败');
        });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, indexRevision]);

  const entries = useMemo<LookupEntry[]>(
    () =>
      hits.map((hit) => ({
        id: `${hit.path}:${hit.chunkId}:${hit.start}`,
        title: hit.title || hit.path,
        path: hit.path,
        snippet: <Snippet text={hit.snippet} />,
      })),
    [hits],
  );

  return (
    <LookupDialog
      open={open}
      label="全文搜索"
      placeholder="搜索笔记正文"
      emptyLabel={emptyLabel}
      query={query}
      onQueryChange={setQuery}
      entries={entries}
      onClose={() => setSearchOpen(false)}
      onSelect={(entry) => {
        const hit = hits.find((item) => `${item.path}:${item.chunkId}:${item.start}` === entry.id);
        if (!hit) return;
        void openNote(hit.path, { from: hit.start, to: hit.end });
        setSearchOpen(false);
      }}
    />
  );
}

function Snippet({ text }: { text: string }) {
  return parseSnippet(text).map((piece, index) =>
    piece.marked ? <mark key={index}>{piece.text}</mark> : <span key={index}>{piece.text}</span>,
  );
}
