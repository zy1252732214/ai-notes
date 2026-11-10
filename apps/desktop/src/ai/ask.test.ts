import type { FetchLike } from '@ai-notes/ai';
import { describe, expect, it } from 'vitest';
import { defaultAiSettings, type AiSettings } from './settings.js';
import {
  buildAskMessages,
  citationsFromAnswer,
  sourceFromNote,
  streamAnswer,
  type CitationSource,
} from './ask.js';

const settings: AiSettings = {
  ...defaultAiSettings,
  openai: {
    baseUrl: 'https://example.test/v1',
    model: 'demo',
    apiKey: 'sk-test',
  },
};

const files = [
  { path: '欢迎.md', name: '欢迎.md' },
  { path: '日常/周报.md', name: '周报.md' },
];

const sources: CitationSource[] = [
  { path: '日常/周报.md', title: '周报', excerpt: '搭好三栏布局', start: 12 },
];

function sse(chunks: string[]): FetchLike {
  const body = [
    ...chunks.map(
      (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
    ),
    'data: {"choices":[],"usage":{"prompt_tokens":4,"completion_tokens":3,"total_tokens":7}}\n\n',
    'data: [DONE]\n\n',
  ].join('');
  return (async () =>
    new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })) as FetchLike;
}

describe('ask', () => {
  it('puts the open note and retrieved paths into the prompt', () => {
    const active = sourceFromNote('欢迎.md', '# 欢迎\n\n相关笔记');
    const messages = buildAskMessages('这周做了什么', active, sources);
    expect(messages[0]?.content).toContain('[[路径]]');
    expect(messages[1]?.content).toContain('欢迎.md');
    expect(messages[1]?.content).toContain('日常/周报.md');
    expect(messages[1]?.content).toContain('这周做了什么');
  });

  it('turns cited wiki links into note citations and falls back after the answer ends', () => {
    expect(citationsFromAnswer('见 [[日常/周报.md]]。', sources, files, false)).toEqual(sources);
    expect(citationsFromAnswer('没有写出链接', sources, files, false)).toEqual([]);
    expect(citationsFromAnswer('没有写出链接', sources, files, true)).toEqual(sources);
  });

  it('streams router deltas from an OpenAI-compatible response', async () => {
    let text = '';
    for await (const event of streamAnswer(
      settings,
      [{ role: 'user', content: '总结' }],
      sse(['本周', '搭好了布局。见 [[日常/周报.md]]']),
    )) {
      text += event.delta;
    }
    expect(text).toBe('本周搭好了布局。见 [[日常/周报.md]]');
    expect(citationsFromAnswer(text, sources, files, true)[0]?.path).toBe('日常/周报.md');
  });
});
