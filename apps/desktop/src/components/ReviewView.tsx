import {
  applyReview,
  intervalLabel,
  maskCloze,
  revealCloze,
  type MemoryCard,
  type ReviewGrade,
} from '@ai-notes/ai';
import { Button } from '@ai-notes/ui';
import { useEffect, useState } from 'react';
import { commitReview, openGenerateFromNote, openManualCard } from '../cards/actions';
import { loadDueCards } from '../cards/library';
import { listNoteFiles } from '../search/files';
import { useAppStore } from '../store';

const GRADES: {
  id: ReviewGrade;
  label: string;
  key: string;
  variant: 'danger' | 'secondary' | 'primary';
}[] = [
  { id: 'again', label: '忘记', key: '1', variant: 'danger' },
  { id: 'hard', label: '困难', key: '2', variant: 'secondary' },
  { id: 'good', label: '记得', key: '3', variant: 'primary' },
  { id: 'easy', label: '简单', key: '4', variant: 'secondary' },
];

export function ReviewView() {
  const reviewOpen = useAppStore((state) => state.reviewOpen);
  const vault = useAppStore((state) => state.vault);
  const tree = useAppStore((state) => state.tree);
  const dueCount = useAppStore((state) => state.dueCount);
  const setReviewOpen = useAppStore((state) => state.setReviewOpen);
  const openNote = useAppStore((state) => state.openNote);
  const [queue, setQueue] = useState<MemoryCard[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    if (!reviewOpen || !vault || queue !== null) return;
    let cancelled = false;
    void loadDueCards(vault)
      .then((cards) => {
        if (!cancelled) setQueue(cards);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : '无法读取卡片');
        setQueue([]);
      });
    return () => {
      cancelled = true;
    };
  }, [reviewOpen, vault, queue]);

  const current = queue?.[0] ?? null;

  useEffect(() => {
    if (!reviewOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const ui = useAppStore.getState();
      if (
        ui.commandOpen ||
        ui.searchOpen ||
        ui.switcherOpen ||
        ui.settingsOpen ||
        ui.pluginsOpen ||
        ui.composer ||
        ui.dialog
      ) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if ((event.key === ' ' || event.key === 'Enter') && current && !revealed && !saving) {
        event.preventDefault();
        event.stopPropagation();
        setRevealed(true);
        return;
      }
      const grade = GRADES.find((item) => item.key === event.key);
      if (grade && current && revealed && !saving) {
        event.preventDefault();
        event.stopPropagation();
        void gradeCard(grade.id);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const gradeCard = async (grade: ReviewGrade) => {
    if (!current || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await commitReview(current, grade);
      setRevealed(false);
      setSeen((count) => count + 1);
      setQueue((existing) => {
        const rest = (existing ?? []).slice(1);
        if (grade === 'again' && rest.length > 0) return [...rest, updated];
        return rest;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法保存复习结果');
    } finally {
      setSaving(false);
    }
  };

  if (!reviewOpen) return null;

  const files = listNoteFiles(tree);
  const sourceReady = current?.sourcePath
    ? files.some((file) => file.path === current.sourcePath)
    : false;

  return (
    <section className="review-view" aria-label="记忆卡片复习">
      <div className="review-stage">
        <header className="review-top">
          <div>
            <p className="review-kicker">间隔重复</p>
            <h1>今日复习</h1>
          </div>
          <div className="review-top-actions">
            <span className="review-progress-label">
              {queue === null
                ? '读取中'
                : queue.length === 0
                  ? `已复习 ${seen}`
                  : `还剩 ${queue.length}`}
            </span>
            <Button onClick={() => setReviewOpen(false)}>返回笔记</Button>
          </div>
        </header>
        {error ? (
          <p className="ai-error" role="alert">
            {error}
          </p>
        ) : null}
        {queue === null ? <p className="ai-hint">正在整理今天的卡片…</p> : null}
        {queue && queue.length === 0 ? (
          <div className="review-done">
            <h2>{seen > 0 ? '这一轮复习完了' : '今天没有要复习的卡片'}</h2>
            <p>
              {dueCount > 0
                ? `还有 ${dueCount} 张今天答错过的卡片，可以再来一轮。`
                : '手写卡片随时可以加。配置模型之后，也能从当前笔记生成。'}
            </p>
            <div className="empty-actions">
              {dueCount > 0 ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    setSeen(0);
                    setQueue(null);
                  }}
                >
                  再来一轮
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  setReviewOpen(false);
                  void openGenerateFromNote();
                }}
              >
                从当前笔记生成
              </Button>
              <Button
                onClick={() => {
                  setReviewOpen(false);
                  openManualCard();
                }}
              >
                手写一张
              </Button>
            </div>
          </div>
        ) : null}
        {current ? (
          <>
            <article className="review-card">
              <p className="review-kicker">{current.kind === 'cloze' ? '挖空' : '问答'}</p>
              <h2 className="review-prompt">
                {current.kind === 'cloze' && !revealed
                  ? maskCloze(current.prompt)
                  : revealCloze(current.prompt)}
              </h2>
              {revealed ? (
                <div className="review-answer">
                  <p className="review-kicker">答案</p>
                  <p>{current.answer}</p>
                </div>
              ) : (
                <Button variant="primary" onClick={() => setRevealed(true)}>
                  显示答案
                </Button>
              )}
            </article>
            <div className="review-source">
              {current.sourcePath ? (
                sourceReady ? (
                  <button
                    type="button"
                    className="review-source-link"
                    onClick={() => {
                      const path = current.sourcePath;
                      if (!path) return;
                      setReviewOpen(false);
                      void openNote(path, {
                        from: current.sourceStart ?? 0,
                        to: current.sourceEnd ?? current.sourceStart ?? 0,
                      });
                    }}
                  >
                    跳到来源 · {current.sourcePath}
                  </button>
                ) : (
                  <span>来源笔记已不在库里 · {current.sourcePath}</span>
                )
              ) : (
                <span>这张卡片没有来源笔记</span>
              )}
            </div>
            <div className="review-grades">
              {GRADES.map((grade) => (
                <Button
                  key={grade.id}
                  variant={grade.variant}
                  className={grade.id === 'easy' ? 'grade-easy' : undefined}
                  disabled={!revealed || saving}
                  onClick={() => void gradeCard(grade.id)}
                >
                  <span className="grade-name">
                    {grade.label}
                    <span className="grade-key">{grade.key}</span>
                  </span>
                  <span className="grade-when">
                    {intervalLabel(previewInterval(current, grade.id))}
                  </span>
                </Button>
              ))}
            </div>
            <p className="review-hint">空格翻面，然后按 1 到 4 打分。</p>
          </>
        ) : null}
      </div>
    </section>
  );
}

function previewInterval(card: MemoryCard, grade: ReviewGrade): number {
  return applyReview(card, grade, card.due).interval;
}
