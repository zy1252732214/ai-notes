import {
  citationsForAnswer,
  ragMessages,
  withActiveNote,
  type RagCitation,
  type RagSource,
} from '@ai-notes/ai';
import type { Backlink, SearchHit } from '@ai-notes/indexer';
import { useState, useSyncExternalStore } from 'react';

import {
  chatConfigured,
  createChatRouter,
  currentEmbedError,
  defaultBaseUrl,
  embedConfigured,
  getModelSettings,
  subscribeModelSettings,
  retryEmbeddings,
  updateModelSecrets,
  updateModelSettings,
  type ChatProviderId,
  type EmbedProviderId,
  type ModelSettings,
} from '../ai/model-settings';
import { getNoteIndex, retrieveNotes } from '../search/client';
import { noteTitle, useAppStore } from '../store';

interface AskMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  citations: RagCitation[];
}

let nextMessageId = 1;

export function AskPane({ links }: { links: readonly Backlink[] }) {
  const model = useSyncExternalStore(subscribeModelSettings, getModelSettings);
  const activePath = useAppStore((state) => state.activePath);
  const indexRevision = useAppStore((state) => state.indexRevision);
  const openNote = useAppStore((state) => state.openNote);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const embedError = currentEmbedError();
  const status = !embedConfigured(model.settings)
    ? '未配置嵌入模型，检索只用全文。'
    : embedError
      ? `嵌入失败，已改用全文检索：${embedError}`
      : '混合检索：全文 + 向量。';

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    const userId = nextMessageId;
    nextMessageId += 1;
    const assistantId = nextMessageId;
    nextMessageId += 1;
    setDraft('');
    setError(null);
    setBusy(true);
    setMessages((current) => [
      ...current,
      { id: userId, role: 'user', content: trimmed, citations: [] },
      { id: assistantId, role: 'assistant', content: '', citations: [] },
    ]);
    const replace = (content: string, citations: RagCitation[]) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? { ...message, content, citations } : message,
        ),
      );
    };
    let text = '';
    let sources: RagSource[] = [];
    try {
      const index = getNoteIndex();
      if (!index) {
        replace('先打开一个笔记库，再提问。', []);
        return;
      }
      const hits = await retrieveNotes(trimmed, 6);
      const state = useAppStore.getState();
      const tab = state.tabs.find((item) => item.path === state.activePath);
      sources = withActiveNote(
        hits.map(toSource),
        tab && state.activePath ? activeSource(state.activePath, tab.content) : null,
      );
      const router = createChatRouter();
      if (!router) {
        replace('还没有配置对话模型。下面是检索到的笔记片段。', citationsForAnswer('', sources));
        return;
      }
      for await (const event of router.stream(
        {
          messages: ragMessages(trimmed, sources, state.activePath ?? undefined),
          feature: 'chat',
        },
        { provider: 'chat' },
      )) {
        if (!event.delta) continue;
        text += event.delta;
        replace(text, []);
      }
      replace(text || '模型没有返回内容。', citationsForAnswer(text, sources));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '提问失败';
      setError(message);
      replace(text || '这次没有生成回答。', citationsForAnswer(text, sources));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="ai-body">
        <p className="hint" data-index-revision={indexRevision}>
          {status}
        </p>
        {messages.length === 0 ? (
          <p>向笔记库提问。回答会附上可以点开的引用，并跳到对应片段。</p>
        ) : (
          <div className="ask-log">
            {messages.map((message) => (
              <article key={message.id} className={`ask-${message.role}`}>
                <p className="ask-role">{message.role === 'user' ? '你' : '回答'}</p>
                {message.content ? <p className="ask-text">{message.content}</p> : null}
                {message.citations.length > 0 ? (
                  <div className="ask-citations">
                    {message.citations.map((citation) => (
                      <button
                        key={`${message.id}:${citation.index}:${citation.notePath}:${citation.startOffset}`}
                        type="button"
                        className="ask-citation"
                        onClick={() =>
                          void openNote(citation.notePath, {
                            start: citation.startOffset,
                            end: citation.endOffset,
                          })
                        }
                      >
                        <strong>
                          [{citation.index}] {citation.title}
                        </strong>
                        <span>{citation.notePath}</span>
                        {citation.quote ? <q>{citation.quote}</q> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
        {error ? <p className="plugin-error">{error}</p> : null}
        <ModelForm settings={model.settings} secrets={model.secrets} disabled={busy} />
        <p>反向链接</p>
        {activePath && links.length > 0 ? (
          <ul className="backlinks">
            {links.map((link) => (
              <li key={`${link.path}:${link.kind}`}>
                <button type="button" onClick={() => void openNote(link.path)}>
                  {link.title || link.path}
                </button>
                <span className="hint">{link.path}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">
            {activePath ? '还没有笔记指向这里。' : '打开一篇笔记后显示反向链接。'}
          </p>
        )}
      </div>
      <form
        className="ai-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
      >
        <textarea
          placeholder={
            chatConfigured(model.settings)
              ? '向笔记库提问'
              : '先在上面配置对话模型，或直接看检索结果'
          }
          rows={3}
          value={draft}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button
          className="button primary"
          type="submit"
          disabled={busy || draft.trim().length === 0}
        >
          {busy ? '回答中' : '发送'}
        </button>
      </form>
    </>
  );
}

function ModelForm({
  settings,
  secrets,
  disabled,
}: {
  settings: ModelSettings;
  secrets: { chatApiKey: string; embedApiKey: string };
  disabled: boolean;
}) {
  const patch = (next: Partial<ModelSettings>) => {
    void updateModelSettings({ ...settings, ...next });
  };
  return (
    <details className="model-settings">
      <summary>模型</summary>
      <p className="hint">API Key 只留在这次会话的内存里，不会写入笔记库。</p>
      <label>
        对话接口
        <select
          value={settings.chatProvider}
          disabled={disabled}
          onChange={(event) => {
            const chatProvider = event.target.value as ChatProviderId;
            patch({
              chatProvider,
              chatBaseUrl: swapDefault(settings.chatBaseUrl, settings.chatProvider, chatProvider),
            });
          }}
        >
          <option value="openai">OpenAI 兼容</option>
          <option value="ollama">Ollama</option>
        </select>
      </label>
      <label>
        对话地址
        <input
          value={settings.chatBaseUrl}
          disabled={disabled}
          onChange={(event) => patch({ chatBaseUrl: event.target.value })}
        />
      </label>
      <label>
        对话模型
        <input
          value={settings.chatModel}
          placeholder={settings.chatProvider === 'ollama' ? 'qwen2.5' : 'gpt-4o-mini'}
          disabled={disabled}
          onChange={(event) => patch({ chatModel: event.target.value })}
        />
      </label>
      <label>
        对话 API Key
        <input
          type="password"
          value={secrets.chatApiKey}
          autoComplete="off"
          disabled={disabled}
          onChange={(event) => updateModelSecrets({ chatApiKey: event.target.value })}
          onBlur={() => retryEmbeddings()}
        />
      </label>
      <label>
        嵌入
        <select
          value={settings.embedProvider}
          disabled={disabled}
          onChange={(event) => {
            const embedProvider = event.target.value as EmbedProviderId;
            const previous = settings.embedProvider === 'off' ? 'ollama' : settings.embedProvider;
            patch({
              embedProvider,
              embedBaseUrl:
                embedProvider === 'off'
                  ? settings.embedBaseUrl
                  : swapDefault(settings.embedBaseUrl, previous, embedProvider),
            });
          }}
        >
          <option value="off">关闭（只用全文）</option>
          <option value="openai">OpenAI 兼容</option>
          <option value="ollama">Ollama</option>
        </select>
      </label>
      {settings.embedProvider === 'off' ? null : (
        <>
          <label>
            嵌入地址
            <input
              value={settings.embedBaseUrl}
              disabled={disabled}
              onChange={(event) => patch({ embedBaseUrl: event.target.value })}
            />
          </label>
          <label>
            嵌入模型
            <input
              value={settings.embedModel}
              placeholder={
                settings.embedProvider === 'ollama' ? 'nomic-embed-text' : 'text-embedding-3-small'
              }
              disabled={disabled}
              onChange={(event) => patch({ embedModel: event.target.value })}
            />
          </label>
          <label>
            嵌入 API Key
            <input
              type="password"
              value={secrets.embedApiKey}
              placeholder="留空则沿用对话密钥"
              autoComplete="off"
              disabled={disabled}
              onChange={(event) => updateModelSecrets({ embedApiKey: event.target.value })}
              onBlur={() => retryEmbeddings()}
            />
          </label>
        </>
      )}
    </details>
  );
}

function swapDefault(current: string, from: ChatProviderId, to: ChatProviderId): string {
  const trimmed = current.trim();
  if (!trimmed || trimmed === defaultBaseUrl(from)) return defaultBaseUrl(to);
  return current;
}

function toSource(hit: SearchHit): RagSource {
  return {
    chunkId: hit.chunkId,
    path: hit.path,
    title: hit.title,
    headingPath: hit.headingPath,
    start: hit.start,
    end: hit.end,
    text: hit.text,
  };
}

function activeSource(path: string, content: string): RagSource {
  const text = content.slice(0, 1200);
  return {
    chunkId: -1,
    path,
    title: noteTitle(path),
    headingPath: '',
    start: 0,
    end: text.length,
    text,
  };
}
