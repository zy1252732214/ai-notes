import {
  dueCards,
  isCardPath,
  parseCard,
  planHandwrittenSync,
  remapCardSource,
  serializeCard,
  todayIso,
  type HandwrittenSyncPlan,
  type MemoryCard,
} from '@ai-notes/ai';
import { isMarkdownPath, type Vault } from '@ai-notes/core';
import { getNoteIndex } from '../search/client';

export async function readCards(vault: Vault): Promise<MemoryCard[]> {
  const entries = await vault.fs.list();
  const cards: MemoryCard[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'file' || !isMarkdownPath(entry.path) || !isCardPath(entry.path)) continue;
    const card = parseCard(await vault.fs.readText(entry.path), entry.path);
    if (card) cards.push(card);
  }
  const byId = new Map<string, MemoryCard>();
  for (const card of cards) {
    const current = byId.get(card.id);
    if (!current || card.path.endsWith(`/${card.id}.md`)) byId.set(card.id, card);
  }
  return [...byId.values()];
}

export async function writeCards(vault: Vault, cards: readonly MemoryCard[]): Promise<void> {
  for (const card of cards) {
    const content = serializeCard(card);
    await vault.writeNote(card.path, content);
    await getNoteIndex()
      ?.noteSaved(card.path, content)
      .catch(() => undefined);
  }
}

export async function removeCardFiles(vault: Vault, paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  const existing = new Set((await vault.fs.list()).map((entry) => entry.path));
  for (const path of paths) {
    if (!existing.has(path)) continue;
    await vault.delete(path);
    await getNoteIndex()
      ?.noteDeleted(path)
      .catch(() => undefined);
  }
}

export async function syncHandwritten(
  vault: Vault,
  notes: readonly { path: string; content: string }[],
  today = todayIso(),
): Promise<HandwrittenSyncPlan> {
  const plan = planHandwrittenSync(notes, await readCards(vault), today);
  await writeCards(vault, plan.upserts);
  await removeCardFiles(vault, plan.removals);
  return plan;
}

export async function syncAllHandwritten(
  vault: Vault,
  today = todayIso(),
): Promise<HandwrittenSyncPlan> {
  const notes: { path: string; content: string }[] = [];
  for (const entry of await vault.fs.list()) {
    if (entry.kind !== 'file' || !isMarkdownPath(entry.path) || isCardPath(entry.path)) continue;
    notes.push({ path: entry.path, content: await vault.fs.readText(entry.path) });
  }
  return syncHandwritten(vault, notes, today);
}

export async function remapCardSources(
  vault: Vault,
  from: string,
  to: string,
): Promise<MemoryCard[]> {
  const changed = (await readCards(vault)).flatMap((card) => {
    const next = remapCardSource(card, from, to);
    return next === card ? [] : [next];
  });
  await writeCards(vault, changed);
  return changed;
}

export async function loadDueCards(vault: Vault, today = todayIso()): Promise<MemoryCard[]> {
  return dueCards(await readCards(vault), today);
}

export async function countDueCards(vault: Vault, today = todayIso()): Promise<number> {
  return (await loadDueCards(vault, today)).length;
}
