import type { Backlink } from '@ai-notes/indexer';
import { extractLinks } from '@ai-notes/indexer';
import { Panel, SearchResultItem } from '@ai-notes/ui';
import { useEffect, useMemo, useState } from 'react';
import { getNoteIndex } from '../search/client';
import { listNoteFiles } from '../search/files';
import { linkLabel, resolveNoteLink } from '../search/links';
import { useAppStore } from '../store';

const kindLabel = {
  wikilink: '双链',
  markdown: '链接',
  embed: '嵌入',
  block: '块引用',
} as const;

export function LinksPane() {
  const activePath = useAppStore((state) => state.activePath);
  const tabs = useAppStore((state) => state.tabs);
  const tree = useAppStore((state) => state.tree);
  const indexRevision = useAppStore((state) => state.indexRevision);
  const openNote = useAppStore((state) => state.openNote);
  const openLink = useAppStore((state) => state.openLink);
  const active = tabs.find((tab) => tab.path === activePath) ?? null;
  const [incoming, setIncoming] = useState<Backlink[]>([]);

  useEffect(() => {
    const index = getNoteIndex();
    if (!index || !activePath) {
      setIncoming([]);
      return;
    }
    let cancelled = false;
    void index
      .backlinks(activePath)
      .then((rows) => {
        if (!cancelled) setIncoming(rows);
      })
      .catch(() => {
        if (!cancelled) setIncoming([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activePath, indexRevision]);

  const files = useMemo(() => listNoteFiles(tree), [tree]);
  const outgoing = useMemo(() => {
    if (!active) return [];
    return extractLinks(active.content).map((link) => {
      const resolved = resolveNoteLink(link.dstPath, files);
      return { ...link, resolved, label: linkLabel(link.dstPath, resolved) };
    });
  }, [active, files]);

  if (!activePath) {
    return <p className="ai-hint">打开一篇笔记后显示反向链接和文中的双链。</p>;
  }

  return (
    <div className="links-pane">
      <Panel title="反向链接">
        {incoming.length === 0 ? (
          <p className="ai-hint">还没有笔记指向这里。</p>
        ) : (
          <div className="link-list">
            {incoming.map((link) => (
              <SearchResultItem
                key={`${link.path}:${link.kind}:${link.dstPath}`}
                title={link.title || link.path}
                path={`${link.path} · ${kindLabel[link.kind]}`}
                onSelect={() => void openNote(link.path)}
              />
            ))}
          </div>
        )}
      </Panel>
      <Panel title="文中链接">
        {outgoing.length === 0 ? (
          <p className="ai-hint">这篇笔记里还没有 [[双链]]。</p>
        ) : (
          <div className="link-list">
            {outgoing.map((link, index) => (
              <SearchResultItem
                key={`${link.kind}:${link.dstPath}:${index}`}
                title={link.label}
                path={
                  link.resolved ? `${link.resolved} · ${kindLabel[link.kind]}` : '找不到这篇笔记'
                }
                onSelect={() => void openLink(link.dstPath)}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
