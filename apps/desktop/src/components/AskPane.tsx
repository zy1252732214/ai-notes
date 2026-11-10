import { Button, ChatMessage, Textarea } from '@ai-notes/ui';
import { useEffect, useRef, useState } from 'react';
import {
  answerParts,
  buildAskMessages,
  citationsFromAnswer,
  explainAiError,
  isAbortError,
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
  pending?: boolean;
}

export function AskPane() {
  const vaultEpoch = useAppStore((state) => state.vaultEpoch);
  const activePath = useAppStore((state) => state.activePath);
  const tabs = useAppStore((state) => state.tabs);
  const tree = useAppStore((state) => state.tree);
  const openNote = useAppStore((state) => state.openNote);
  const openLink = useAppStore((state) => state.openLink);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
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
    node.scrollTop = node.scrollHeight;
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
    const sources = note ? [note, ...retrieved] : retrieved;
    const epochAtSend = epochRef.current;
    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setDraft('');
    setBusy(true);
    setTurns((current) => [
      ...current,
      { id: userId, role: 'user', content: question, citations: [] },
      { id: assistantId, role: 'assistant', content: '', citations: [], pending: true },
    ]);
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    let text = '';
    try {
      for await (const event of streamAnswer(settings, messages, undefined, controller.signal)) {
        if (epochRef.current !== epochAtSend) return;
        text += event.delta;
        const next = text;
        setTurns((current) =>
          current.map((turn) =>
            turn.id === assistantId
              ? {
                  ...turn,
                  content: next,
                  citations: citationsFromAnswer(next, sources, files, false),
                }
              : turn,
          ),
        );
      }
      const finalText = text;
      setTurns((current) =>
        current.map((turn) =>
          turn.id === assistantId
            ? {
                ...turn,
                pending: false,
                content: finalText,
                citations: citationsFromAnswer(finalText, sources, files, true),
              }
            : turn,
        ),
      );
    } catch (error) {
      if (epochRef.current !== epochAtSend) return;
      const message = explainAiError(error);
      setTurns((current) =>
        current.map((turn) => {
          if (turn.id !== assistantId) return turn;
          if (isAbortError(error) && turn.content) return { ...turn, pending: false };
          if (turn.content) {
            return { ...turn, pending: false };
          }
          return { ...turn, role: 'error', pending: false, content: message };
        }),
      );
      if (!isAbortError(error) && text) {
        setTurns((current) => [
          ...current,
          { id: crypto.randomUUID(), role: 'error', content: message, citations: [] },
        ]);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (epochRef.current === epochAtSend) setBusy(false);
    }
  };

  return (
    <div className="ask-pane">
      <div className="ai-log" ref={logRef}>
        <p className="ai-hint" data-settings={settingsOpen} data-index={indexRevision}>
          {retrievalLabel()}
        </p>
        {turns.length === 0 ? (
          <p className="ai-hint">
            向当前笔记提问。回答会附上可以点开的引用。模型提供方和 API Key
            在设置里，只存在这台设备上。
          </p>
        ) : null}
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
          return (
            <div key={turn.id} className="ai-answer-block">
              <article className="an-chat an-chat--assistant" aria-label="回答">
                <p className="an-chat__role">回答</p>
                <div className="an-chat__content">
                  {turn.pending && !turn.content ? '正在回答…' : null}
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
              {turn.citations.map((citation) => (
                <div
                  key={`${turn.id}:${citation.path}:${citation.start}`}
                  className="ai-citation"
                  role="link"
                  tabIndex={0}
                  onClick={() => void openCitation(citation)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    void openCitation(citation);
                  }}
                >
                  <ChatMessage
                    role="citation"
                    citation={{
                      title: citation.title,
                      source: citation.path,
                      excerpt: citation.excerpt || '打开这篇笔记',
                    }}
                  />
                </div>
              ))}
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
          rows={3}
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
          <Button type="button" variant="ghost" onClick={() => setSettingsOpen(true)}>
            设置
          </Button>
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

function openCitation(citation: CitationSource): Promise<void> {
  const openNote = useAppStore.getState().openNote;
  return openNote(citation.path, {
    from: citation.start,
    ...(citation.end !== undefined ? { to: citation.end } : {}),
  });
}

function retrievalLabel(): string {
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
