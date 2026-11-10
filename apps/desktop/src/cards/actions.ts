import {
  applyReview,
  createCard,
  isCardPath,
  serializeCard,
  sourceSpanForDraft,
  todayIso,
  type CardDraft,
  type MemoryCard,
  type ReviewGrade,
} from '@ai-notes/ai';
import { adoptCleanTabs, dropRemovedTabs, useAppStore } from '../store';
import { syncAllHandwritten, writeCards } from './library';

export interface ComposerRequest {
  mode: 'generate' | 'manual';
  sourcePath: string | null;
  sourceStart: number;
  sourceEnd: number;
  text: string;
}

export function openReview(): void {
  const store = useAppStore.getState();
  if (!store.vault) {
    store.setBanner('先打开一个笔记库');
    return;
  }
  store.setReviewOpen(true);
}

export async function openGenerateFromNote(): Promise<void> {
  const store = useAppStore.getState();
  const path = store.activePath;
  const tab = store.tabs.find((item) => item.path === path);
  if (!path || !tab) {
    store.setBanner('先打开一篇笔记，再生成卡片');
    return;
  }
  if (isCardPath(path)) {
    store.setBanner('这已经是一张记忆卡片');
    return;
  }
  await store.saveActive();
  const fresh = useAppStore.getState().tabs.find((item) => item.path === path) ?? tab;
  if (!fresh.content.trim()) {
    useAppStore.getState().setBanner('这篇笔记是空的，没有可以提炼的内容');
    return;
  }
  useAppStore.getState().setComposer({
    mode: 'generate',
    sourcePath: path,
    sourceStart: 0,
    sourceEnd: fresh.content.length,
    text: fresh.content,
  });
}

export async function openGenerateFromSelection(): Promise<void> {
  const store = useAppStore.getState();
  const path = store.activePath;
  const tab = store.tabs.find((item) => item.path === path);
  const selection = store.editorSelection;
  if (!path || !tab || !selection || selection.path !== path || selection.from === selection.to) {
    store.setBanner('请先在笔记里选中一段文字');
    return;
  }
  await store.saveActive();
  const fresh = useAppStore.getState().tabs.find((item) => item.path === path) ?? tab;
  const text = fresh.content.slice(selection.from, selection.to);
  if (!text.trim()) {
    useAppStore.getState().setBanner('请先在笔记里选中一段文字');
    return;
  }
  useAppStore.getState().setComposer({
    mode: 'generate',
    sourcePath: path,
    sourceStart: selection.from,
    sourceEnd: selection.to,
    text,
  });
}

export function openManualCard(): void {
  const store = useAppStore.getState();
  if (!store.vault) {
    store.setBanner('先打开一个笔记库');
    return;
  }
  const path = store.activePath;
  const tab = store.tabs.find((item) => item.path === path);
  const selection = store.editorSelection;
  const from = selection && selection.path === path ? selection.from : 0;
  const to = selection && selection.path === path ? selection.to : 0;
  store.setComposer({
    mode: 'manual',
    sourcePath: path && !isCardPath(path) ? path : null,
    sourceStart: from,
    sourceEnd: to,
    text: tab && path && !isCardPath(path) ? tab.content : '',
  });
}

export async function collectHandwrittenCards(): Promise<void> {
  const store = useAppStore.getState();
  if (!store.vault) {
    store.setBanner('先打开一个笔记库');
    return;
  }
  const plan = await syncAllHandwritten(store.vault);
  adoptCleanTabs(plan.upserts.map((card) => ({ path: card.path, content: serializeCard(card) })));
  dropRemovedTabs(plan.removals);
  await useAppStore.getState().refreshTree();
  await useAppStore.getState().refreshDueCount();
  useAppStore.setState((state) => ({ indexRevision: state.indexRevision + 1 }));
  const wrote = plan.upserts.length;
  const removed = plan.removals.length;
  useAppStore
    .getState()
    .setBanner(
      wrote === 0 && removed === 0
        ? '没有新的手写卡片'
        : `手写卡片已更新：保存 ${wrote} 张，移除 ${removed} 张`,
      'info',
    );
}

export async function saveCardDrafts(
  drafts: readonly CardDraft[],
  request: ComposerRequest,
): Promise<number> {
  const vault = useAppStore.getState().vault;
  if (!vault) throw new Error('还没有打开笔记库');
  const today = todayIso();
  const cards = drafts
    .map((draft) => ({ ...draft, prompt: draft.prompt.trim(), answer: draft.answer.trim() }))
    .filter((draft) => draft.prompt && draft.answer)
    .map((draft) => {
      const span =
        request.text && request.sourceEnd > request.sourceStart
          ? sourceSpanForDraft(
              request.text,
              { start: request.sourceStart, end: request.sourceEnd },
              draft,
            )
          : null;
      return createCard({
        ...draft,
        origin: request.mode === 'manual' ? 'manual' : 'generated',
        today,
        sourcePath: request.sourcePath,
        sourceStart: span?.start ?? null,
        sourceEnd: span?.end ?? null,
      });
    });
  if (cards.length === 0) throw new Error('至少保留一张写了问题和答案的卡片');
  await writeCards(vault, cards);
  adoptCleanTabs(cards.map((card) => ({ path: card.path, content: serializeCard(card) })));
  await useAppStore.getState().refreshTree();
  await useAppStore.getState().refreshDueCount();
  useAppStore.setState((state) => ({ indexRevision: state.indexRevision + 1, composer: null }));
  useAppStore.getState().setBanner(`已保存 ${cards.length} 张卡片到「记忆」`, 'info');
  return cards.length;
}

export async function commitReview(card: MemoryCard, grade: ReviewGrade): Promise<MemoryCard> {
  const vault = useAppStore.getState().vault;
  if (!vault) throw new Error('还没有打开笔记库');
  const next = applyReview(card, grade, todayIso());
  await writeCards(vault, [next]);
  adoptCleanTabs([{ path: next.path, content: serializeCard(next) }]);
  await useAppStore.getState().refreshDueCount();
  useAppStore.setState((state) => ({ indexRevision: state.indexRevision + 1 }));
  return next;
}
