import { CARD_SYSTEM_PROMPT, parseGeneratedCards, type CardDraft } from '@ai-notes/ai';
import { createModelRouter, explainAiError } from '../ai/ask';
import { loadAiSettings, normalizeAiSettings } from '../ai/settings';

export class CardModelError extends Error {
  readonly code: 'unconfigured' | 'failed';

  constructor(message: string, code: 'unconfigured' | 'failed') {
    super(message);
    this.name = 'CardModelError';
    this.code = code;
  }
}

const UNCONFIGURED =
  '还没有配置对话模型。手写卡片和复习不需要模型，可以在笔记里按约定语法写，或先到模型设置里填写接口。';

export async function generateCardDrafts(text: string): Promise<CardDraft[]> {
  const trimmed = text.trim();
  if (!trimmed) throw new CardModelError('这段文字是空的，没有可以提炼的内容', 'failed');
  let settings;
  try {
    settings = normalizeAiSettings(loadAiSettings());
  } catch {
    throw new CardModelError(UNCONFIGURED, 'unconfigured');
  }
  try {
    const router = createModelRouter(settings);
    const result = await router.chat({
      feature: 'cards',
      temperature: 0.2,
      messages: [
        { role: 'system', content: CARD_SYSTEM_PROMPT },
        { role: 'user', content: `笔记：\n${trimmed.slice(0, 12000)}` },
      ],
    });
    return parseGeneratedCards(result.content);
  } catch (error) {
    if (error instanceof CardModelError) throw error;
    if (error instanceof Error && error.message.includes('没有返回')) {
      throw new CardModelError(error.message, 'failed');
    }
    throw new CardModelError(explainAiError(error), 'failed');
  }
}
