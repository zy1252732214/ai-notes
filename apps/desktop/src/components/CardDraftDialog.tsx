import type { CardDraft } from '@ai-notes/ai';
import { maskCloze } from '@ai-notes/ai';
import { Button, Dialog, Textarea } from '@ai-notes/ui';
import { useEffect, useState } from 'react';
import { saveCardDrafts, type ComposerRequest } from '../cards/actions';
import { CardModelError, generateCardDrafts } from '../cards/generate';
import { useAppStore } from '../store';

interface EditableDraft extends CardDraft {
  key: string;
}

export function CardDraftDialog() {
  const composer = useAppStore((state) => state.composer);
  const setComposer = useAppStore((state) => state.setComposer);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const [drafts, setDrafts] = useState<EditableDraft[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [unconfigured, setUnconfigured] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!composer) return;
    let cancelled = false;
    setSaving(false);
    setMessage(null);
    if (composer.mode === 'manual') {
      setDrafts([blankDraft()]);
      setPhase('ready');
      setUnconfigured(false);
      return;
    }
    setDrafts([]);
    setPhase('loading');
    setUnconfigured(false);
    void generateCardDrafts(composer.text).then(
      (cards) => {
        if (cancelled) return;
        setDrafts(cards.map((card) => ({ ...card, key: crypto.randomUUID() })));
        setPhase('ready');
      },
      (error: unknown) => {
        if (cancelled) return;
        const failed = error instanceof CardModelError ? error : null;
        setUnconfigured(failed?.code === 'unconfigured');
        setMessage(failed?.message ?? '生成卡片失败');
        setPhase('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [composer]);

  const close = () => setComposer(null);
  const title = composer?.mode === 'manual' ? '新建记忆卡片' : '生成记忆卡片';

  return (
    <Dialog
      open={composer !== null}
      onClose={close}
      title={title}
      description="卡片会写成「记忆」文件夹里的 Markdown。保存前可以改、可以删。"
      footer={
        phase === 'ready' ? (
          <>
            <Button onClick={() => setDrafts((current) => [...current, blankDraft()])}>
              加一张
            </Button>
            <span className="card-footer-gap" />
            <Button onClick={close}>取消</Button>
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => {
                if (!composer) return;
                setSaving(true);
                setMessage(null);
                void saveCardDrafts(drafts, composer).catch((error: unknown) => {
                  setMessage(error instanceof Error ? error.message : '保存失败');
                  setSaving(false);
                });
              }}
            >
              {saving ? '保存中…' : '保存到笔记库'}
            </Button>
          </>
        ) : (
          <Button onClick={close}>关闭</Button>
        )
      }
    >
      <div className="card-composer">
        {phase === 'loading' ? <p className="ai-hint">正在根据笔记拟定卡片…</p> : null}
        {phase === 'error' ? (
          <div className="card-model-hint" role="alert">
            <p>{message}</p>
            {unconfigured ? (
              <Button
                variant="primary"
                onClick={() => {
                  close();
                  setSettingsOpen(true);
                }}
              >
                打开模型设置
              </Button>
            ) : null}
          </div>
        ) : null}
        {phase === 'ready'
          ? drafts.map((draft, index) => (
              <DraftCard
                key={draft.key}
                index={index}
                draft={draft}
                onChange={(next) =>
                  setDrafts((current) =>
                    current.map((item) => (item.key === draft.key ? next : item)),
                  )
                }
                onRemove={() =>
                  setDrafts((current) => current.filter((item) => item.key !== draft.key))
                }
              />
            ))
          : null}
        {phase === 'ready' && drafts.length === 0 ? (
          <p className="ai-hint">没有留下卡片。可以再加一张，或取消。</p>
        ) : null}
        {message && phase === 'ready' ? (
          <p className="ai-error" role="alert">
            {message}
          </p>
        ) : null}
        {composer ? <SourceLine request={composer} /> : null}
      </div>
    </Dialog>
  );
}

function DraftCard({
  index,
  draft,
  onChange,
  onRemove,
}: {
  index: number;
  draft: EditableDraft;
  onChange: (draft: EditableDraft) => void;
  onRemove: () => void;
}) {
  return (
    <article className="card-draft">
      <header className="card-draft-head">
        <span>卡片 {index + 1}</span>
        <div className="card-kind">
          <button
            type="button"
            aria-pressed={draft.kind === 'qa'}
            className={draft.kind === 'qa' ? 'is-on' : ''}
            onClick={() => onChange({ ...draft, kind: 'qa' })}
          >
            问答
          </button>
          <button
            type="button"
            aria-pressed={draft.kind === 'cloze'}
            className={draft.kind === 'cloze' ? 'is-on' : ''}
            onClick={() => onChange({ ...draft, kind: 'cloze' })}
          >
            挖空
          </button>
        </div>
        <button type="button" className="card-remove" onClick={onRemove}>
          删除
        </button>
      </header>
      <Textarea
        label={draft.kind === 'cloze' ? '题干' : '问题'}
        hint={draft.kind === 'cloze' ? '用 {{ }} 包住要挖空的词' : undefined}
        rows={3}
        value={draft.prompt}
        onChange={(event) => onChange({ ...draft, prompt: event.target.value })}
      />
      {draft.kind === 'cloze' && draft.prompt.includes('{{') ? (
        <p className="card-mask">{maskCloze(draft.prompt)}</p>
      ) : null}
      <Textarea
        label="答案"
        rows={2}
        value={draft.answer}
        onChange={(event) => onChange({ ...draft, answer: event.target.value })}
      />
    </article>
  );
}

function SourceLine({ request }: { request: ComposerRequest }) {
  if (!request.sourcePath) return <p className="ai-hint">这张卡片不绑定来源笔记。</p>;
  return <p className="ai-hint">来源：{request.sourcePath}</p>;
}

function blankDraft(): EditableDraft {
  return { key: crypto.randomUUID(), kind: 'qa', prompt: '', answer: '' };
}
