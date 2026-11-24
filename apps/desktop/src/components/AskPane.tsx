import { Button, ChatMessage, Textarea } from '@ai-notes/ui';
import { useEffect, useRef, useState } from 'react';
import {
  answerAfterStream,
  answerLabels,
  answerParts,
  answerWithoutSources,
  buildAskMessages,
  citationsFromAnswer,
  explainAiError,
  isAbortError,
  shouldAskModel,
  sourceFromHit,
  sourceFromNote,
  streamAnswer,
  type CitationSource,
} from '../ai/ask';
import { loadAiSettings } from '../ai/settings';
import { getEmbedError, getNoteIndex, retrieveNotes } from '../search/client';
import { listNoteFiles } from '../search/files';
import { resolveNoteLink } from '../search/links';
import { useAppStore } from '../store';

interface Turn {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  citations: CitationSource[];
  status?: 'streaming' | 'complete' | 'incomplete' | 'withheld';
  error?: string;
}

export function AskPane() {
  const vaultEpoch = useAppStore((state) => state.vaultEpoch);
  const activePath = useAppStore((state) => state.activePath);
  const tabs = useAppStore((state) => state.tabs);
  const tree = useAppStore((state) => state.tree);
  const openNote = useAppStore((state) => state.openNote);
  const openLink = useAppStore((state) => state.openLink);
  const settingsOpen = useAppStore((state) => state.settingsOpen);
  const indexRevision = useAppStore((state) => state.indexRevision);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const epochRef = useRef(vaultEpoch);
  epochRef.current = vaultEpoch;

  useEffect(() => {
    setTurns([]);
    setBusy(false);
    abortRef.current?.abort();
  }, [vaultEpoch]);

  useEffect(() => {
    const node = logRef.current;
    if (!node) return;
    const block = node.querySelector('.ai-answer-block:last-of-type');
    if (block instanceof HTMLElement) block.scrollIntoView({ block: 'nearest' });
    else node.scrollTop = node.scrollHeight;
  }, [turns]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async () => {
    const question = draft.trim();
    if (!question || busy) return;
    const settings = loadAiSettings();
    const active = tabs.find((tab) => tab.path === activePath) ?? null;
    const files = listNoteFiles(tree);
    const note = active ? sourceFromNote(active.path, active.content) : null;
    let retrieved: CitationSource[] = [];
    const index = getNoteIndex();
    if (index) {
      try {
        const hits = await retrieveNotes(question, 5);
        retrieved = hits.map(sourceFromHit).filter((source) => source.path !== note?.path);
      } catch {
        retrieved = [];
      }
    }
    const messages = buildAskMessages(question, note, retrieved);
    const supplied = note ? [note, ...retrieved] : retrieved;
    const epochAtSend = epochRef.current;
    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setDraft('');
    if (!shouldAskModel(note, retrieved)) {
      const shown = answerWithoutSources();
      setTurns((current) => [
        ...current,
        { id: userId, role: 'user', content: question, citations: [] },
        {
          id: assistantId,
          role: 'assistant',
          content: shown.text,
          citations: [],
          status: 'withheld',
        },
      ]);
      return;
    }
    setBusy(true);
    setTurns((current) => [
      ...current,
      { id: userId, role: 'user', content: question, citations: [] },
      { id: assistantId, role: 'assistant', content: '', citations: [], status: 'streaming' },
    ]);
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    let text = '';
    let sawProtocolDone = false;
    let failure: { abort: boolean; message: string } | null = null;
    try {
      for await (const event of streamAnswer(settings, messages, undefined, controller.signal)) {
        if (epochRef.current !== epochAtSend) return;
        if (event.delta) text += event.delta;
        if (event.done) sawProtocolDone = true;
        const next = text;
        setTurns((current) =>
          current.map((turn) =>
            turn.id === assistantId
              ? {
                  ...turn,
                  content: next,
                  status: 'streaming',
                  citations: citationsFromAnswer(next, supplied, files, false),
                }
              : turn,
          ),
        );
      }
    } catch (error) {
      if (epochRef.current !== epochAtSend) return;
      failure = { abort: isAbortError(error), message: explainAiError(error) };
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (epochRef.current === epochAtSend) setBusy(false);
    }
    if (epochRef.current !== epochAtSend) return;
    const shown = answerAfterStream({
      text,
      sources: supplied,
      files,
      sawProtocolDone,
      failure,
    });
    setTurns((current) =>
      current.map((turn) =>
        turn.id === assistantId
          ? {
              ...turn,
              role: shown.role,
              status: shown.status,
              content: shown.text,
              citations: shown.citations,
              error: shown.error,
            }
          : turn,
      ),
    );
  };

  return (
    <div className={turns.length === 0 ? 'ask-pane is-empty' : 'ask-pane'}>
      <div className="ai-log" ref={logRef}>
        {turns.length === 0 ? (
          <p className="ask-well" data-settings={settingsOpen} data-index={indexRevision}>
            回答和来源会显示在这里。
          </p>
        ) : (
          <p className="ai-hint" data-settings={settingsOpen} data-index={indexRevision}>
            {retrievalLabel()}
          </p>
        )}
        {turns.map((turn) => {
          if (turn.role === 'user') {
            return <ChatMessage key={turn.id} role="user" content={turn.content} />;
          }
          if (turn.role === 'error') {
            return (
              <p key={turn.id} className="ai-error" role="alert">
                {turn.content}
              </p>
            );
          }
          const statusLabel =
            turn.status === 'withheld'
              ? answerLabels.withheld
              : turn.status === 'incomplete'
                ? answerLabels.incomplete
                : turn.status === 'complete'
                  ? answerLabels.complete
                  : answerLabels.streaming;
          return (
            <div key={turn.id} className="ai-answer-block">
              <p
                className={
                  turn.status === 'incomplete' ? 'ai-answer-status incomplete' : 'ai-answer-status'
                }
                role="status"
              >
                {statusLabel}
              </p>
              <article className="an-chat an-chat--assistant" aria-label="回答">
                <p className="an-chat__role">回答</p>
                <div className="an-chat__content">
                  {turn.status === 'streaming' && !turn.content ? '正在回答…' : null}
                  <AnswerText
                    text={turn.content}
                    onOpen={(target) => {
                      const path = resolveNoteLink(target, listNoteFiles(tree));
                      if (path) void openNote(path);
                      else void openLink(target);
                    }}
                  />
                </div>
              </article>
              {turn.citations.length > 0 ? (
                <p className="ai-citation-note">{answerLabels.citation}</p>
              ) : null}
              {turn.citations.map((citation) => (
                <CitationCard
                  key={`${turn.id}:${citation.path}:${citation.start}`}
                  citation={citation}
                />
              ))}
              {turn.error ? (
                <p className="ai-error" role="alert">
                  {turn.error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <form
        className="ai-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Textarea
          label="向这篇笔记提问"
          labelHidden
          rows={2}
          value={draft}
          placeholder="向这篇笔记提问"
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="ai-composer-actions">
          {busy ? (
            <Button type="button" onClick={() => abortRef.current?.abort()}>
              停止
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={!draft.trim()}>
              发送
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function CitationCard({ citation }: { citation: CitationSource }) {
  const [open, setOpen] = useState(false);
  const preview = compactExcerpt(citation.excerpt);
  const canExpand = citation.excerpt.trim() !== preview;
  return (
    <div className={open ? 'ai-citation is-open' : 'ai-citation'}>
      <button
        type="button"
        className="ai-citation-jump"
        onClick={() => void openCitation(citation)}
      >
        <span className="ai-citation-title">{citation.title}</span>
        <span className="ai-citation-path">{citation.path}</span>
        <span className="ai-citation-excerpt">{open ? citation.excerpt : preview}</span>
      </button>
      {canExpand ? (
        <button
          type="button"
          className="text-cmd ai-citation-more"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? '收起' : '展开摘录'}
        </button>
      ) : null}
    </div>
  );
}

function compactExcerpt(text: string): string {
  const line = text
    .replace(/```[\s\S]*?```/g, '\n')
    .split('\n')
    .map((item) =>
      item
        .replace(/^#{1,6}\s+/, '')
        .replace(/^[-*]\s+/, '')
        .trim(),
    )
    .find((item) => item.length > 8);
  const plain = (line ?? '').replace(/\s+/g, ' ').trim();
  if (plain.length <= 72) return plain;
  return `${plain.slice(0, 72).trim()}…`;
}

function openCitation(citation: CitationSource): Promise<void> {
  const openNote = useAppStore.getState().openNote;
  return openNote(citation.path, {
    from: citation.start,
    ...(citation.end !== undefined ? { to: citation.end } : {}),
  });
}

export function retrievalLabel(): string {
  const error = getEmbedError();
  if (error) return `嵌入失败，已改用全文检索：${error}`;
  if (!loadAiSettings().embedModel.trim()) return '未配置嵌入模型，检索只用全文。';
  return '混合检索：全文 + 向量。';
}

function AnswerText({ text, onOpen }: { text: string; onOpen: (target: string) => void }) {
  return answerParts(text).map((part, index) =>
    part.kind === 'link' ? (
      <button key={index} type="button" className="wiki-jump" onClick={() => onOpen(part.text)}>
        {`[[${part.text}]]`}
      </button>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  );
}
